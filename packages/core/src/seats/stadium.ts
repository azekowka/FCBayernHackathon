import { ARENA_CAPACITY } from '../ticketing/fixtures';

/**
 * Simplified Allianz Arena model: three tiers of blocks arranged around an
 * oval, goals at north and south, Südkurve (standing) behind the south goal.
 * Angles are in degrees, 0° = east, increasing clockwise as drawn on screen.
 * Block numbers, splits and prices are illustrative for the prototype.
 */

export type Tier = 'lower' | 'middle' | 'upper';
export type Stand = 'Nord' | 'Ost' | 'Süd' | 'West';
export type BlockKind = 'standing' | 'seated' | 'family' | 'away' | 'hospitality';

export interface StadiumBlock {
  id: string;
  tier: Tier;
  stand: Stand;
  kind: BlockKind;
  capacity: number;
  seasonSeats: number;
  accessibleSpaces: number;
  rows: number;
  startAngle: number;
  endAngle: number;
  /** Entrance zone used for queue forecasts. */
  entrance: Stand;
  faceValue: number;
}

interface TierSpec {
  tier: Tier;
  count: number;
  firstNumber: number;
  capacity: number;
  /** Radial extent as a fraction of the outer ellipse. */
  ring: readonly [number, number];
}

export const TIER_SPECS: readonly TierSpec[] = [
  { tier: 'lower', count: 40, firstNumber: 101, capacity: 26_000, ring: [0.58, 0.74] },
  { tier: 'middle', count: 32, firstNumber: 201, capacity: 19_000, ring: [0.76, 0.86] },
  { tier: 'upper', count: 44, firstNumber: 301, capacity: 30_024, ring: [0.88, 1] },
];

/** Outer ellipse proportions (taller than wide: the pitch runs north–south). */
export const STADIUM_ASPECT = { rx: 0.78, ry: 1 } as const;

const SEASON_SHARE: Record<BlockKind, Record<Tier, number>> = {
  standing: { lower: 0.92, middle: 0.92, upper: 0.92 },
  seated: { lower: 0.59, middle: 0.47, upper: 0.47 },
  family: { lower: 0.5, middle: 0.5, upper: 0.5 },
  away: { lower: 0, middle: 0, upper: 0 },
  hospitality: { lower: 0, middle: 0, upper: 0 },
};

const FACE_VALUE: Record<BlockKind, Record<Tier, number>> = {
  standing: { lower: 15, middle: 15, upper: 15 },
  seated: { lower: 70, middle: 75, upper: 45 },
  family: { lower: 35, middle: 35, upper: 35 },
  away: { lower: 50, middle: 50, upper: 40 },
  hospitality: { lower: 0, middle: 0, upper: 0 },
};

export function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function standForAngle(deg: number): Stand {
  const a = normalizeAngle(deg);
  if (a >= 315 || a < 45) return 'Ost';
  if (a < 135) return 'Süd';
  if (a < 225) return 'West';
  return 'Nord';
}

function kindFor(tier: Tier, mid: number): BlockKind {
  const a = normalizeAngle(mid);
  if (tier === 'lower' && a >= 58 && a < 122) return 'standing';
  if (a >= 292 && a < 318 && tier !== 'middle') return 'away';
  if (tier === 'lower' && a >= 128 && a < 146) return 'family';
  if (tier === 'middle' && a >= 152 && a < 208) return 'hospitality';
  return 'seated';
}

/** Arc length of the outer ellipse over [a0, a1] — long sides hold more seats. */
function arcWeight(a0: number, a1: number): number {
  const { rx, ry } = STADIUM_ASPECT;
  let total = 0;
  const steps = 12;
  for (let s = 0; s < steps; s++) {
    const t = ((a0 + ((a1 - a0) * (s + 0.5)) / steps) * Math.PI) / 180;
    total += Math.hypot(rx * Math.sin(t), ry * Math.cos(t));
  }
  return (total / steps) * (a1 - a0);
}

let cached: StadiumBlock[] | null = null;

export function buildStadium(): StadiumBlock[] {
  if (cached) return cached;
  const blocks: StadiumBlock[] = [];
  for (const spec of TIER_SPECS) {
    const span = 360 / spec.count;
    const raw = Array.from({ length: spec.count }, (_, i) => {
      const startAngle = i * span;
      const endAngle = startAngle + span;
      const mid = startAngle + span / 2;
      const kind = kindFor(spec.tier, mid);
      const density = kind === 'standing' ? 1.45 : kind === 'hospitality' ? 0.7 : 1;
      return { i, startAngle, endAngle, mid, kind, w: arcWeight(startAngle, endAngle) * density };
    });
    const totalW = raw.reduce((acc, r) => acc + r.w, 0);
    let assigned = 0;
    raw.forEach((r, idx) => {
      const capacity =
        idx === raw.length - 1
          ? spec.capacity - assigned
          : Math.round((spec.capacity * r.w) / totalW);
      assigned += capacity;
      const seatsPerRow = r.kind === 'standing' ? 48 : spec.tier === 'upper' ? 34 : 30;
      const stand = standForAngle(r.mid);
      blocks.push({
        id: String(spec.firstNumber + r.i),
        tier: spec.tier,
        stand,
        kind: r.kind,
        capacity,
        seasonSeats: Math.round(capacity * SEASON_SHARE[r.kind][spec.tier]),
        accessibleSpaces: spec.tier === 'lower' && r.kind === 'seated' && r.i % 4 === 0 ? 12 : 0,
        rows: Math.max(8, Math.round(capacity / seatsPerRow)),
        startAngle: r.startAngle,
        endAngle: r.endAngle,
        entrance: stand,
        faceValue: FACE_VALUE[r.kind][spec.tier],
      });
    });
  }
  cached = blocks;
  return blocks;
}

export function getBlock(id: string): StadiumBlock {
  const b = buildStadium().find((x) => x.id === id);
  if (!b) throw new Error(`Unknown block: ${id}`);
  return b;
}

export function stadiumTotals(blocks: readonly StadiumBlock[] = buildStadium()) {
  let capacity = 0;
  let seasonSeats = 0;
  for (const b of blocks) {
    capacity += b.capacity;
    seasonSeats += b.seasonSeats;
  }
  return {
    capacity,
    seasonSeats,
    blocks: blocks.length,
    matchesArena: capacity === ARENA_CAPACITY,
  };
}

export function seatId(blockId: string, row: number, seat: number): string {
  return `${blockId}-R${row}-S${seat}`;
}

export function parseSeatId(id: string): { blockId: string; row: number; seat: number } {
  const m = /^(\d{3})-R(\d+)-S(\d+)$/.exec(id);
  if (!m) throw new Error(`Invalid seat id: ${id}`);
  return { blockId: m[1] as string, row: Number(m[2]), seat: Number(m[3]) };
}

export function describeBlock(b: Pick<StadiumBlock, 'id' | 'tier' | 'stand' | 'kind'>): string {
  const tier = { lower: 'Unterrang', middle: 'Mittelrang', upper: 'Oberrang' }[b.tier];
  const stand = b.stand === 'Süd' && b.kind === 'standing' ? 'Südkurve' : b.stand;
  return `Block ${b.id} · ${stand} · ${tier}${b.kind === 'standing' ? ' (standing)' : ''}`;
}
