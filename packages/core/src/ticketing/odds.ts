import { bisectIncreasing, oneIn } from '../shared/math';
import { seatAllocation } from './fixtures';
import { applicationWeight } from './loyalty';
import { entrantPopulation, type PopulationBucket } from './population';
import type { Fixture, FixtureOdds, MemberProfile } from './types';

/**
 * Odds for a weighted lottery without replacement.
 *
 * The draw gives each application an exponential "race time" E/w (E ~ Exp(1),
 * w = loyalty weight) and seats go to the fastest. For large ballots the cut-off
 * time τ is almost deterministic, so
 *
 *     P(win | w) ≈ 1 − exp(−w · τ)
 *
 * where τ solves  Σ_buckets  applications · groupSize · (1 − exp(−w · τ)) = seats.
 * Tests check this estimate against thousands of real seeded draws.
 */

export function expectedSeatsTaken(buckets: readonly PopulationBucket[], tau: number): number {
  let total = 0;
  for (const b of buckets) total += b.applications * b.groupSize * (1 - Math.exp(-b.weight * tau));
  return total;
}

export function totalSeatsRequested(buckets: readonly PopulationBucket[]): number {
  let total = 0;
  for (const b of buckets) total += b.applications * b.groupSize;
  return total;
}

export function solveThreshold(buckets: readonly PopulationBucket[], seats: number): number {
  if (seats <= 0) return 0;
  if (totalSeatsRequested(buckets) <= seats) return Number.POSITIVE_INFINITY;
  let hi = 1e-6;
  while (expectedSeatsTaken(buckets, hi) < seats) hi *= 2;
  return bisectIncreasing((t) => expectedSeatsTaken(buckets, t), seats, 0, hi);
}

export function winProbability(weight: number, tau: number): number {
  if (tau === Number.POSITIVE_INFINITY) return 1;
  return 1 - Math.exp(-weight * tau);
}

const tauCache = new Map<string, number>();

export function thresholdForFixture(fixture: Fixture): number {
  const seats = seatAllocation(fixture).memberBallot;
  const key = `${fixture.id}:${fixture.expectedRequests}:${seats}`;
  let tau = tauCache.get(key);
  if (tau === undefined) {
    tau = solveThreshold(entrantPopulation(fixture.expectedRequests), seats);
    tauCache.set(key, tau);
  }
  return tau;
}

export function oddsForWeight(fixture: Fixture, weight: number): FixtureOdds {
  const tau = thresholdForFixture(fixture);
  const ballotSeats = seatAllocation(fixture).memberBallot;
  const probability = winProbability(weight, tau);
  const baselineProbability = winProbability(1, tau);
  return {
    fixtureId: fixture.id,
    probability,
    oneIn: oneIn(probability),
    baselineProbability,
    loyaltyMultiplier: baselineProbability > 0 ? probability / baselineProbability : 1,
    weight,
    ballotSeats,
    expectedRequests: fixture.expectedRequests,
    pressure: fixture.expectedRequests / ballotSeats,
  };
}

export function oddsForMember(fixture: Fixture, member: MemberProfile): FixtureOdds {
  return oddsForWeight(fixture, applicationWeight(member));
}

/** P(at least one win) when applying to several independent draws. */
export function probabilityAtLeastOne(probabilities: readonly number[]): number {
  let miss = 1;
  for (const p of probabilities) miss *= 1 - p;
  return 1 - miss;
}
