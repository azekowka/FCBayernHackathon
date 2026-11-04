import 'server-only';
import { createHmac, randomUUID } from 'node:crypto';
import {
  FIXTURES,
  applicationWeight,
  buildBallotLetterFacts,
  commitmentFor,
  entryIdFor,
  generateEntries,
  getFixture,
  getMember,
  makeDrawSeed,
  oddsForMember,
  outcomeAt,
  runDraw,
  seatAllocation,
  applicationsForRequests,
  type BallotLetterFacts,
} from '@fcb/core';
import type { CommitResponse, DrawResponse } from '@/lib/types';
import { HttpError } from './http';

/**
 * Stateless commit–reveal: seed = HMAC(DRAW_SECRET, drawId|fixtureId). The
 * server can always re-derive the seed for a draw id (works across instances),
 * but nobody can predict it from the published commitment.
 */
const SECRET = process.env.DRAW_SECRET || 'fan-ai-lab-local-draw-secret';

export function seedFor(drawId: string, fixtureId: string): string {
  const entropy = createHmac('sha256', SECRET)
    .update(`${drawId}|${fixtureId}`)
    .digest('hex')
    .slice(0, 32);
  return makeDrawSeed(fixtureId, entropy);
}

function openFixture(fixtureId: string) {
  let fixture;
  try {
    fixture = getFixture(fixtureId);
  } catch {
    throw new HttpError('not_found', 'Unknown fixture', 404);
  }
  if (!fixture.ballotOpen)
    throw new HttpError('bad_request', 'The ballot for this match is closed', 400);
  return fixture;
}

function member(memberId: string) {
  try {
    return getMember(memberId);
  } catch {
    throw new HttpError('not_found', 'Unknown member', 404);
  }
}

export function commitDraw(fixtureId: string): CommitResponse {
  const fixture = openFixture(fixtureId);
  const drawId = randomUUID();
  return {
    drawId,
    fixtureId,
    commitment: commitmentFor(seedFor(drawId, fixtureId)),
    seats: seatAllocation(fixture).memberBallot,
    expectedEntrants: Math.round(applicationsForRequests(fixture.expectedRequests)),
  };
}

interface Computed {
  response: DrawResponse;
  facts: BallotLetterFacts;
}

const cache = new Map<string, Computed>();
const CACHE_SIZE = 16;

export function performDraw(drawId: string, fixtureId: string, memberId: string): Computed {
  const key = `${drawId}|${fixtureId}|${memberId}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const fixture = openFixture(fixtureId);
  const m = member(memberId);
  const seed = seedFor(drawId, fixtureId);
  const myEntry = {
    id: entryIdFor(m.id, fixture.id),
    weight: applicationWeight(m),
    groupSize: m.groupSize,
    pechvogel: m.pechvogel,
  };
  const entries = generateEntries(fixture, { extra: [myEntry] });
  const result = runDraw(entries, seatAllocation(fixture).memberBallot, seed);
  const outcome = outcomeAt(result, entries, entries.ids.length - 1);
  const odds = oddsForMember(fixture, m);
  const facts = buildBallotLetterFacts({
    member: m,
    fixture,
    odds,
    outcome,
    result,
    upcoming: FIXTURES,
  });

  const response: DrawResponse = {
    drawId,
    fixtureId,
    memberId,
    seed,
    commitment: result.commitment,
    entrants: result.entrants,
    seatsAvailable: result.seatsAvailable,
    seatsAllocated: result.seatsAllocated,
    winners: result.winners,
    cutoffRank: result.cutoffRank,
    durationMs: Math.round(result.durationMs),
    winRateByPechvogel: result.winRateByPechvogel,
    outcome: {
      id: outcome.id,
      rank: outcome.rank,
      won: outcome.won,
      waitlistPosition: outcome.waitlistPosition,
      key: outcome.key,
      u: outcome.u,
      weight: outcome.weight,
      groupSize: outcome.groupSize,
    },
    probability: odds.probability,
    baselineProbability: odds.baselineProbability,
    pechvogelBefore: facts.pechvogelBefore,
    pechvogelAfter: facts.pechvogelAfter,
    weightAfter: facts.weightAfter,
  };
  const computed = { response, facts };
  if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value as string);
  cache.set(key, computed);
  return computed;
}
