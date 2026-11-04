import { clamp, logistic } from '../shared/math';
import { createRng, bernoulli } from '../shared/random';
import { munichHour, munichWeekday } from '../shared/time';
import type { Fixture } from '../ticketing/types';
import { buildStadium, seatId, type StadiumBlock } from './stadium';

/**
 * Explainable no-show model.
 *
 * A transparent logistic regression — every prediction can be decomposed into
 * per-feature contributions a fan can read ("why do you think I won't come?").
 * In production it would run on-device over opt-in signals only; the club would
 * only ever learn that a fan chose to release a seat.
 */

export interface MatchContext {
  fixtureId: string;
  kickoff: string;
  demandIndex: number;
  midweek: boolean;
  lateKickoff: boolean;
  rainProbability: number;
  temperatureC: number;
  schoolHolidays: boolean;
}

export function matchContextFor(
  fixture: Pick<Fixture, 'id' | 'kickoff' | 'demandIndex'>,
  weather: { rainProbability?: number; temperatureC?: number; schoolHolidays?: boolean } = {},
): MatchContext {
  const weekday = munichWeekday(fixture.kickoff);
  return {
    fixtureId: fixture.id,
    kickoff: fixture.kickoff,
    demandIndex: fixture.demandIndex,
    midweek: weekday >= 1 && weekday <= 4,
    lateKickoff: munichHour(fixture.kickoff) >= 20,
    rainProbability: weather.rainProbability ?? 0.35,
    temperatureC: weather.temperatureC ?? 8,
    schoolHolidays: weather.schoolHolidays ?? false,
  };
}

export interface HolderFeatures {
  holderId: string;
  seatId: string;
  blockId: string;
  /** Share of the last 10 home matches attended. */
  attendanceRate: number;
  distanceKm: number;
  /** Opt-in: the fan's own calendar shows them away on matchday. */
  awayCalendarSignal: boolean;
  /** Opt-in to smart-release nudges. Non-opted-in fans are never nudged. */
  optedIn: boolean;
}

export type FeatureKey =
  | 'attendance'
  | 'distance'
  | 'midweek'
  | 'late'
  | 'demand'
  | 'rain'
  | 'cold'
  | 'holidays'
  | 'calendar';

export const NO_SHOW_MODEL = {
  intercept: -4.75,
  coefficients: {
    attendance: 3.4,
    distance: 0.38,
    midweek: 0.45,
    late: 0.3,
    demand: 0.7,
    rain: 0.55,
    cold: 0.35,
    holidays: 0.45,
    calendar: 3.1,
  } satisfies Record<FeatureKey, number>,
} as const;

export interface Contribution {
  feature: FeatureKey;
  label: string;
  /** Log-odds contribution. */
  effect: number;
}

export interface NoShowPrediction {
  holderId: string;
  probability: number;
  contributions: Contribution[];
}

export function predictNoShow(h: HolderFeatures, ctx: MatchContext): NoShowPrediction {
  const c = NO_SHOW_MODEL.coefficients;
  const missed = clamp(1 - h.attendanceRate, 0, 1);
  const dist = clamp(h.distanceKm / 100, 0, 4);
  const cold = ctx.temperatureC < 3 ? 1 : 0;
  const attended = Math.round(h.attendanceRate * 10);
  const parts: Contribution[] = [
    {
      feature: 'attendance',
      label: `Attended ${attended} of the last 10 home matches`,
      effect: c.attendance * missed,
    },
    {
      feature: 'distance',
      label: `Lives ${Math.round(h.distanceKm)} km from the Arena`,
      effect: c.distance * dist,
    },
    { feature: 'midweek', label: 'Midweek kick-off', effect: ctx.midweek ? c.midweek : 0 },
    { feature: 'late', label: 'Late kick-off', effect: ctx.lateKickoff ? c.late : 0 },
    {
      feature: 'demand',
      label: 'Lower-profile opponent',
      effect: c.demand * (1 - ctx.demandIndex),
    },
    {
      feature: 'rain',
      label: `${Math.round(ctx.rainProbability * 100)}% chance of rain`,
      effect: c.rain * ctx.rainProbability,
    },
    { feature: 'cold', label: `Cold matchday (${ctx.temperatureC}°C)`, effect: c.cold * cold },
    { feature: 'holidays', label: 'School holidays', effect: ctx.schoolHolidays ? c.holidays : 0 },
    {
      feature: 'calendar',
      label: 'Your calendar shows you away (opt-in)',
      effect: h.awayCalendarSignal ? c.calendar : 0,
    },
  ];
  const z = NO_SHOW_MODEL.intercept + parts.reduce((acc, p) => acc + p.effect, 0);
  return {
    holderId: h.holderId,
    probability: logistic(z),
    contributions: parts.filter((p) => p.effect > 0.05).sort((a, b) => b.effect - a.effect),
  };
}

/** Synthetic, reproducible season-ticket holders (one per season seat). */
export function generateHolders(
  fixture: Pick<Fixture, 'id' | 'kickoff'>,
  blocks: readonly StadiumBlock[] = buildStadium(),
  seed = 'holders-2026',
): HolderFeatures[] {
  const rng = createRng(`${seed}:${fixture.id}`);
  const midweek = (() => {
    const d = munichWeekday(fixture.kickoff);
    return d >= 1 && d <= 4;
  })();
  const holders: HolderFeatures[] = [];
  for (const b of blocks) {
    const perRow = Math.max(1, Math.ceil(b.capacity / b.rows));
    for (let k = 0; k < b.seasonSeats; k++) {
      const row = Math.floor(k / perRow) + 1;
      const seat = (k % perRow) + 1;
      const r1 = rng();
      const attendanceRate =
        r1 < 0.68 ? 0.9 + rng() * 0.1 : r1 < 0.9 ? 0.7 + rng() * 0.2 : 0.3 + rng() * 0.4;
      const r2 = rng();
      const distanceKm =
        r2 < 0.55 ? 2 + rng() * 38 : r2 < 0.85 ? 40 + rng() * 160 : 200 + rng() * 500;
      const id = seatId(b.id, row, seat);
      holders.push({
        holderId: `H-${id}`,
        seatId: id,
        blockId: b.id,
        attendanceRate,
        distanceKm,
        awayCalendarSignal: bernoulli(rng, midweek ? 0.035 : 0.025),
        optedIn: bernoulli(rng, 0.72),
      });
    }
  }
  return holders;
}

export interface BlockRisk {
  blockId: string;
  seasonSeats: number;
  expectedAbsent: number;
  /** expectedAbsent / seasonSeats. */
  risk: number;
  atRisk: number;
}

export interface StadiumForecast {
  context: MatchContext;
  blocks: BlockRisk[];
  expectedAbsent: number;
  seasonSeats: number;
  meanProbability: number;
  /** Holders with p ≥ threshold who opted in — the people Gemini would nudge. */
  nudgeable: number;
}

export const AT_RISK_THRESHOLD = 0.3;

export function forecastStadium(
  holders: readonly HolderFeatures[],
  ctx: MatchContext,
  blocks: readonly StadiumBlock[] = buildStadium(),
): StadiumForecast {
  const byBlock = new Map<string, BlockRisk>(
    blocks.map((b) => [
      b.id,
      { blockId: b.id, seasonSeats: b.seasonSeats, expectedAbsent: 0, risk: 0, atRisk: 0 },
    ]),
  );
  let expectedAbsent = 0;
  let nudgeable = 0;
  for (const h of holders) {
    const p = predictNoShow(h, ctx).probability;
    const br = byBlock.get(h.blockId);
    if (!br) continue;
    br.expectedAbsent += p;
    expectedAbsent += p;
    if (p >= AT_RISK_THRESHOLD) {
      br.atRisk++;
      if (h.optedIn) nudgeable++;
    }
  }
  for (const br of byBlock.values())
    br.risk = br.seasonSeats > 0 ? br.expectedAbsent / br.seasonSeats : 0;
  return {
    context: ctx,
    blocks: [...byBlock.values()],
    expectedAbsent,
    seasonSeats: holders.length,
    meanProbability: holders.length > 0 ? expectedAbsent / holders.length : 0,
    nudgeable,
  };
}
