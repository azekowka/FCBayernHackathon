import type { Fixture, SeatAllocation } from './types';

/**
 * Illustrative 2026/27 home fixtures. Dates, opponents and demand are modelled
 * for the prototype (calibrated to the published 135,000–350,000 requests per
 * home match and the 75,024-seat Allianz Arena) — not an official schedule.
 */

export const ARENA_CAPACITY = 75_024;
export const SEASON_LABEL = '2026/27';
/** The prototype's "today" so the demo is stable regardless of when it runs. */
export const DEMO_TODAY = '2026-11-04T12:00:00+01:00';

export const MIN_REQUESTS = 135_000;
export const MAX_REQUESTS = 350_000;

export function requestsForDemand(demandIndex: number): number {
  const clamped = Math.min(1, Math.max(0, demandIndex));
  return Math.round((MIN_REQUESTS + clamped * (MAX_REQUESTS - MIN_REQUESTS)) / 500) * 500;
}

function fixture(f: Omit<Fixture, 'expectedRequests'>): Fixture {
  return { ...f, expectedRequests: requestsForDemand(f.demandIndex) };
}

export const FIXTURES: readonly Fixture[] = [
  fixture({
    id: 'fcb-scf-2026-11-07',
    competition: 'Bundesliga',
    round: 'Matchday 10',
    opponent: 'SC Freiburg',
    opponentShort: 'SCF',
    kickoff: '2026-11-07T15:30:00+01:00',
    demandIndex: 0.32,
    ballotOpen: false,
    tags: ['weekend'],
  }),
  fixture({
    id: 'fcb-bvb-2026-11-21',
    competition: 'Bundesliga',
    round: 'Matchday 12',
    opponent: 'Borussia Dortmund',
    opponentShort: 'BVB',
    kickoff: '2026-11-21T18:30:00+01:00',
    demandIndex: 1,
    ballotOpen: true,
    tags: ['top-game', 'weekend', 'evening'],
    billing: 'Der Klassiker',
  }),
  fixture({
    id: 'fcb-psg-2026-11-25',
    competition: 'Champions League',
    round: 'League phase · MD 5',
    opponent: 'Paris Saint-Germain',
    opponentShort: 'PSG',
    kickoff: '2026-11-25T21:00:00+01:00',
    demandIndex: 0.95,
    ballotOpen: true,
    tags: ['top-game', 'european-night', 'midweek', 'evening'],
  }),
  fixture({
    id: 'fcb-wob-2026-12-05',
    competition: 'Bundesliga',
    round: 'Matchday 14',
    opponent: 'VfL Wolfsburg',
    opponentShort: 'WOB',
    kickoff: '2026-12-05T15:30:00+01:00',
    demandIndex: 0.22,
    ballotOpen: true,
    tags: ['weekend'],
  }),
  fixture({
    id: 'fcb-fch-2026-12-15',
    competition: 'Bundesliga',
    round: 'Matchday 15',
    opponent: '1. FC Heidenheim 1846',
    opponentShort: 'FCH',
    kickoff: '2026-12-15T20:30:00+01:00',
    demandIndex: 0,
    ballotOpen: true,
    tags: ['midweek', 'evening'],
  }),
  fixture({
    id: 'fcb-b04-2027-01-16',
    competition: 'Bundesliga',
    round: 'Matchday 18',
    opponent: 'Bayer 04 Leverkusen',
    opponentShort: 'B04',
    kickoff: '2027-01-16T18:30:00+01:00',
    demandIndex: 0.82,
    ballotOpen: true,
    tags: ['top-game', 'weekend', 'evening'],
  }),
  fixture({
    id: 'fcb-koe-2027-02-03',
    competition: 'DFB-Pokal',
    round: 'Round of 16',
    opponent: '1. FC Köln',
    opponentShort: 'KOE',
    kickoff: '2027-02-03T20:45:00+01:00',
    demandIndex: 0.4,
    ballotOpen: true,
    tags: ['cup', 'midweek', 'evening'],
  }),
  fixture({
    id: 'fcb-rbl-2027-02-13',
    competition: 'Bundesliga',
    round: 'Matchday 22',
    opponent: 'RB Leipzig',
    opponentShort: 'RBL',
    kickoff: '2027-02-13T18:30:00+01:00',
    demandIndex: 0.68,
    ballotOpen: true,
    tags: ['weekend', 'evening'],
  }),
  fixture({
    id: 'fcb-vfb-2027-03-20',
    competition: 'Bundesliga',
    round: 'Matchday 27',
    opponent: 'VfB Stuttgart',
    opponentShort: 'VFB',
    kickoff: '2027-03-20T15:30:00+01:00',
    demandIndex: 0.6,
    ballotOpen: true,
    tags: ['derby', 'weekend'],
    billing: 'Südderby',
  }),
  fixture({
    id: 'fcb-sge-2027-04-10',
    competition: 'Bundesliga',
    round: 'Matchday 29',
    opponent: 'Eintracht Frankfurt',
    opponentShort: 'SGE',
    kickoff: '2027-04-10T15:30:00+02:00',
    demandIndex: 0.5,
    ballotOpen: true,
    tags: ['weekend'],
  }),
  fixture({
    id: 'fcb-hsv-2027-05-08',
    competition: 'Bundesliga',
    round: 'Matchday 33',
    opponent: 'Hamburger SV',
    opponentShort: 'HSV',
    kickoff: '2027-05-08T15:30:00+02:00',
    demandIndex: 0.74,
    ballotOpen: true,
    tags: ['weekend', 'season-finale'],
    billing: 'Last home game',
  }),
];

export function getFixture(id: string): Fixture {
  const found = FIXTURES.find((f) => f.id === id);
  if (!found) throw new Error(`Unknown fixture: ${id}`);
  return found;
}

export function openFixtures(): Fixture[] {
  return FIXTURES.filter((f) => f.ballotOpen);
}

/** The match used for the seat-recycling demo (ballot already drawn). */
export const RECYCLING_FIXTURE_ID = 'fcb-scf-2026-11-07';

/**
 * Where the 75,024 seats go (illustrative split). Only the member-ballot share
 * is drawn; the rest is season tickets, away allocation, hospitality,
 * accessible spaces and fan-club contingents.
 */
export function seatAllocation(f: Pick<Fixture, 'competition'>): SeatAllocation {
  const seasonTickets = 37_500;
  const away = f.competition === 'Champions League' ? 3_750 : 7_500;
  const hospitality = 6_200;
  const accessible = 600;
  const fanClubs = 8_000;
  const memberBallot = ARENA_CAPACITY - seasonTickets - away - hospitality - accessible - fanClubs;
  return {
    capacity: ARENA_CAPACITY,
    seasonTickets,
    away,
    hospitality,
    accessible,
    fanClubs,
    memberBallot,
  };
}

export function fixtureLabel(f: Pick<Fixture, 'opponent'>): string {
  return `FC Bayern vs ${f.opponent}`;
}
