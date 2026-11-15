import { RECYCLING_FIXTURE_ID } from '../ticketing/fixtures';
import { RecyclingEngine, type ListingInput, type WaitlistFan } from './engine';
import { getBlock } from './stadium';

/**
 * The scripted two-phone stage demo: Sepp (season ticket, Südkurve) is away
 * in Hamburg on Saturday; Mia (waitlist, Garching) gets his seat seconds later.
 * The two fans ahead of her in line show the matching rules at work.
 */

export const LIVE_FIXTURE_ID = RECYCLING_FIXTURE_ID;
/** Friday 13:30 — 26 hours before Saturday's 15:30 kick-off. */
export const LIVE_START_AT = -26 * 60;

export interface LiveHolder {
  id: string;
  name: string;
  firstName: string;
  seasonTicketSince: number;
  city: string;
  seatIds: string[];
  blockId: string;
  calendarNote: string;
  language: string;
}

export const LIVE_HOLDER: LiveHolder = {
  id: 'sepp',
  name: 'Sepp Brandl',
  firstName: 'Sepp',
  seasonTicketSince: 1998,
  city: 'München-Giesing',
  seatIds: ['112-R14-S23'],
  blockId: '112',
  calendarNote: 'Trade fair in Hamburg, Fri–Sun (from your calendar, opt-in)',
  language: 'de',
};

export const LIVE_FAN_ID = 'mia';

export const LIVE_WAITLIST: readonly WaitlistFan[] = [
  {
    id: 'huber-group',
    name: 'Familie Huber',
    rank: 1,
    groupSize: 4,
    travelMinutes: 70,
    preference: 'seated',
    needsAccessible: false,
    pechvogel: 4,
  },
  {
    id: 'elif',
    name: 'Elif Yılmaz',
    rank: 2,
    groupSize: 1,
    travelMinutes: 25,
    preference: 'seated',
    needsAccessible: false,
    pechvogel: 6,
  },
  {
    id: 'mia',
    name: 'Mia Schneider',
    rank: 3,
    groupSize: 1,
    travelMinutes: 35,
    preference: 'standing',
    needsAccessible: false,
    pechvogel: 9,
  },
  {
    id: 'jonas',
    name: 'Jonas Weber',
    rank: 4,
    groupSize: 1,
    travelMinutes: 30,
    preference: 'any',
    needsAccessible: false,
    pechvogel: 1,
  },
  {
    id: 'kofi',
    name: 'Kofi Mensah',
    rank: 5,
    groupSize: 1,
    travelMinutes: 40,
    preference: 'any',
    needsAccessible: false,
    pechvogel: 2,
  },
];

export const LIVE_FAN_PROFILES: Record<
  string,
  { city: string; drawPosition: number; note: string }
> = {
  'huber-group': { city: 'Rosenheim', drawPosition: 1_187, note: 'Needs 4 seats together' },
  elif: { city: 'Haidhausen', drawPosition: 1_195, note: 'Seated only' },
  mia: {
    city: 'Garching',
    drawPosition: 1_204,
    note: 'Standing, solo — 9 unsuccessful applications',
  },
  jonas: { city: 'Garching', drawPosition: 1_219, note: 'First season as a member' },
  kofi: { city: 'Accra → München', drawPosition: 1_233, note: 'In town for two weeks' },
};

export function liveListingFor(holder: LiveHolder = LIVE_HOLDER): ListingInput {
  const block = getBlock(holder.blockId);
  return {
    holderId: holder.id,
    seatIds: [...holder.seatIds],
    blockId: block.id,
    kind: block.kind,
    accessible: false,
    faceValue: block.faceValue,
  };
}

export function createLiveEngine(): RecyclingEngine {
  return new RecyclingEngine(LIVE_WAITLIST);
}
