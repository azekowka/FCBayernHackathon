/**
 * Deterministic randomness.
 *
 * Every random decision in the domain (draws, synthetic data, simulations) flows
 * through these helpers so that results are reproducible from a public seed.
 * `Math.random` is banned in domain code by lint rule.
 */

export type Rng = () => number;

/** cyrb128 — fast 128-bit string hash, returns four 32-bit unsigned ints. */
export function cyrb128(input: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < input.length; i++) {
    const k = input.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/** sfc32 — Small Fast Counting PRNG (passes PractRand), returns floats in [0, 1). */
export function sfc32(a: number, b: number, c: number, d: number): Rng {
  return () => {
    a |= 0;
    b |= 0;
    c |= 0;
    d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/** Creates a seeded PRNG. Same seed → same sequence, on server and in the browser. */
export function createRng(seed: string | number): Rng {
  const [a, b, c, d] = cyrb128(String(seed));
  const rng = sfc32(a, b, c, d);
  for (let i = 0; i < 12; i++) rng();
  return rng;
}

const TWO_POW_53 = 9007199254740992;

/**
 * Order-independent uniform number in the open interval (0, 1), derived only
 * from `(seed, key)`. Used for verifiable draws: an entrant can recompute their
 * own number from the published seed and their entry id, without knowing
 * anything about the other entries.
 */
export function hashUniform(seed: string, key: string): number {
  const [a, b] = cyrb128(`${seed}\u0000${key}`);
  const v = a * 2097152 + (b >>> 11); // 32 + 21 = 53 bits
  return (v + 0.5) / TWO_POW_53;
}

export function randInt(rng: Rng, minInclusive: number, maxInclusive: number): number {
  return minInclusive + Math.floor(rng() * (maxInclusive - minInclusive + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick() called with an empty array');
  return items[Math.floor(rng() * items.length)] as T;
}

/** Picks an index proportionally to non-negative weights. */
export function pickWeightedIndex(rng: Rng, weights: readonly number[]): number {
  let total = 0;
  for (const w of weights) total += Math.max(0, w);
  if (total <= 0) throw new Error('pickWeightedIndex() needs at least one positive weight');
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= Math.max(0, weights[i] ?? 0);
    if (r < 0) return i;
  }
  return weights.length - 1;
}

/** Standard normal sample via Box–Muller. */
export function normal(rng: Rng, mean = 0, sd = 1): number {
  let u = 0;
  while (u === 0) u = rng();
  const v = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function bernoulli(rng: Rng, p: number): boolean {
  return rng() < p;
}

/** Lowercase hex string of seeded entropy, e.g. for draw seeds in demos. */
export function randomHex(rng: Rng, bytes = 16): string {
  let out = '';
  for (let i = 0; i < bytes; i++) {
    out += Math.floor(rng() * 256)
      .toString(16)
      .padStart(2, '0');
  }
  return out;
}
