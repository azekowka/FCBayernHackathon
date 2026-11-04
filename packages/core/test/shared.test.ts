import { createHash } from 'node:crypto';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  bisectIncreasing,
  clamp,
  clockAt,
  createRng,
  formatDuration,
  formatRelativeToKickoff,
  hashUniform,
  interpolate,
  munichHour,
  munichWeekday,
  normal,
  oneIn,
  percent,
  pick,
  pickWeightedIndex,
  randInt,
  randomHex,
  sha256Hex,
} from '../src/shared';

describe('sha256Hex', () => {
  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    [
      'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    ],
  ])('matches the NIST vector for %j', (input, expected) => {
    expect(sha256Hex(input)).toBe(expected);
  });

  it('agrees with node:crypto for arbitrary unicode strings', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme', maxLength: 300 }), (s) => {
        expect(sha256Hex(s)).toBe(createHash('sha256').update(s, 'utf8').digest('hex'));
      }),
      { numRuns: 300 },
    );
  });
});

describe('seeded randomness', () => {
  it('createRng is deterministic per seed and stays in [0, 1)', () => {
    const a = createRng('seed-1');
    const b = createRng('seed-1');
    const c = createRng('seed-2');
    const seqA = Array.from({ length: 50 }, () => a());
    const seqB = Array.from({ length: 50 }, () => b());
    const seqC = Array.from({ length: 50 }, () => c());
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('hashUniform is order-independent, open-interval and roughly uniform', () => {
    let total = 0;
    const n = 20_000;
    for (let i = 0; i < n; i++) {
      const u = hashUniform('s', `id-${i}`);
      expect(u).toBeGreaterThan(0);
      expect(u).toBeLessThan(1);
      total += u;
    }
    expect(total / n).toBeCloseTo(0.5, 1);
    expect(hashUniform('s', 'x')).toBe(hashUniform('s', 'x'));
    expect(hashUniform('s', 'x')).not.toBe(hashUniform('t', 'x'));
  });

  it('helpers respect their contracts', () => {
    const rng = createRng(42);
    for (let i = 0; i < 200; i++) {
      const v = randInt(rng, 3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
    expect(['a', 'b']).toContain(pick(rng, ['a', 'b']));
    expect(() => pick(rng, [])).toThrow();
    expect(pickWeightedIndex(rng, [0, 0, 5])).toBe(2);
    expect(() => pickWeightedIndex(rng, [0, 0])).toThrow();
    expect(randomHex(rng, 8)).toMatch(/^[0-9a-f]{16}$/);
    const samples = Array.from({ length: 5000 }, () => normal(rng, 10, 2));
    const m = samples.reduce((a, b) => a + b, 0) / samples.length;
    expect(m).toBeCloseTo(10, 0);
  });
});

describe('math helpers', () => {
  it('bisectIncreasing finds the crossing of a monotone function', () => {
    expect(bisectIncreasing((x) => x * x, 9, 0, 10)).toBeCloseTo(3, 9);
    expect(bisectIncreasing((x) => x, 50, 0, 10)).toBe(10);
  });

  it('formats odds and percentages for humans', () => {
    expect(oneIn(0.5)).toBe(2);
    expect(oneIn(0.18)).toBe(5.5);
    expect(oneIn(0.04)).toBe(25);
    expect(oneIn(0)).toBe(Number.POSITIVE_INFINITY);
    expect(oneIn(1)).toBe(1);
    expect(percent(0.1234, 1)).toBe('12.3%');
    expect(clamp(5, 0, 3)).toBe(3);
  });

  it('interpolates piecewise-linear curves and clamps at the ends', () => {
    const pts = [
      [0, 0],
      [10, 100],
      [20, 50],
    ] as const;
    expect(interpolate(pts, -5)).toBe(0);
    expect(interpolate(pts, 5)).toBe(50);
    expect(interpolate(pts, 15)).toBe(75);
    expect(interpolate(pts, 30)).toBe(50);
    expect(interpolate([], 3)).toBe(0);
  });
});

describe('time helpers (Europe/Berlin)', () => {
  it('renders kick-off relative clock times in Munich time across DST', () => {
    expect(clockAt('2026-11-21T18:30:00+01:00', -90)).toBe('17:00');
    expect(clockAt('2027-04-10T15:30:00+02:00', 0)).toBe('15:30');
    expect(munichWeekday('2026-12-15T20:30:00+01:00')).toBe(2);
    expect(munichHour('2026-12-15T20:30:00+01:00')).toBe(20);
  });

  it('formats durations and relative labels', () => {
    expect(formatDuration(25)).toBe('25 min');
    expect(formatDuration(65)).toBe('1 h 05 min');
    expect(formatDuration(120)).toBe('2 h');
    expect(formatRelativeToKickoff(-150)).toBe('T−2 h 30 min');
    expect(formatRelativeToKickoff(0)).toBe('Kick-off');
    expect(formatRelativeToKickoff(20)).toBe('T+20 min');
  });
});
