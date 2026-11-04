export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function sum(values: readonly number[]): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

export function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length;
}

export function round(value: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

export function logistic(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

/**
 * Finds x in [lo, hi] where a monotonically increasing f crosses `target`.
 * Returns `hi` when f(hi) < target.
 */
export function bisectIncreasing(
  f: (x: number) => number,
  target: number,
  lo: number,
  hi: number,
  iterations = 80,
): number {
  if (f(hi) < target) return hi;
  let a = lo;
  let b = hi;
  for (let i = 0; i < iterations; i++) {
    const mid = (a + b) / 2;
    if (f(mid) < target) a = mid;
    else b = mid;
  }
  return (a + b) / 2;
}

/** "1 in N" phrasing for a probability, rounded for humans. */
export function oneIn(p: number): number {
  if (p <= 0) return Number.POSITIVE_INFINITY;
  if (p >= 1) return 1;
  const n = 1 / p;
  return n < 10 ? Math.round(n * 2) / 2 : Math.round(n);
}

export function percent(p: number, decimals = 0): string {
  return `${round(p * 100, decimals).toFixed(decimals)}%`;
}

/** Linear interpolation helper for piecewise-linear curves. */
export function interpolate(points: readonly (readonly [number, number])[], x: number): number {
  if (points.length === 0) return 0;
  const first = points[0] as readonly [number, number];
  const last = points[points.length - 1] as readonly [number, number];
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i] as readonly [number, number];
    const [x0, y0] = points[i - 1] as readonly [number, number];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return last[1];
}
