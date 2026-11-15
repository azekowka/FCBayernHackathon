import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  AT_RISK_THRESHOLD,
  LIVE_FAN_ID,
  LIVE_HOLDER,
  LIVE_START_AT,
  OFFER_WINDOW_TABLE,
  RecyclingEngine,
  buildStadium,
  createLiveEngine,
  describeBlock,
  forecastStadium,
  generateHolders,
  getBlock,
  liveListingFor,
  matchContextFor,
  offerWindowMinutes,
  parseSeatId,
  predictNoShow,
  preferenceMatches,
  seatId,
  simulateMatchday,
  stadiumTotals,
  standForAngle,
  syntheticWaitlist,
  type HolderFeatures,
  type ListingInput,
  type RecyclingEvent,
  type WaitlistFan,
} from '../src/seats';
import { ARENA_CAPACITY, getFixture, seatAllocation } from '../src/ticketing';
import { MinHeap } from '../src/shared';

describe('stadium model', () => {
  it('adds up to the Allianz Arena capacity with ~37,500 season seats', () => {
    const totals = stadiumTotals();
    expect(totals.capacity).toBe(ARENA_CAPACITY);
    expect(totals.matchesArena).toBe(true);
    expect(totals.blocks).toBe(116);
    const target = seatAllocation({ competition: 'Bundesliga' }).seasonTickets;
    expect(Math.abs(totals.seasonSeats - target) / target).toBeLessThan(0.01);
  });

  it('puts the standing Südkurve behind the south goal', () => {
    const b112 = getBlock('112');
    expect(b112).toMatchObject({ stand: 'Süd', kind: 'standing', tier: 'lower' });
    expect(describeBlock(b112)).toBe('Block 112 · Südkurve · Unterrang (standing)');
    expect(
      buildStadium()
        .filter((b) => b.kind === 'away')
        .every((b) => b.seasonSeats === 0),
    ).toBe(true);
    expect(() => getBlock('999')).toThrow();
  });

  it('maps angles to stands and seat ids round-trip', () => {
    expect(standForAngle(0)).toBe('Ost');
    expect(standForAngle(90)).toBe('Süd');
    expect(standForAngle(180)).toBe('West');
    expect(standForAngle(270)).toBe('Nord');
    expect(standForAngle(-10)).toBe('Ost');
    expect(parseSeatId(seatId('112', 14, 23))).toEqual({ blockId: '112', row: 14, seat: 23 });
    expect(() => parseSeatId('nope')).toThrow();
  });
});

describe('explainable no-show model', () => {
  const scf = getFixture('fcb-scf-2026-11-07');
  const ctx = matchContextFor(scf);
  const holder: HolderFeatures = {
    holderId: 'H1',
    seatId: '112-R1-S1',
    blockId: '112',
    attendanceRate: 0.95,
    distanceKm: 12,
    awayCalendarSignal: false,
    optedIn: true,
  };

  it('detects midweek and late kick-offs', () => {
    expect(ctx).toMatchObject({ midweek: false, lateKickoff: false });
    expect(matchContextFor(getFixture('fcb-fch-2026-12-15'))).toMatchObject({
      midweek: true,
      lateKickoff: true,
    });
  });

  it('flags an opted-in away-calendar signal and explains it first', () => {
    const base = predictNoShow(holder, ctx);
    const away = predictNoShow({ ...holder, awayCalendarSignal: true }, ctx);
    expect(base.probability).toBeLessThan(0.1);
    expect(away.probability).toBeGreaterThan(AT_RISK_THRESHOLD);
    expect(away.contributions[0]?.feature).toBe('calendar');
  });

  it('is monotone in missed matches and distance', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 0.9, noNaN: true }),
        fc.double({ min: 0, max: 600, noNaN: true }),
        (att, dist) => {
          const p = (a: number, d: number) =>
            predictNoShow({ ...holder, attendanceRate: a, distanceKm: d }, ctx).probability;
          expect(p(att, dist)).toBeGreaterThanOrEqual(p(att + 0.1, dist));
          expect(p(att, dist + 50)).toBeGreaterThanOrEqual(p(att, dist));
        },
      ),
    );
  });

  it('forecasts more empty seats for a cold Tuesday than for Der Klassiker', () => {
    const forecast = (id: string) => {
      const f = getFixture(id);
      return forecastStadium(generateHolders(f), matchContextFor(f));
    };
    const fch = forecast('fcb-fch-2026-12-15');
    const bvb = forecast('fcb-bvb-2026-11-21');
    expect(fch.expectedAbsent).toBeGreaterThan(2 * bvb.expectedAbsent);
    expect(fch.meanProbability).toBeLessThan(0.2);
    const sum = fch.blocks.reduce((a, b) => a + b.expectedAbsent, 0);
    expect(sum).toBeCloseTo(fch.expectedAbsent, 6);
    expect(fch.nudgeable).toBeGreaterThan(0);
  });
});

const standing = (holderId: string, seats: string[]): ListingInput => ({
  holderId,
  seatIds: seats,
  blockId: '112',
  kind: 'standing',
  accessible: false,
  faceValue: 15,
});

function fan(id: string, rank: number, extra: Partial<WaitlistFan> = {}): WaitlistFan {
  return {
    id,
    name: id,
    rank,
    groupSize: 1,
    travelMinutes: 30,
    preference: 'any',
    needsAccessible: false,
    pechvogel: 0,
    ...extra,
  };
}

describe('recycling engine', () => {
  it('offers to the highest-placed fan who fits, skipping groups and seat-type mismatches', () => {
    const engine = new RecyclingEngine([
      fan('family', 1, { groupSize: 4 }),
      fan('seatedOnly', 2, { preference: 'seated' }),
      fan('mia', 3, { preference: 'standing' }),
      fan('next', 4),
    ]);
    const log = engine.dispatch({
      type: 'release',
      at: -600,
      listing: standing('sepp', ['112-R1-S1']),
    });
    expect(log.map((l) => l.kind)).toEqual(['released', 'offered']);
    const offer = engine.pendingOfferFor('mia');
    expect(offer).toBeDefined();
    expect(offer!.expiresAt - offer!.createdAt).toBe(30);
    expect(engine.fanStatus('family')).toBe('waiting');
  });

  it('refills on accept and cascades on decline and on expiry', () => {
    const engine = new RecyclingEngine([fan('a', 1), fan('b', 2), fan('c', 3)]);
    engine.dispatch({ type: 'release', at: -300, listing: standing('h', ['112-R1-S1']) });
    const o1 = engine.pendingOfferFor('a')!;
    engine.dispatch({ type: 'decline', at: -295, offerId: o1.id });
    expect(engine.fanStatus('a')).toBe('passed');
    const o2 = engine.pendingOfferFor('b')!;
    expect(o2.expiresAt).toBe(-295 + offerWindowMinutes(295));
    engine.dispatch({ type: 'tick', at: o2.expiresAt });
    expect(engine.fanStatus('b')).toBe('missed');
    const o3 = engine.pendingOfferFor('c')!;
    engine.dispatch({ type: 'accept', at: o3.expiresAt - 1, offerId: o3.id });
    expect(engine.fanStatus('c')).toBe('seated');
    const s = engine.stats();
    expect(s).toMatchObject({
      seatsReleased: 1,
      seatsRefilled: 1,
      offersMade: 3,
      offersDeclined: 1,
      offersExpired: 1,
      offersAccepted: 1,
      fansSeated: 1,
      refillRate: 1,
    });
    expect(s.medianMinutesToRefill).toBeGreaterThan(0);
  });

  it('only offers to fans who can still reach the Arena in time', () => {
    const engine = new RecyclingEngine([
      fan('far', 1, { travelMinutes: 120 }),
      fan('near', 2, { travelMinutes: 20 }),
    ]);
    engine.dispatch({ type: 'release', at: -60, listing: standing('h', ['112-R1-S1']) });
    expect(engine.pendingOfferFor('far')).toBeUndefined();
    expect(engine.pendingOfferFor('near')).toBeDefined();
  });

  it('re-lists leftover seats when a smaller group accepts', () => {
    const engine = new RecyclingEngine([fan('solo', 1), fan('other', 2)]);
    engine.dispatch({
      type: 'release',
      at: -500,
      listing: standing('h', ['112-R1-S1', '112-R1-S2']),
    });
    const offer = engine.pendingOfferFor('solo')!;
    expect(offer.seatIds).toEqual(['112-R1-S1']);
    engine.dispatch({ type: 'accept', at: -490, offerId: offer.id });
    const second = engine.pendingOfferFor('other')!;
    expect(second.seatIds).toEqual(['112-R1-S2']);
    engine.dispatch({ type: 'accept', at: -480, offerId: second.id });
    expect(engine.stats()).toMatchObject({ seatsReleased: 2, seatsRefilled: 2, fansSeated: 2 });
  });

  it('gives accessible spaces to fans who need them first', () => {
    const engine = new RecyclingEngine([
      fan('anyone', 1),
      fan('wheelchair', 5, { needsAccessible: true }),
    ]);
    engine.dispatch({
      type: 'release',
      at: -900,
      listing: { ...standing('h', ['105-R1-S1']), kind: 'seated', accessible: true },
    });
    expect(engine.pendingOfferFor('wheelchair')).toBeDefined();
    const plain = new RecyclingEngine([
      fan('wheelchair', 1, { needsAccessible: true }),
      fan('anyone', 2),
    ]);
    plain.dispatch({ type: 'release', at: -900, listing: standing('h', ['112-R1-S1']) });
    expect(plain.pendingOfferFor('anyone')).toBeDefined();
  });

  it('supports youth gifts, closes at kick-off and rejects stale events', () => {
    const engine = new RecyclingEngine([fan('far', 1, { travelMinutes: 400 })]);
    expect(
      engine.dispatch({
        type: 'release',
        at: -120,
        mode: 'youth',
        listing: standing('h1', ['112-R2-S1']),
      })[0]?.kind,
    ).toBe('donated');
    engine.dispatch({ type: 'release', at: -100, listing: standing('h2', ['112-R2-S2']) });
    expect(engine.stats().seatsSearching).toBe(1);
    engine.dispatch({ type: 'tick', at: 0 });
    expect(engine.stats()).toMatchObject({ seatsDonated: 1, seatsUnfilled: 1, seatsSearching: 0 });
    expect(
      engine.dispatch({ type: 'release', at: 5, listing: standing('h3', ['112-R2-S3']) })[0]?.kind,
    ).toBe('rejected');
    expect(engine.dispatch({ type: 'tick', at: -10 })[0]?.kind).toBe('rejected');
    expect(engine.dispatch({ type: 'accept', at: 6, offerId: 'O404' })[0]?.kind).toBe('rejected');
    expect(engine.dispatch({ type: 'release', at: 7, listing: standing('h4', []) })[0]?.kind).toBe(
      'rejected',
    );
  });

  it('refuses duplicate fans', () => {
    expect(() => new RecyclingEngine([fan('x', 1), fan('x', 2)])).toThrow(/Duplicate/);
  });

  it('keeps its invariants under arbitrary event streams and replays deterministically', () => {
    const waitlist = syntheticWaitlist(40, 'prop');
    const eventArb = fc.array(
      fc.record({
        dt: fc.integer({ min: 0, max: 90 }),
        op: fc.constantFrom('release', 'accept', 'decline', 'tick'),
        seats: fc.integer({ min: 1, max: 3 }),
        pick: fc.nat(),
      }),
      { maxLength: 60 },
    );
    fc.assert(
      fc.property(eventArb, (ops) => {
        const engine = new RecyclingEngine(waitlist);
        let t = -48 * 60;
        let seat = 0;
        for (const op of ops) {
          t += op.dt;
          if (t >= 0) break;
          if (op.op === 'release') {
            const ids = Array.from({ length: op.seats }, () => `112-R9-S${++seat}`);
            engine.dispatch({ type: 'release', at: t, listing: standing(`h${seat}`, ids) });
          } else if (op.op === 'tick') {
            engine.dispatch({ type: 'tick', at: t });
          } else {
            const pending = engine.snapshot().offers.filter((o) => o.status === 'pending');
            const target = pending[op.pick % Math.max(1, pending.length)];
            if (target) engine.dispatch({ type: op.op, at: t, offerId: target.id });
          }
        }
        const snap = engine.snapshot();
        const accepted = snap.offers.filter((o) => o.status === 'accepted');
        const seats = accepted.flatMap((o) => o.seatIds);
        expect(new Set(seats).size).toBe(seats.length);
        expect(new Set(accepted.map((o) => o.fanId)).size).toBe(accepted.length);
        expect(snap.stats.fansSeated).toBe(accepted.length);
        expect(
          snap.stats.seatsRefilled +
            snap.stats.seatsDonated +
            snap.stats.seatsUnfilled +
            snap.stats.seatsSearching,
        ).toBe(snap.stats.seatsReleased);
        for (const o of snap.offers.filter((x) => x.status === 'pending')) {
          expect(snap.fanStatus[o.fanId]).toBe('offered');
        }
        const replayed = RecyclingEngine.replay(waitlist, engine.getEvents() as RecyclingEvent[]);
        expect(replayed.snapshot()).toEqual(snap);
      }),
      { numRuns: 120 },
    );
  });

  it('exposes helpers for the UI', () => {
    expect(preferenceMatches('standing', 'seated')).toBe(false);
    expect(preferenceMatches('seated', 'family')).toBe(true);
    expect(OFFER_WINDOW_TABLE.map((r) => r.minutes)).toEqual([60, 30, 15, 8, 4]);
    const engine = new RecyclingEngine([fan('a', 1)]);
    expect(engine.nextExpiry()).toBeNull();
    engine.dispatch({ type: 'release', at: -100, listing: standing('h', ['112-R1-S1']) });
    expect(engine.nextExpiry()).toBe(-92);
    expect(engine.getFan('a')?.rank).toBe(1);
    expect(engine.getFan('zz')).toBeUndefined();
    expect(engine.getListing('L1')?.status).toBe('offered');
    expect(engine.getListing('L9')).toBeUndefined();
  });
});

describe('live two-phone scenario', () => {
  it('routes Sepp’s Südkurve seat to Mia, the first eligible fan in line', () => {
    const engine = createLiveEngine();
    const log = engine.dispatch({ type: 'release', at: LIVE_START_AT, listing: liveListingFor() });
    expect(log.at(-1)?.fanId).toBe(LIVE_FAN_ID);
    const offer = engine.pendingOfferFor(LIVE_FAN_ID)!;
    expect(offer.seatIds).toEqual(LIVE_HOLDER.seatIds);
    engine.dispatch({ type: 'accept', at: LIVE_START_AT + 1, offerId: offer.id });
    expect(engine.fanStatus(LIVE_FAN_ID)).toBe('seated');
  });
});

describe('matchday simulation', () => {
  const fixture = getFixture('fcb-scf-2026-11-07');

  it('recovers far more empty seats with Fair Seat than with today’s exchange', () => {
    const today = simulateMatchday({ fixture, scenario: 'today', scale: 0.25 });
    const fair = simulateMatchday({ fixture, scenario: 'fairseat', scale: 0.25 });
    expect(today.absentSeats).toBe(fair.absentSeats);
    expect(fair.recoveredShare).toBeGreaterThan(today.recoveredShare + 0.25);
    expect(fair.emptySeats).toBe(fair.absentSeats - fair.refilledSeats - fair.donatedSeats);
    expect(fair.medianMinutesToRefill).not.toBeNull();
    for (const r of [today, fair]) {
      for (let i = 1; i < r.series.length; i++) {
        expect(r.series[i]!.refilled).toBeGreaterThanOrEqual(r.series[i - 1]!.refilled);
        expect(r.series[i]!.at).toBeGreaterThan(r.series[i - 1]!.at);
      }
    }
  });

  it('is reproducible for a seed', () => {
    const a = simulateMatchday({ fixture, scenario: 'fairseat', scale: 0.1, seed: 's' });
    const b = simulateMatchday({ fixture, scenario: 'fairseat', scale: 0.1, seed: 's' });
    expect(a).toEqual(b);
  });
});

describe('MinHeap', () => {
  it('pops in priority order and keeps insertion order for ties', () => {
    const h = new MinHeap<string>();
    [5, 1, 3, 1, 4].forEach((p, i) => h.push(p, `${p}-${i}`));
    expect(h.peekPriority()).toBe(1);
    const out: string[] = [];
    while (h.size) out.push(h.pop()!.value);
    expect(out).toEqual(['1-1', '1-3', '3-2', '4-4', '5-0']);
    expect(h.pop()).toBeUndefined();
  });
});
