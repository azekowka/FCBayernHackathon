import { MinHeap } from '../shared/heap';
import { bernoulli, createRng, pickWeightedIndex, type Rng } from '../shared/random';
import type { Fixture } from '../ticketing/types';
import {
  RecyclingEngine,
  offerWindowMinutes,
  type LogEntry,
  type Minutes,
  type SeatPreference,
  type WaitlistFan,
} from './engine';
import {
  forecastStadium,
  generateHolders,
  matchContextFor,
  predictNoShow,
  type HolderFeatures,
} from './noShow';
import { buildStadium, getBlock, parseSeatId, seatId } from './stadium';

/**
 * Matchday simulation: how many empty seats come back into use?
 *
 * "today"    — the current Ticket Exchange: fans must remember to list,
 *              it closes 3 hours before kick-off, buyers pay fees.
 * "fairseat" — Gemini nudges opted-in fans at risk of not coming, release is
 *              one tap until kick-off, the ballot waitlist refills seats.
 *
 * Behavioural rates are illustrative assumptions, listed in BEHAVIOUR so the
 * pitch can be honest about them; the pilot (500 opt-in holders) measures them.
 */

export const BEHAVIOUR = {
  today: {
    releaseRate: 0.38,
    exchangeCloses: -180,
    sellThrough: { early: 0.9, mid: 0.75, late: 0.55 },
    meanMinutesToSell: 180,
  },
  fairseat: {
    optedInReleaseRate: 0.8,
    nudgeResponse: [
      { from: -72 * 60, to: -60 * 60, share: 0.55 },
      { from: -24 * 60, to: -20 * 60, share: 0.3 },
      { from: -6 * 60, to: -3 * 60, share: 0.15 },
    ],
    otherReleaseRate: 0.42,
    releaseCloses: -30,
    youthGiftShare: 0.12,
    noResponseShare: 0.12,
  },
  twoSeatAccounts: 0.3,
} as const;

export type Scenario = 'today' | 'fairseat';

export interface TimePoint {
  at: Minutes;
  released: number;
  refilled: number;
}

export interface SimulationResult {
  scenario: Scenario;
  fixtureId: string;
  horizonMinutes: number;
  expectedAbsent: number;
  absentSeats: number;
  releasedSeats: number;
  refilledSeats: number;
  donatedSeats: number;
  emptySeats: number;
  /** (refilled + donated) / absent */
  recoveredShare: number;
  fansServed: number;
  medianMinutesToRefill: number | null;
  offersMade: number;
  series: TimePoint[];
}

interface AbsentAccount {
  holder: HolderFeatures;
  seatIds: string[];
}

function sampleAbsent(
  holders: readonly HolderFeatures[],
  fixture: Fixture,
  rng: Rng,
): AbsentAccount[] {
  const ctx = matchContextFor(fixture);
  const accounts: AbsentAccount[] = [];
  const meanSeats = 1 + BEHAVIOUR.twoSeatAccounts;
  for (const h of holders) {
    const p = predictNoShow(h, ctx).probability / meanSeats;
    if (!bernoulli(rng, p)) continue;
    const seats = [h.seatId];
    if (bernoulli(rng, BEHAVIOUR.twoSeatAccounts)) {
      const { blockId, row, seat } = parseSeatId(h.seatId);
      seats.push(seatId(blockId, row, seat + 1));
    }
    accounts.push({ holder: h, seatIds: seats });
  }
  return accounts;
}

/** Synthetic waitlist in draw order (the losers of the ballot). */
export function syntheticWaitlist(size: number, seed: string): WaitlistFan[] {
  const rng = createRng(`waitlist:${seed}`);
  const prefs: SeatPreference[] = ['any', 'seated', 'standing'];
  return Array.from({ length: size }, (_, i) => {
    const t = rng();
    const travelMinutes =
      t < 0.35
        ? 20 + Math.round(rng() * 25)
        : t < 0.7
          ? 45 + Math.round(rng() * 45)
          : 90 + Math.round(rng() * 210);
    const g = rng();
    return {
      id: `W${i + 1}`,
      name: `Fan #${i + 1}`,
      rank: i + 1,
      groupSize: g < 0.6 ? 1 : g < 0.95 ? 2 : 3,
      travelMinutes,
      preference: prefs[pickWeightedIndex(rng, [0.7, 0.2, 0.1])] as SeatPreference,
      needsAccessible: bernoulli(rng, 0.01),
      pechvogel: Math.min(10, Math.floor(rng() * 12)),
    };
  });
}

function acceptanceProbability(minutesToKickoff: number): number {
  if (minutesToKickoff >= 24 * 60) return 0.82;
  if (minutesToKickoff >= 6 * 60) return 0.72;
  if (minutesToKickoff >= 2 * 60) return 0.6;
  if (minutesToKickoff >= 45) return 0.45;
  return 0.3;
}

function checkpoints(horizon: number): Minutes[] {
  const pts: Minutes[] = [];
  for (let t = -horizon; t < -6 * 60; t += 60) pts.push(t);
  for (let t = -6 * 60; t <= 0; t += 15) pts.push(t);
  return pts;
}

function lateSkewTime(rng: Rng, from: Minutes, to: Minutes): Minutes {
  // u² clusters releases towards the deadline — people decide late.
  const u = rng();
  return Math.round(from + (to - from) * (1 - (1 - u) * (1 - u)));
}

function simulateToday(fixture: Fixture, accounts: AbsentAccount[], rng: Rng, horizon: number) {
  const b = BEHAVIOUR.today;
  const releases: { at: Minutes; seats: number }[] = [];
  const refills: { at: Minutes; seats: number; released: Minutes }[] = [];
  for (const acc of accounts) {
    if (!bernoulli(rng, b.releaseRate)) continue;
    const at = lateSkewTime(rng, -horizon, b.exchangeCloses);
    const seats = acc.seatIds.length;
    releases.push({ at, seats });
    const sell =
      at <= -24 * 60 ? b.sellThrough.early : at <= -6 * 60 ? b.sellThrough.mid : b.sellThrough.late;
    if (!bernoulli(rng, sell)) continue;
    const soldAt = at + Math.round(-Math.log(1 - rng()) * b.meanMinutesToSell);
    if (soldAt <= b.exchangeCloses) refills.push({ at: soldAt, seats, released: at });
  }
  const series = checkpoints(horizon).map((t) => ({
    at: t,
    released: releases.filter((r) => r.at <= t).reduce((a, r) => a + r.seats, 0),
    refilled: refills.filter((r) => r.at <= t).reduce((a, r) => a + r.seats, 0),
  }));
  const times = refills.map((r) => r.at - r.released).sort((x, y) => x - y);
  return {
    releasedSeats: releases.reduce((a, r) => a + r.seats, 0),
    refilledSeats: refills.reduce((a, r) => a + r.seats, 0),
    donatedSeats: 0,
    fansServed: refills.length,
    medianMinutesToRefill: times.length ? (times[Math.floor(times.length / 2)] as number) : null,
    offersMade: 0,
    series,
    fixtureId: fixture.id,
  };
}

type SimEvent =
  | { kind: 'release'; account: AbsentAccount; youth: boolean }
  | { kind: 'respond'; offerId: string; accept: boolean }
  | { kind: 'tick' };

function simulateFairSeat(
  fixture: Fixture,
  accounts: AbsentAccount[],
  rng: Rng,
  horizon: number,
  waitlistSize: number,
) {
  const f = BEHAVIOUR.fairseat;
  const engine = new RecyclingEngine(syntheticWaitlist(waitlistSize, fixture.id));
  const heap = new MinHeap<SimEvent>();

  for (const acc of accounts) {
    let at: Minutes | null = null;
    if (acc.holder.optedIn) {
      if (bernoulli(rng, f.optedInReleaseRate)) {
        const wave = f.nudgeResponse[
          pickWeightedIndex(
            rng,
            f.nudgeResponse.map((w) => w.share),
          )
        ] as { from: number; to: number };
        at = Math.round(wave.from + rng() * (wave.to - wave.from));
      }
    } else if (bernoulli(rng, f.otherReleaseRate)) {
      at = lateSkewTime(rng, -horizon, f.releaseCloses);
    }
    if (at !== null && at >= -horizon)
      heap.push(at, { kind: 'release', account: acc, youth: bernoulli(rng, f.youthGiftShare) });
  }
  for (const t of checkpoints(horizon)) heap.push(t, { kind: 'tick' });
  heap.push(0, { kind: 'tick' });

  const series: TimePoint[] = [];
  const cps = new Set(checkpoints(horizon));

  /** Every offer gets an expiry tick and (usually) a simulated fan response. */
  const scheduleResponses = (produced: readonly LogEntry[]) => {
    for (const entry of produced) {
      if (entry.kind !== 'offered' || !entry.offerId) continue;
      const offer = engine.getOffer(entry.offerId);
      if (!offer) continue;
      heap.push(offer.expiresAt, { kind: 'tick' });
      if (bernoulli(rng, f.noResponseShare)) continue;
      const window = offer.expiresAt - offer.createdAt;
      const respondAt = offer.createdAt + Math.max(1, Math.round(rng() * window * 0.8));
      heap.push(Math.min(respondAt, offer.expiresAt - 1), {
        kind: 'respond',
        offerId: offer.id,
        accept: bernoulli(rng, acceptanceProbability(-offer.createdAt)),
      });
    }
  };

  while (heap.size > 0) {
    const next = heap.pop() as { priority: number; value: SimEvent };
    const at = next.priority;
    const ev = next.value;
    let produced: LogEntry[] = [];
    if (ev.kind === 'release') {
      const block = getBlock(ev.account.holder.blockId);
      produced = engine.dispatch({
        type: 'release',
        at,
        mode: ev.youth ? 'youth' : 'waitlist',
        listing: {
          holderId: ev.account.holder.holderId,
          seatIds: ev.account.seatIds,
          blockId: block.id,
          kind: block.kind,
          accessible: block.accessibleSpaces > 0 && rng() < 0.05,
          faceValue: block.faceValue,
        },
      });
    } else if (ev.kind === 'respond') {
      if (engine.getOffer(ev.offerId)?.status === 'pending') {
        produced = engine.dispatch({
          type: ev.accept ? 'accept' : 'decline',
          at,
          offerId: ev.offerId,
        });
      }
    } else {
      produced = engine.dispatch({ type: 'tick', at });
    }
    scheduleResponses(produced);
    if (ev.kind === 'tick' && cps.has(at) && series[series.length - 1]?.at !== at) {
      const s = engine.stats();
      series.push({ at, released: s.seatsReleased, refilled: s.seatsRefilled + s.seatsDonated });
    }
  }

  const s = engine.stats();
  return {
    releasedSeats: s.seatsReleased,
    refilledSeats: s.seatsRefilled,
    donatedSeats: s.seatsDonated,
    fansServed: s.fansSeated,
    medianMinutesToRefill: s.medianMinutesToRefill,
    offersMade: s.offersMade,
    series,
    fixtureId: fixture.id,
  };
}

export function simulateMatchday(options: {
  fixture: Fixture;
  scenario: Scenario;
  seed?: string;
  horizonHours?: number;
  waitlistSize?: number;
  /** Simulate only a fraction of the stadium (for fast tests). */
  scale?: number;
}): SimulationResult {
  const { fixture, scenario } = options;
  const seed = options.seed ?? 'matchday-2026';
  const horizon = (options.horizonHours ?? 72) * 60;
  const blocks = buildStadium();
  const scale = options.scale ?? 1;
  const allHolders = generateHolders(fixture, blocks);
  const holders =
    scale >= 1 ? allHolders : allHolders.filter((_, i) => i % Math.round(1 / scale) === 0);
  const forecast = forecastStadium(holders, matchContextFor(fixture), blocks);

  // Same absent fans in both scenarios — only the process differs.
  const accounts = sampleAbsent(holders, fixture, createRng(`absent:${seed}:${fixture.id}`));
  const absentSeats = accounts.reduce((a, acc) => a + acc.seatIds.length, 0);
  const rng = createRng(`${scenario}:${seed}:${fixture.id}`);
  const r =
    scenario === 'today'
      ? simulateToday(fixture, accounts, rng, horizon)
      : simulateFairSeat(
          fixture,
          accounts,
          rng,
          horizon,
          Math.round((options.waitlistSize ?? 12_000) * Math.min(1, scale * 4)),
        );

  const recovered = r.refilledSeats + r.donatedSeats;
  return {
    scenario,
    fixtureId: fixture.id,
    horizonMinutes: horizon,
    expectedAbsent: forecast.expectedAbsent,
    absentSeats,
    releasedSeats: r.releasedSeats,
    refilledSeats: r.refilledSeats,
    donatedSeats: r.donatedSeats,
    emptySeats: absentSeats - recovered,
    recoveredShare: absentSeats > 0 ? recovered / absentSeats : 0,
    fansServed: r.fansServed,
    medianMinutesToRefill: r.medianMinutesToRefill,
    offersMade: r.offersMade,
    series: r.series,
  };
}

/** Offer window table for the UI's "how it works" panel. */
export const OFFER_WINDOW_TABLE = [
  { label: 'More than 24 h before kick-off', minutes: offerWindowMinutes(24 * 60) },
  { label: '6–24 h before', minutes: offerWindowMinutes(6 * 60) },
  { label: '2–6 h before', minutes: offerWindowMinutes(2 * 60) },
  { label: '45 min – 2 h before', minutes: offerWindowMinutes(45) },
  { label: 'Last 45 minutes', minutes: offerWindowMinutes(10) },
];
