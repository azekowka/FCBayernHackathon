import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  AMENITIES,
  DISRUPTIONS,
  ORIGINS,
  availableModes,
  bestAmenity,
  crowdLevel,
  gateWait,
  getOrigin,
  googleMapsUrl,
  inboundAt,
  inboundCurve,
  kioskQueue,
  legsDistance,
  legsMinutes,
  nearestAmenity,
  outboundCurve,
  outboundWait,
  planJourney,
  type JourneyRequest,
  type Mode,
} from '../src/journey';
import { buildStadium, getBlock } from '../src/seats';
import { getFixture } from '../src/ticketing';

const kickoff = getFixture('fcb-scf-2026-11-07').kickoff;
const base: JourneyRequest = { originId: 'marienplatz', mode: 'ubahn', blockId: '112', kickoff };

describe('network', () => {
  it('offers at least two ways to the Arena from every origin', () => {
    for (const o of ORIGINS) {
      expect(availableModes(o).length).toBeGreaterThanOrEqual(2);
      for (const m of availableModes(o)) {
        const legs = o.routes[m]!;
        expect(legsMinutes(legs)).toBeGreaterThan(10);
        expect(legsDistance(legs)).toBeGreaterThan(0);
      }
    }
    expect(() => getOrigin('mars')).toThrow();
  });

  it('builds Google Maps deep links with the right travel mode', () => {
    const url = new URL(googleMapsUrl(getOrigin('hbf'), 'bike'));
    expect(url.hostname).toBe('www.google.com');
    expect(url.searchParams.get('travelmode')).toBe('bicycling');
    expect(url.searchParams.get('destination')).toMatch(/Allianz Arena/);
    expect(new URL(googleMapsUrl(getOrigin('hbf'), 'ubahn')).searchParams.get('travelmode')).toBe(
      'transit',
    );
    expect(new URL(googleMapsUrl(getOrigin('hbf'), 'car')).searchParams.get('travelmode')).toBe(
      'driving',
    );
    expect(
      new URL(googleMapsUrl(getOrigin('schwabing'), 'walk')).searchParams.get('travelmode'),
    ).toBe('walking');
  });
});

describe('crowd model', () => {
  it('peaks the inbound U6 about an hour before kick-off', () => {
    const curve = inboundCurve();
    const peak = curve.reduce((a, p) => (p.load > a.load ? p : a));
    expect(peak.at).toBeGreaterThan(-75);
    expect(peak.at).toBeLessThan(-35);
    expect(inboundAt(-150).level).toBe('calm');
    expect(inboundAt(-9999).at).toBe(-180);
    expect(inboundAt(9999).at).toBe(0);
  });

  it('rewards a staggered return: waiting 30 minutes cuts the queue sharply', () => {
    const leaveNow = outboundWait(21);
    expect(leaveNow).toBeGreaterThan(15);
    expect(outboundWait(51)).toBeLessThan(leaveNow / 3);
    expect(outboundWait(80)).toBeLessThan(1);
    const curve = outboundCurve();
    expect(curve[0]!.waitMinutes).toBe(0);
    expect(outboundWait(-5)).toBe(0);
  });

  it('maps loads to crowd levels', () => {
    expect([0.2, 0.7, 0.95, 1.3].map(crowdLevel)).toEqual(['calm', 'busy', 'packed', 'crush']);
  });

  it('scales with disruption factors', () => {
    expect(inboundAt(-55, 1.08).waitMinutes).toBeGreaterThan(inboundAt(-55).waitMinutes);
    expect(outboundWait(30, 1, 0.75)).toBeGreaterThan(outboundWait(30));
    expect(gateWait(-30, 0.27)).toBeGreaterThanOrEqual(0);
  });

  it('models the half-time crush at the kiosks', () => {
    expect(kioskQueue(50, 1)).toBeGreaterThan(kioskQueue(20, 1) * 3);
    expect(kioskQueue(-28, 1)).toBeGreaterThan(kioskQueue(-120, 1));
  });
});

describe('venue guidance', () => {
  it('beats the nearest kiosk by routing to a quieter one', () => {
    for (const blockId of ['112', '205', '330']) {
      const block = getBlock(blockId);
      const best = bestAmenity(block, 'kiosk', -28);
      const near = nearestAmenity(block, 'kiosk', -28);
      expect(best.totalMinutes).toBeLessThanOrEqual(near.totalMinutes + 1e-9);
      expect(best.walkMinutes).toBeGreaterThanOrEqual(1);
    }
    expect(AMENITIES.filter((a) => a.kind === 'toilet').length).toBe(24);
  });
});

describe('journey planner', () => {
  it('gets the fan into the seat on time with a coherent timeline', () => {
    const plan = planJourney(base);
    const seat = plan.timeline.find((s) => s.kind === 'seat')!;
    expect(seat.at).toBeLessThanOrEqual(-20);
    expect(plan.chosen.mode).toBe('ubahn');
    expect(plan.chosen.departAt + plan.chosen.doorToSeatMinutes).toBe(plan.chosen.seatedAt);
    const kinds = plan.timeline.map((s) => s.kind);
    for (const k of [
      'depart',
      'ride',
      'gate',
      'food',
      'seat',
      'kickoff',
      'halftime',
      'fulltime',
      'home',
    ] as const) {
      expect(kinds).toContain(k);
    }
    for (let i = 1; i < plan.timeline.length; i++) {
      expect(plan.timeline[i]!.at).toBeGreaterThanOrEqual(plan.timeline[i - 1]!.at);
    }
    expect(plan.facts.departClock).toMatch(/^\d{2}:\d{2}$/);
    expect(plan.facts.kickoffClock).toBe('15:30');
    expect(plan.googleMapsUrl).toContain('travelmode=transit');
    expect(plan.inboundCurve.length).toBeGreaterThan(30);
    expect(plan.outboundCurve.length).toBeGreaterThan(30);
  });

  it('recommends staying for the post-match show when it saves queueing', () => {
    const plan = planJourney(base);
    const rec = plan.postMatch.find((o) => o.recommended)!;
    const now = plan.postMatch[0]!;
    expect(rec.stayMinutes).toBeGreaterThan(0);
    expect(rec.queueMinutes).toBeLessThan(now.queueMinutes / 2);
    expect(plan.facts.postMatch.queueIfLeavingNow).toBe(Math.round(now.queueMinutes));
    expect(plan.green.points).toBe(25);
    expect(plan.timeline.some((s) => s.kind === 'postmatch')).toBe(true);
  });

  it('honours asap and relaxed post-match preferences', () => {
    const asap = planJourney({ ...base, preferences: { postMatch: 'asap' } });
    expect(asap.postMatch.find((o) => o.recommended)?.stayMinutes).toBe(0);
    expect(asap.timeline.some((s) => s.kind === 'postmatch')).toBe(false);
    const relaxed = planJourney({ ...base, preferences: { postMatch: 'relaxed' } });
    expect(relaxed.postMatch.find((o) => o.recommended)?.stayMinutes).toBe(30);
  });

  it('re-plans around a strike and explains why', () => {
    const plan = planJourney({ ...base, disruption: 'u6-strike' });
    expect(plan.chosen.mode).not.toBe('ubahn');
    expect(plan.alerts[0]).toMatchObject({
      severity: 'critical',
      title: DISRUPTIONS['u6-strike'].title,
    });
    expect(plan.alerts.some((a) => /isn't an option/.test(a.title))).toBe(true);
    expect(plan.facts.switchedFrom).toBe('U-Bahn (U6)');
    expect(plan.chosen.legs.every((l) => l.kind !== 'ubahn')).toBe(true);
  });

  it('walks fans from Kieferngarten when the northern U6 section is closed', () => {
    const plan = planJourney({ ...base, disruption: 'u6-north-closure' });
    expect(plan.chosen.legs.some((l) => l.from === 'Kieferngarten')).toBe(true);
    const normal = planJourney(base);
    expect(plan.chosen.departAt).toBeLessThanOrEqual(normal.chosen.departAt);
    const garching = planJourney({ ...base, originId: 'garching', disruption: 'u6-north-closure' });
    expect(garching.chosen.legs.some((l) => l.to === 'Garching-Hochbrück')).toBe(true);
    for (const p of [plan, garching]) {
      expect(p.chosen.legs.some((l) => l.from === 'Fröttmaning')).toBe(false);
      expect(p.chosen.legs.filter((l) => l.to === 'Esplanade')).toHaveLength(1);
    }
  });

  it('suggests the U6 when a cyclist faces heavy rain', () => {
    const plan = planJourney({ ...base, mode: 'bike', disruption: 'heavy-rain' });
    expect(plan.chosen.mode).toBe('bike');
    expect(plan.alerts.some((a) => a.title.startsWith('Consider'))).toBe(true);
  });

  it('routes step-free fans to a step-free entrance', () => {
    const north = buildStadium().find((b) => b.entrance === 'Nord' && b.tier === 'lower')!;
    const plan = planJourney({ ...base, blockId: north.id, preferences: { stepFree: true } });
    expect(plan.entrance.stepFree).toBe(true);
    expect(plan.alerts.some((a) => a.title.startsWith('Step-free'))).toBe(true);
  });

  it('handles the fan-club bus and scores green travel', () => {
    const bus = planJourney({ ...base, originId: 'rosenheim', mode: 'fanbus' });
    expect(bus.postMatch).toHaveLength(1);
    expect(bus.green.co2SavedKg).toBeGreaterThan(10);
    const car = planJourney({ ...base, mode: 'car', preferences: { postMatch: 'asap' } });
    const bike = planJourney({ ...base, mode: 'bike' });
    expect(bike.green.points).toBeGreaterThan(car.green.points);
    expect(car.green.co2SavedKg).toBe(0);
  });

  it('rejects unknown origins and blocks', () => {
    expect(() => planJourney({ ...base, originId: 'x' })).toThrow();
    expect(() => planJourney({ ...base, blockId: '999' })).toThrow();
  });

  it('always seats the fan on time for any origin, mode, block and target', () => {
    const blocks = buildStadium()
      .filter((b) => b.seasonSeats > 0)
      .map((b) => b.id);
    fc.assert(
      fc.property(
        fc.constantFrom(...ORIGINS.map((o) => o.id)),
        fc.constantFrom(...blocks),
        fc.integer({ min: 10, max: 60 }),
        fc.boolean(),
        fc.boolean(),
        (originId, blockId, seatedBy, wantsFood, withKids) => {
          const modes = availableModes(getOrigin(originId));
          for (const mode of modes as Mode[]) {
            const plan = planJourney({
              originId,
              mode,
              blockId,
              kickoff,
              preferences: { seatedBy, wantsFood, withKids },
            });
            expect(plan.chosen.seatedAt).toBeLessThanOrEqual(-seatedBy);
            for (let i = 1; i < plan.timeline.length; i++) {
              expect(plan.timeline[i]!.at).toBeGreaterThanOrEqual(plan.timeline[i - 1]!.at);
            }
          }
        },
      ),
      { numRuns: 40 },
    );
  });
});
