import { oneIn } from '../shared/math';
import { formatMatchDate, clockAt } from '../shared/time';
import type { DrawResult, EntryOutcome } from './draw';
import { fixtureLabel } from './fixtures';
import { applicationWeight, loyaltyWeight, membershipYears, nextPechvogel } from './loyalty';
import { oddsForWeight } from './odds';
import type { Fixture, FixtureOdds, MemberProfile } from './types';

/**
 * Structured facts for the result letter. The language model only turns these
 * facts into friendly prose — it never decides or invents numbers.
 */
export interface BallotLetterFacts {
  memberName: string;
  firstName: string;
  language: string;
  fixture: string;
  competition: string;
  kickoff: string;
  won: boolean;
  groupSize: number;
  probabilityBefore: number;
  oneInBefore: number;
  drawPosition: number;
  entrants: number;
  seatsAvailable: number;
  winners: number;
  waitlistPosition: number | null;
  weightBefore: number;
  pechvogelBefore: number;
  pechvogelAfter: number;
  weightAfter: number;
  nextBest: { fixture: string; kickoff: string; probability: number; oneIn: number }[];
  commitment: string;
  seed: string;
}

export function buildBallotLetterFacts(input: {
  member: MemberProfile;
  fixture: Fixture;
  odds: FixtureOdds;
  outcome: EntryOutcome;
  result: DrawResult;
  upcoming: readonly Fixture[];
}): BallotLetterFacts {
  const { member, fixture, odds, outcome, result } = input;
  const pechvogelAfter = nextPechvogel(member.pechvogel, outcome.won);
  const afterMember: MemberProfile = { ...member, pechvogel: pechvogelAfter };
  const weightAfter = applicationWeight(afterMember);

  const nextBest = input.upcoming
    .filter((f) => f.ballotOpen && f.id !== fixture.id && (member.preferences[f.id] ?? 0) > 0)
    .map((f) => ({ f, o: oddsForWeight(f, weightAfter) }))
    .sort((a, b) => b.o.probability - a.o.probability)
    .slice(0, 2)
    .map(({ f, o }) => ({
      fixture: fixtureLabel(f),
      kickoff: `${formatMatchDate(f.kickoff)}, ${clockAt(f.kickoff, 0)}`,
      probability: o.probability,
      oneIn: oneIn(o.probability),
    }));

  return {
    memberName: member.name,
    firstName: member.firstName,
    language: member.language,
    fixture: fixtureLabel(fixture),
    competition: `${fixture.competition} · ${fixture.round}`,
    kickoff: `${formatMatchDate(fixture.kickoff)}, ${clockAt(fixture.kickoff, 0)}`,
    won: outcome.won,
    groupSize: outcome.groupSize,
    probabilityBefore: odds.probability,
    oneInBefore: oneIn(odds.probability),
    drawPosition: outcome.rank,
    entrants: result.entrants,
    seatsAvailable: result.seatsAvailable,
    winners: result.winners,
    waitlistPosition: outcome.waitlistPosition,
    weightBefore: odds.weight,
    pechvogelBefore: member.pechvogel,
    pechvogelAfter,
    weightAfter,
    nextBest,
    commitment: result.commitment,
    seed: result.seed,
  };
}

/** Plain explanation of a member's own weight, for the "why" panel. */
export function explainWeight(member: MemberProfile): string[] {
  const b = loyaltyWeight(member.pechvogel, membershipYears(member.memberSince));
  const lines = [`Everyone starts at 1.00.`];
  lines.push(
    b.pechvogelCounted > 0
      ? `+${b.pechvogelBonus.toFixed(2)} for ${b.pechvogelCounted} unsuccessful application${b.pechvogelCounted === 1 ? '' : 's'} (0.20 each, max 10).`
      : `+0.00 — no unsuccessful applications since the last win.`,
  );
  lines.push(
    `+${b.membershipBonus.toFixed(2)} for ${b.yearsCounted} year${b.yearsCounted === 1 ? '' : 's'} of membership (0.05 each, max 10).`,
  );
  if ((member.companions?.length ?? 0) > 0) {
    lines.push(`Group application: the weight is the average of all ${member.groupSize} members.`);
  }
  return lines;
}
