import { mean, round } from '../shared/math';
import type { LoyaltyBreakdown, MemberProfile } from './types';

/**
 * The published, human-readable loyalty rules. Every weight shown in the UI is
 * computed from exactly these constants — there is no hidden scoring.
 */
export const LOYALTY_RULES = {
  /** Every unsuccessful application adds this much weight… */
  pechvogelStep: 0.2,
  /** …counted up to this many misses (prevents hoarding). */
  pechvogelCap: 10,
  /** Each year of membership adds this much weight… */
  membershipStep: 0.05,
  /** …counted up to this many years. */
  membershipCap: 10,
  /** A win resets the Pechvogel counter to zero. */
  resetOnWin: true,
  /** The season used to count membership years. */
  seasonStartYear: 2026,
} as const;

export const MAX_WEIGHT =
  1 +
  LOYALTY_RULES.pechvogelStep * LOYALTY_RULES.pechvogelCap +
  LOYALTY_RULES.membershipStep * LOYALTY_RULES.membershipCap;

export function membershipYears(memberSince: number): number {
  return Math.max(0, LOYALTY_RULES.seasonStartYear - memberSince);
}

export function loyaltyWeight(pechvogel: number, years: number): LoyaltyBreakdown {
  const pechvogelCounted = Math.min(Math.max(0, Math.floor(pechvogel)), LOYALTY_RULES.pechvogelCap);
  const yearsCounted = Math.min(Math.max(0, Math.floor(years)), LOYALTY_RULES.membershipCap);
  const pechvogelBonus = round(pechvogelCounted * LOYALTY_RULES.pechvogelStep, 4);
  const membershipBonus = round(yearsCounted * LOYALTY_RULES.membershipStep, 4);
  return {
    base: 1,
    pechvogelBonus,
    membershipBonus,
    total: round(1 + pechvogelBonus + membershipBonus, 4),
    pechvogelCounted,
    yearsCounted,
  };
}

export function memberWeight(member: Pick<MemberProfile, 'pechvogel' | 'memberSince'>): number {
  return loyaltyWeight(member.pechvogel, membershipYears(member.memberSince)).total;
}

/**
 * A group application carries the average weight of its members, so a family
 * cannot boost a first-timer with one long-suffering applicant — and nobody is
 * punished for bringing a friend.
 */
export function applicationWeight(member: MemberProfile): number {
  const weights = [memberWeight(member)];
  for (const c of member.companions ?? []) weights.push(memberWeight(c));
  return round(mean(weights), 4);
}

export function nextPechvogel(current: number, won: boolean): number {
  if (won && LOYALTY_RULES.resetOnWin) return 0;
  return won ? current : current + 1;
}
