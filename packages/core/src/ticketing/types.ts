export type Competition = 'Bundesliga' | 'Champions League' | 'DFB-Pokal';

export type FixtureTag =
  | 'top-game'
  | 'midweek'
  | 'evening'
  | 'weekend'
  | 'derby'
  | 'european-night'
  | 'cup'
  | 'season-finale';

export interface Fixture {
  id: string;
  competition: Competition;
  /** e.g. "Matchday 12", "League phase · MD 5". */
  round: string;
  opponent: string;
  /** Three-letter code used in compact UI. */
  opponentShort: string;
  /** ISO 8601 instant with Munich offset. */
  kickoff: string;
  /** 0 (least attractive) … 1 (Der Klassiker). Drives modelled demand. */
  demandIndex: number;
  /** Seats requested in the member ballot (illustrative, calibrated to 135k–350k). */
  expectedRequests: number;
  /** True while members can still apply. */
  ballotOpen: boolean;
  tags: FixtureTag[];
  /** Optional nickname such as "Der Klassiker". */
  billing?: string;
}

export interface SeatAllocation {
  capacity: number;
  seasonTickets: number;
  away: number;
  hospitality: number;
  accessible: number;
  fanClubs: number;
  memberBallot: number;
}

export type Preference = 0 | 1 | 2 | 3;

export interface MemberProfile {
  id: string;
  name: string;
  firstName: string;
  memberSince: number;
  /** Unsuccessful applications since the member's last win (the visible "Pechvogel" counter). */
  pechvogel: number;
  city: string;
  country: string;
  /** BCP-47 language the member wants letters in. */
  language: string;
  /** Seats per application (1 = solo, >1 = group/family). */
  groupSize: number;
  /** Pechvogel counters of the other group members, used for the group weight. */
  companions?: { name: string; pechvogel: number; memberSince: number }[];
  fanClub?: string;
  persona: string;
  /** 0 = not interested … 3 = must-see. */
  preferences: Record<string, Preference>;
  avatarHue: number;
}

export interface LoyaltyBreakdown {
  base: number;
  pechvogelBonus: number;
  membershipBonus: number;
  total: number;
  pechvogelCounted: number;
  yearsCounted: number;
}

export interface FixtureOdds {
  fixtureId: string;
  /** Probability the member's application wins (0–1). */
  probability: number;
  /** Rounded "1 in N". */
  oneIn: number;
  /** Probability for a first-time applicant (weight 1.0) — the baseline. */
  baselineProbability: number;
  /** probability / baselineProbability. */
  loyaltyMultiplier: number;
  weight: number;
  ballotSeats: number;
  expectedRequests: number;
  /** Seats requested per seat available. */
  pressure: number;
}
