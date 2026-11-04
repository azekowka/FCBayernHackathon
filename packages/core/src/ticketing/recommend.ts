import { oneIn } from '../shared/math';
import { probabilityAtLeastOne } from './odds';
import type { Fixture, FixtureOdds, Preference } from './types';

/**
 * "Apply smart": with a limited number of applications per phase, which
 * matches give a fan the best chance of actually getting into the Arena?
 * Draws are independent, so P(≥1 win) = 1 − Π(1 − pᵢ).
 */

export type Strategy = 'at-least-one' | 'favourites';

export interface ApplicationPick {
  fixtureId: string;
  probability: number;
  preference: Preference;
  reason: string;
}

export interface StrategyResult {
  picks: ApplicationPick[];
  pAtLeastOne: number;
  expectedMatches: number;
  /** Σ preference × probability — "expected joy". */
  expectedJoy: number;
}

export interface Recommendation {
  strategy: Strategy;
  maxApplications: number;
  smart: StrategyResult;
  /** What most fans do today: apply for the biggest games. */
  naive: StrategyResult;
  /** Percentage-point gain in P(≥1 match) of smart over naive. */
  uplift: number;
}

interface Candidate {
  fixture: Fixture;
  odds: FixtureOdds;
  preference: Preference;
}

function reasonFor(c: Candidate): string {
  const parts: string[] = [`1 in ${oneIn(c.odds.probability)}`];
  if (c.fixture.tags.includes('midweek')) parts.push('midweek kick-off draws fewer applicants');
  else if (c.odds.pressure < 12) parts.push(`only ${c.odds.pressure.toFixed(1)} requests per seat`);
  else if (c.fixture.tags.includes('top-game')) parts.push('top game — heavy demand');
  if (c.odds.loyaltyMultiplier >= 1.5)
    parts.push(`your loyalty ×${c.odds.loyaltyMultiplier.toFixed(1)} applies`);
  if (c.preference === 3) parts.push('on your must-see list');
  return parts.join(' · ');
}

function summarise(selected: Candidate[]): StrategyResult {
  const picks = selected.map((c) => ({
    fixtureId: c.fixture.id,
    probability: c.odds.probability,
    preference: c.preference,
    reason: reasonFor(c),
  }));
  const ps = picks.map((p) => p.probability);
  return {
    picks,
    pAtLeastOne: probabilityAtLeastOne(ps),
    expectedMatches: ps.reduce((a, b) => a + b, 0),
    expectedJoy: picks.reduce((a, p) => a + p.preference * p.probability, 0),
  };
}

export function recommendApplications(input: {
  fixtures: readonly Fixture[];
  odds: readonly FixtureOdds[];
  preferences: Readonly<Record<string, Preference>>;
  maxApplications?: number;
  strategy?: Strategy;
}): Recommendation {
  const maxApplications = Math.max(1, input.maxApplications ?? 3);
  const strategy = input.strategy ?? 'at-least-one';
  const oddsById = new Map(input.odds.map((o) => [o.fixtureId, o]));

  const open = input.fixtures.filter((f) => f.ballotOpen && oddsById.has(f.id));
  const hasPrefs = open.some((f) => (input.preferences[f.id] ?? 0) > 0);
  const candidates: Candidate[] = open
    .map((fixture) => ({
      fixture,
      odds: oddsById.get(fixture.id) as FixtureOdds,
      preference: (input.preferences[fixture.id] ?? (hasPrefs ? 0 : 1)) as Preference,
    }))
    .filter((c) => c.preference > 0);

  const smartSorted = [...candidates].sort((a, b) => {
    const score = (c: Candidate) =>
      strategy === 'at-least-one' ? c.odds.probability : c.preference * c.odds.probability;
    return (
      score(b) - score(a) ||
      b.preference - a.preference ||
      a.fixture.kickoff.localeCompare(b.fixture.kickoff)
    );
  });
  const naiveSorted = [...candidates].sort(
    (a, b) =>
      b.fixture.demandIndex - a.fixture.demandIndex ||
      a.fixture.kickoff.localeCompare(b.fixture.kickoff),
  );

  const smart = summarise(smartSorted.slice(0, maxApplications));
  const naive = summarise(naiveSorted.slice(0, maxApplications));
  return { strategy, maxApplications, smart, naive, uplift: smart.pAtLeastOne - naive.pAtLeastOne };
}
