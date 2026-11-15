import 'server-only';
import {
  RECYCLING_FIXTURE_ID,
  buildStadium,
  describeBlock,
  forecastStadium,
  generateHolders,
  getFixture,
  getMember,
  matchContextFor,
  oddsForMember,
  planJourney,
  predictNoShow,
  simulateMatchday,
  type SimulationResult,
} from '@fcb/core';

/**
 * Deterministic, expensive computations memoised per server process. Pages
 * render them as static props; the numbers on the hub always match the demos.
 */

let simCache: { today: SimulationResult; fairseat: SimulationResult } | null = null;

export function recyclingSimulation() {
  if (!simCache) {
    const fixture = getFixture(RECYCLING_FIXTURE_ID);
    simCache = {
      today: simulateMatchday({ fixture, scenario: 'today' }),
      fairseat: simulateMatchday({ fixture, scenario: 'fairseat' }),
    };
  }
  return simCache;
}

export interface BlockRiskView {
  id: string;
  tier: 'lower' | 'middle' | 'upper';
  stand: string;
  kind: string;
  startAngle: number;
  endAngle: number;
  capacity: number;
  seasonSeats: number;
  expectedAbsent: number;
  risk: number;
  atRisk: number;
  label: string;
}

let forecastCache: {
  blocks: BlockRiskView[];
  expectedAbsent: number;
  seasonSeats: number;
  nudgeable: number;
} | null = null;

export function recyclingForecast() {
  if (!forecastCache) {
    const fixture = getFixture(RECYCLING_FIXTURE_ID);
    const stadium = buildStadium();
    const forecast = forecastStadium(
      generateHolders(fixture, stadium),
      matchContextFor(fixture),
      stadium,
    );
    const byId = new Map(forecast.blocks.map((b) => [b.blockId, b]));
    forecastCache = {
      expectedAbsent: forecast.expectedAbsent,
      seasonSeats: forecast.seasonSeats,
      nudgeable: forecast.nudgeable,
      blocks: stadium.map((b) => {
        const r = byId.get(b.id);
        return {
          id: b.id,
          tier: b.tier,
          stand: b.stand,
          kind: b.kind,
          startAngle: b.startAngle,
          endAngle: b.endAngle,
          capacity: b.capacity,
          seasonSeats: b.seasonSeats,
          expectedAbsent: r?.expectedAbsent ?? 0,
          risk: r?.risk ?? 0,
          atRisk: r?.atRisk ?? 0,
          label: describeBlock(b),
        };
      }),
    };
  }
  return forecastCache;
}

/** Sepp's explainable prediction for the stage story. */
export function seppPrediction() {
  const fixture = getFixture(RECYCLING_FIXTURE_ID);
  return predictNoShow(
    {
      holderId: 'H-sepp',
      seatId: '112-R14-S23',
      blockId: '112',
      attendanceRate: 0.9,
      distanceKm: 6,
      awayCalendarSignal: true,
      optedIn: true,
    },
    matchContextFor(fixture),
  );
}

let headlineCache: ReturnType<typeof computeHeadlines> | null = null;

function computeHeadlines() {
  const bvb = getFixture('fcb-bvb-2026-11-21');
  const lena = oddsForMember(bvb, getMember('lena'));
  const jonas = oddsForMember(bvb, getMember('jonas'));
  const sim = recyclingSimulation();
  const plan = planJourney({
    originId: 'marienplatz',
    mode: 'ubahn',
    blockId: '112',
    kickoff: getFixture(RECYCLING_FIXTURE_ID).kickoff,
  });
  const leaveNow = plan.postMatch[0];
  const rec = plan.postMatch.find((o) => o.recommended);
  const extraFans =
    sim.fairseat.refilledSeats + sim.fairseat.donatedSeats - sim.today.refilledSeats;
  return {
    ballot: {
      lenaOdds: lena.probability,
      firstTimerOdds: jonas.probability,
      multiplier: lena.loyaltyMultiplier,
    },
    recycling: {
      todayShare: sim.today.recoveredShare,
      fairShare: sim.fairseat.recoveredShare,
      extraFansPerMatch: extraFans,
      absentSeats: sim.today.absentSeats,
    },
    journey: {
      queueNow: leaveNow?.queueMinutes ?? 0,
      queueRecommended: rec?.queueMinutes ?? 0,
      stayMinutes: rec?.stayMinutes ?? 0,
    },
  };
}

export function headlines() {
  headlineCache ??= computeHeadlines();
  return headlineCache;
}
