import { hashUniform } from '../shared/random';
import { sha256Hex } from '../shared/sha256';
import type { EntryColumns } from './population';

/**
 * Verifiable, loyalty-weighted ballot draw.
 *
 * 1. Before the ballot closes, the club publishes `commitment = SHA-256(seed)`.
 * 2. Each application gets u = H(seed, entryId) ∈ (0,1) and the race time
 *    key = −ln(u) / weight  (an Exp(weight) sample — Efraimidis–Spirakis).
 * 3. Applications are served in ascending key order until the seats run out;
 *    a group is never split (if it does not fit, the next smaller one is tried).
 * 4. After the draw the seed is revealed. Anyone can check the commitment and
 *    recompute their own key — and the order of everyone who lost becomes the
 *    waitlist for "Kein Platz bleibt leer" seat recycling.
 *
 * The key depends only on (seed, id, weight), never on list order, so shuffling
 * the entry list cannot change the outcome.
 */

export const COMMITMENT_PREFIX = 'fcb-fair-seat:v1:';

export function commitmentFor(seed: string): string {
  return sha256Hex(`${COMMITMENT_PREFIX}${seed}`);
}

export function verifyCommitment(seed: string, commitment: string): boolean {
  return commitmentFor(seed) === commitment.trim().toLowerCase();
}

export function makeDrawSeed(fixtureId: string, entropyHex: string): string {
  return `${fixtureId}:${entropyHex}`;
}

export function entryKey(
  seed: string,
  entryId: string,
  weight: number,
): { u: number; key: number } {
  if (!(weight > 0)) throw new Error(`Weight must be positive (got ${weight}) for ${entryId}`);
  const u = hashUniform(seed, entryId);
  return { u, key: -Math.log(u) / weight };
}

export interface PechvogelStat {
  pechvogel: number;
  entrants: number;
  winners: number;
  rate: number;
}

export interface DrawResult {
  seed: string;
  commitment: string;
  seatsAvailable: number;
  seatsAllocated: number;
  entrants: number;
  winners: number;
  /** Entry indices sorted by key (the full draw order). */
  order: Uint32Array;
  keys: Float64Array;
  won: Uint8Array;
  /** 1-based draw position per entry index. */
  rank: Uint32Array;
  /** 1-based waitlist position per entry index (0 for winners). */
  waitlistPosition: Uint32Array;
  /** Draw position of the last application that won seats. */
  cutoffRank: number;
  winRateByPechvogel: PechvogelStat[];
  durationMs: number;
}

export function runDraw(entries: EntryColumns, seats: number, seed: string): DrawResult {
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const n = entries.ids.length;
  const keys = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const w = entries.weights[i] as number;
    if (!(w > 0)) throw new Error(`Weight must be positive for ${entries.ids[i]}`);
    keys[i] = -Math.log(hashUniform(seed, entries.ids[i] as string)) / w;
  }

  const order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  order.sort((a, b) => (keys[a] as number) - (keys[b] as number) || a - b);

  const won = new Uint8Array(n);
  const rank = new Uint32Array(n);
  const waitlistPosition = new Uint32Array(n);
  let remaining = Math.max(0, Math.floor(seats));
  let winners = 0;
  let waitlist = 0;
  let cutoffRank = 0;

  for (let r = 0; r < n; r++) {
    const i = order[r] as number;
    rank[i] = r + 1;
    const size = entries.groupSizes[i] as number;
    if (remaining > 0 && size <= remaining) {
      won[i] = 1;
      remaining -= size;
      winners++;
      cutoffRank = r + 1;
    } else {
      waitlist++;
      waitlistPosition[i] = waitlist;
    }
  }

  const stats = new Map<number, { entrants: number; winners: number }>();
  for (let i = 0; i < n; i++) {
    const p = Math.min(entries.pechvogel[i] as number, 10);
    const s = stats.get(p) ?? { entrants: 0, winners: 0 };
    s.entrants++;
    s.winners += won[i] as number;
    stats.set(p, s);
  }
  const winRateByPechvogel = [...stats.entries()]
    .sort(([a], [b]) => a - b)
    .map(([pechvogel, s]) => ({
      pechvogel,
      entrants: s.entrants,
      winners: s.winners,
      rate: s.entrants === 0 ? 0 : s.winners / s.entrants,
    }));

  const ended = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    seed,
    commitment: commitmentFor(seed),
    seatsAvailable: Math.max(0, Math.floor(seats)),
    seatsAllocated: Math.max(0, Math.floor(seats)) - remaining,
    entrants: n,
    winners,
    order,
    keys,
    won,
    rank,
    waitlistPosition,
    cutoffRank,
    winRateByPechvogel,
    durationMs: ended - started,
  };
}

export interface EntryOutcome {
  id: string;
  index: number;
  won: boolean;
  rank: number;
  key: number;
  u: number;
  weight: number;
  groupSize: number;
  waitlistPosition: number | null;
}

export function outcomeAt(result: DrawResult, entries: EntryColumns, index: number): EntryOutcome {
  if (index < 0 || index >= entries.ids.length) throw new RangeError(`No entry at ${index}`);
  const id = entries.ids[index] as string;
  const weight = entries.weights[index] as number;
  const { u } = entryKey(result.seed, id, weight);
  const wl = result.waitlistPosition[index] as number;
  return {
    id,
    index,
    won: result.won[index] === 1,
    rank: result.rank[index] as number,
    key: result.keys[index] as number,
    u,
    weight,
    groupSize: entries.groupSizes[index] as number,
    waitlistPosition: wl === 0 ? null : wl,
  };
}

/** The first `limit` waitlisted applications, in order — input to seat recycling. */
export function waitlistHead(
  result: DrawResult,
  entries: EntryColumns,
  limit: number,
): EntryOutcome[] {
  const out: EntryOutcome[] = [];
  for (let r = 0; r < result.order.length && out.length < limit; r++) {
    const i = result.order[r] as number;
    if (result.won[i] === 0) out.push(outcomeAt(result, entries, i));
  }
  return out;
}

/** Independent re-check of one entry against the revealed seed. */
export function verifyEntry(
  seed: string,
  commitment: string,
  entry: { id: string; weight: number; key: number },
): { commitmentValid: boolean; keyValid: boolean; recomputedKey: number } {
  const { key } = entryKey(seed, entry.id, entry.weight);
  return {
    commitmentValid: verifyCommitment(seed, commitment),
    keyValid: Math.abs(key - entry.key) <= 1e-12 * Math.max(1, Math.abs(key)),
    recomputedKey: key,
  };
}
