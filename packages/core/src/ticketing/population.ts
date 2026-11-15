import { createRng, pickWeightedIndex } from '../shared/random';
import { loyaltyWeight } from './loyalty';
import type { Fixture } from './types';

/**
 * Synthetic model of who applies in the member ballot. Real deployments would
 * read these distributions from the ticketing system; for the prototype they
 * are calibrated so the numbers on screen are plausible.
 */

const PECHVOGEL_DECAY = 0.22;

/** P(pechvogel = k) for k = 0…10 (10 = "10 or more"). */
export const PECHVOGEL_DISTRIBUTION: readonly number[] = (() => {
  const raw: number[] = [];
  for (let k = 0; k < 10; k++) raw.push(PECHVOGEL_DECAY * (1 - PECHVOGEL_DECAY) ** k);
  raw.push((1 - PECHVOGEL_DECAY) ** 10);
  return raw;
})();

export const YEARS_DISTRIBUTION: readonly { years: number; share: number }[] = [
  { years: 0, share: 0.2 },
  { years: 2, share: 0.25 },
  { years: 5, share: 0.25 },
  { years: 8, share: 0.15 },
  { years: 12, share: 0.15 },
];

export const GROUP_SIZE_DISTRIBUTION: readonly { size: number; share: number }[] = [
  { size: 1, share: 0.45 },
  { size: 2, share: 0.35 },
  { size: 3, share: 0.1 },
  { size: 4, share: 0.1 },
];

export const MEAN_GROUP_SIZE = GROUP_SIZE_DISTRIBUTION.reduce(
  (acc, g) => acc + g.size * g.share,
  0,
);

export interface PopulationBucket {
  pechvogel: number;
  years: number;
  groupSize: number;
  weight: number;
  /** Expected number of applications in this bucket (may be fractional). */
  applications: number;
}

export function applicationsForRequests(seatRequests: number): number {
  return seatRequests / MEAN_GROUP_SIZE;
}

const bucketCache = new Map<number, PopulationBucket[]>();

/** Expected applicant population for a fixture, grouped into weight buckets. */
export function entrantPopulation(seatRequests: number): PopulationBucket[] {
  const cached = bucketCache.get(seatRequests);
  if (cached) return cached;
  const applications = applicationsForRequests(seatRequests);
  const buckets: PopulationBucket[] = [];
  PECHVOGEL_DISTRIBUTION.forEach((pShare, pechvogel) => {
    for (const { years, share: yShare } of YEARS_DISTRIBUTION) {
      for (const { size, share: gShare } of GROUP_SIZE_DISTRIBUTION) {
        buckets.push({
          pechvogel,
          years,
          groupSize: size,
          weight: loyaltyWeight(pechvogel, years).total,
          applications: applications * pShare * yShare * gShare,
        });
      }
    }
  });
  bucketCache.set(seatRequests, buckets);
  return buckets;
}

export interface DrawEntry {
  id: string;
  weight: number;
  groupSize: number;
  pechvogel?: number;
}

/** Columnar entry storage — ~190k applications fit comfortably in typed arrays. */
export interface EntryColumns {
  ids: string[];
  weights: Float64Array;
  groupSizes: Uint8Array;
  pechvogel: Uint8Array;
}

export function entryColumnsFrom(entries: readonly DrawEntry[]): EntryColumns {
  const n = entries.length;
  const cols: EntryColumns = {
    ids: new Array<string>(n),
    weights: new Float64Array(n),
    groupSizes: new Uint8Array(n),
    pechvogel: new Uint8Array(n),
  };
  entries.forEach((e, i) => {
    cols.ids[i] = e.id;
    cols.weights[i] = e.weight;
    cols.groupSizes[i] = e.groupSize;
    cols.pechvogel[i] = Math.min(255, e.pechvogel ?? 0);
  });
  return cols;
}

/**
 * Generates a synthetic, reproducible applicant list for a fixture and appends
 * any real entries (e.g. the demo member) at the end.
 */
export function generateEntries(
  fixture: Pick<Fixture, 'id' | 'opponentShort' | 'expectedRequests'>,
  options: { scale?: number; extra?: readonly DrawEntry[]; seed?: string } = {},
): EntryColumns {
  const scale = options.scale ?? 1;
  const extra = options.extra ?? [];
  const synthetic = Math.round(applicationsForRequests(fixture.expectedRequests) * scale);
  const n = synthetic + extra.length;
  const rng = createRng(options.seed ?? `population:${fixture.id}`);
  const pWeights = [...PECHVOGEL_DISTRIBUTION];
  const yWeights = YEARS_DISTRIBUTION.map((y) => y.share);
  const gWeights = GROUP_SIZE_DISTRIBUTION.map((g) => g.share);

  const cols: EntryColumns = {
    ids: new Array<string>(n),
    weights: new Float64Array(n),
    groupSizes: new Uint8Array(n),
    pechvogel: new Uint8Array(n),
  };
  const weightCache = new Map<number, number>();

  for (let i = 0; i < synthetic; i++) {
    const pechvogel = pickWeightedIndex(rng, pWeights);
    const yi = pickWeightedIndex(rng, yWeights);
    const gi = pickWeightedIndex(rng, gWeights);
    const cacheKey = pechvogel * 100 + yi;
    let weight = weightCache.get(cacheKey);
    if (weight === undefined) {
      weight = loyaltyWeight(pechvogel, (YEARS_DISTRIBUTION[yi] as { years: number }).years).total;
      weightCache.set(cacheKey, weight);
    }
    cols.ids[i] = `${fixture.opponentShort}-${String(i + 1).padStart(6, '0')}`;
    cols.weights[i] = weight;
    cols.groupSizes[i] = (GROUP_SIZE_DISTRIBUTION[gi] as { size: number }).size;
    cols.pechvogel[i] = pechvogel;
  }
  extra.forEach((e, j) => {
    const i = synthetic + j;
    cols.ids[i] = e.id;
    cols.weights[i] = e.weight;
    cols.groupSizes[i] = e.groupSize;
    cols.pechvogel[i] = Math.min(255, e.pechvogel ?? 0);
  });
  return cols;
}
