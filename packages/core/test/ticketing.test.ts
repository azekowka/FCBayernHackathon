import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ARENA_CAPACITY,
  DEMO_MEMBERS,
  FIXTURES,
  LOYALTY_RULES,
  MAX_REQUESTS,
  MIN_REQUESTS,
  applicationWeight,
  buildBallotLetterFacts,
  commitmentFor,
  entrantPopulation,
  entryColumnsFrom,
  entryIdFor,
  entryKey,
  expectedSeatsTaken,
  explainWeight,
  generateEntries,
  getFixture,
  getMember,
  loyaltyWeight,
  makeDrawSeed,
  memberWeight,
  nextPechvogel,
  oddsForMember,
  oddsForWeight,
  openFixtures,
  outcomeAt,
  probabilityAtLeastOne,
  recommendApplications,
  runDraw,
  seatAllocation,
  solveThreshold,
  verifyCommitment,
  verifyEntry,
  waitlistHead,
  winProbability,
  type DrawEntry,
} from '../src/ticketing';

describe('loyalty weights (published rules)', () => {
  it('starts everyone at 1.0 and caps both bonuses', () => {
    expect(loyaltyWeight(0, 0).total).toBe(1);
    expect(loyaltyWeight(7, 14)).toMatchObject({
      pechvogelBonus: 1.4,
      membershipBonus: 0.5,
      total: 2.9,
      pechvogelCounted: 7,
      yearsCounted: 10,
    });
    expect(loyaltyWeight(99, 99).total).toBe(
      1 +
        LOYALTY_RULES.pechvogelStep * LOYALTY_RULES.pechvogelCap +
        LOYALTY_RULES.membershipStep * LOYALTY_RULES.membershipCap,
    );
    expect(loyaltyWeight(-3, -1).total).toBe(1);
  });

  it('uses the average weight for group applications', () => {
    const huber = getMember('huber');
    const solo = memberWeight(huber);
    expect(applicationWeight(huber)).toBeLessThan(solo);
    expect(applicationWeight(getMember('lena'))).toBe(memberWeight(getMember('lena')));
  });

  it('resets the Pechvogel counter on a win and increments on a miss', () => {
    expect(nextPechvogel(7, true)).toBe(0);
    expect(nextPechvogel(7, false)).toBe(8);
  });

  it('explains a weight in plain language', () => {
    const lines = explainWeight(getMember('huber'));
    expect(lines.join(' ')).toMatch(/average of all 4 members/);
    expect(explainWeight(getMember('jonas')).join(' ')).toMatch(/no unsuccessful applications/);
  });
});

describe('fixtures & seat allocation', () => {
  it('keeps modelled demand inside the published 135k–350k range', () => {
    for (const f of FIXTURES) {
      expect(f.expectedRequests).toBeGreaterThanOrEqual(MIN_REQUESTS);
      expect(f.expectedRequests).toBeLessThanOrEqual(MAX_REQUESTS);
    }
    expect(getFixture('fcb-bvb-2026-11-21').expectedRequests).toBe(MAX_REQUESTS);
    expect(() => getFixture('nope')).toThrow();
    expect(openFixtures().every((f) => f.ballotOpen)).toBe(true);
  });

  it('allocates exactly the arena capacity', () => {
    for (const f of FIXTURES) {
      const a = seatAllocation(f);
      const total =
        a.seasonTickets + a.away + a.hospitality + a.accessible + a.fanClubs + a.memberBallot;
      expect(total).toBe(ARENA_CAPACITY);
      expect(a.memberBallot).toBeGreaterThan(10_000);
    }
    expect(seatAllocation({ competition: 'Champions League' }).memberBallot).toBeGreaterThan(
      seatAllocation({ competition: 'Bundesliga' }).memberBallot,
    );
  });
});

describe('odds estimator', () => {
  const bvb = getFixture('fcb-bvb-2026-11-21');
  const fch = getFixture('fcb-fch-2026-12-15');

  it('solves the threshold so expected seats equal available seats', () => {
    const buckets = entrantPopulation(bvb.expectedRequests);
    const seats = seatAllocation(bvb).memberBallot;
    const tau = solveThreshold(buckets, seats);
    expect(expectedSeatsTaken(buckets, tau)).toBeCloseTo(seats, 3);
  });

  it('gives everyone a seat when supply exceeds demand', () => {
    const buckets = entrantPopulation(1_000);
    expect(solveThreshold(buckets, 5_000)).toBe(Number.POSITIVE_INFINITY);
    expect(winProbability(1, Number.POSITIVE_INFINITY)).toBe(1);
    expect(solveThreshold(buckets, 0)).toBe(0);
  });

  it('is monotone in weight and rewards loyalty without guaranteeing a win', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 3.4, noNaN: true }),
        fc.double({ min: 0.01, max: 0.1, noNaN: true }),
        (w, dw) => {
          const lo = oddsForWeight(bvb, w).probability;
          const hi = oddsForWeight(bvb, w + dw).probability;
          expect(hi).toBeGreaterThan(lo);
          expect(hi).toBeLessThan(1);
        },
      ),
    );
    const lena = oddsForMember(bvb, getMember('lena'));
    const jonas = oddsForMember(bvb, getMember('jonas'));
    expect(lena.loyaltyMultiplier).toBeGreaterThan(2);
    expect(jonas.loyaltyMultiplier).toBeCloseTo(1, 6);
    expect(lena.probability).toBeGreaterThan(jonas.probability);
  });

  it('makes low-demand midweek games markedly easier than Der Klassiker', () => {
    const lena = getMember('lena');
    expect(oddsForMember(fch, lena).probability).toBeGreaterThan(
      2 * oddsForMember(bvb, lena).probability,
    );
  });

  it('combines independent draws correctly', () => {
    expect(probabilityAtLeastOne([])).toBe(0);
    expect(probabilityAtLeastOne([0.5, 0.5])).toBeCloseTo(0.75, 12);
  });
});

function smallEntries(n: number, seed = 'pop'): DrawEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `E${i}`,
    weight: 1 + (i % 7) * 0.3,
    groupSize: 1 + (i % 4),
    pechvogel: i % 11,
  })).map((e) => ({ ...e, id: `${seed}-${e.id}` }));
}

describe('verifiable weighted draw', () => {
  it('is deterministic for a seed and changes with the seed', () => {
    const entries = entryColumnsFrom(smallEntries(500));
    const a = runDraw(entries, 120, 'seed-a');
    const b = runDraw(entries, 120, 'seed-a');
    const c = runDraw(entries, 120, 'seed-b');
    expect(Array.from(a.won)).toEqual(Array.from(b.won));
    expect(Array.from(a.won)).not.toEqual(Array.from(c.won));
  });

  it('never exceeds the seats and never splits a group', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            weight: fc.double({ min: 0.5, max: 4, noNaN: true }),
            groupSize: fc.integer({ min: 1, max: 4 }),
          }),
          { minLength: 1, maxLength: 200 },
        ),
        fc.integer({ min: 0, max: 300 }),
        fc.string({ minLength: 1, maxLength: 12 }),
        (raw, seats, seed) => {
          const entries = entryColumnsFrom(raw.map((r, i) => ({ id: `x${i}`, ...r })));
          const result = runDraw(entries, seats, seed);
          let allocated = 0;
          for (let i = 0; i < raw.length; i++) if (result.won[i]) allocated += raw[i]!.groupSize;
          expect(allocated).toBe(result.seatsAllocated);
          expect(allocated).toBeLessThanOrEqual(seats);
          // Every loser either did not fit or seats ran out before them.
          const waitlisted = Array.from(result.waitlistPosition)
            .filter((p) => p > 0)
            .sort((x, y) => x - y);
          expect(waitlisted).toEqual(waitlisted.map((_, k) => k + 1));
          expect(result.winners + waitlisted.length).toBe(raw.length);
        },
      ),
      { numRuns: 150 },
    );
  });

  it('cannot be influenced by the order of the entry list', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1_000_000 }), (shuffleSeed) => {
        const base = smallEntries(300, 'perm');
        const shuffled = [...base];
        let s = shuffleSeed;
        for (let i = shuffled.length - 1; i > 0; i--) {
          s = (s * 1103515245 + 12345) % 2147483648;
          const j = s % (i + 1);
          [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
        }
        const winnersOf = (list: DrawEntry[]) => {
          const cols = entryColumnsFrom(list);
          const r = runDraw(cols, 140, 'fixed-seed');
          return list
            .filter((_, i) => r.won[i])
            .map((e) => e.id)
            .sort();
        };
        expect(winnersOf(shuffled)).toEqual(winnersOf(base));
      }),
      { numRuns: 25 },
    );
  });

  it('publishes a commitment that only the real seed satisfies', () => {
    const seed = makeDrawSeed('fcb-bvb-2026-11-21', 'deadbeef');
    const commitment = commitmentFor(seed);
    expect(commitment).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyCommitment(seed, commitment)).toBe(true);
    expect(verifyCommitment(seed, commitment.toUpperCase())).toBe(true);
    expect(verifyCommitment(`${seed}0`, commitment)).toBe(false);
  });

  it('lets any entrant re-verify their own key', () => {
    const entries = entryColumnsFrom(smallEntries(50));
    const result = runDraw(entries, 10, 'verify-seed');
    const outcome = outcomeAt(result, entries, 7);
    const check = verifyEntry(result.seed, result.commitment, outcome);
    expect(check).toMatchObject({ commitmentValid: true, keyValid: true });
    expect(
      verifyEntry(result.seed, result.commitment, { ...outcome, key: outcome.key * 1.01 }).keyValid,
    ).toBe(false);
    expect(() => outcomeAt(result, entries, 999)).toThrow(RangeError);
    expect(() => entryKey('s', 'id', 0)).toThrow();
  });

  it('turns the losers into an ordered waitlist', () => {
    const entries = entryColumnsFrom(smallEntries(200));
    const result = runDraw(entries, 60, 'wl-seed');
    const head = waitlistHead(result, entries, 25);
    expect(head).toHaveLength(25);
    head.forEach((o, k) => {
      expect(o.won).toBe(false);
      expect(o.waitlistPosition).toBe(k + 1);
    });
    for (let k = 1; k < head.length; k++) expect(head[k]!.rank).toBeGreaterThan(head[k - 1]!.rank);
  });

  it('matches the odds estimator across many seeded draws (calibration)', () => {
    const fixture = { id: 'cal', opponentShort: 'CAL', expectedRequests: 37_000 };
    const seats = 4_000;
    const entries = generateEntries(fixture);
    const tau = solveThreshold(entrantPopulation(fixture.expectedRequests), seats);
    const tally = new Map<number, { n: number; won: number }>();
    for (let s = 0; s < 12; s++) {
      const result = runDraw(entries, seats, `cal-${s}`);
      for (let i = 0; i < entries.ids.length; i++) {
        const w = entries.weights[i]!;
        const t = tally.get(w) ?? { n: 0, won: 0 };
        t.n++;
        t.won += result.won[i]!;
        tally.set(w, t);
      }
    }
    let checked = 0;
    for (const [w, t] of tally) {
      if (t.n < 4_000) continue;
      checked++;
      expect(Math.abs(t.won / t.n - winProbability(w, tau))).toBeLessThan(0.02);
    }
    expect(checked).toBeGreaterThan(5);
  });

  it('shows the loyalty effect in the published per-Pechvogel win rates', () => {
    const fixture = getFixture('fcb-fch-2026-12-15');
    const entries = generateEntries(fixture, { scale: 0.25 });
    const result = runDraw(
      entries,
      Math.round(seatAllocation(fixture).memberBallot * 0.25),
      'stats',
    );
    const first = result.winRateByPechvogel.find((s) => s.pechvogel === 0)!;
    const last = result.winRateByPechvogel.find((s) => s.pechvogel === 10)!;
    expect(last.rate).toBeGreaterThan(1.8 * first.rate);
  });

  it('runs a full-size Klassiker ballot quickly', () => {
    const bvb = getFixture('fcb-bvb-2026-11-21');
    const lena = getMember('lena');
    const myId = entryIdFor(lena.id, bvb.id);
    const entries = generateEntries(bvb, {
      extra: [
        { id: myId, weight: applicationWeight(lena), groupSize: 1, pechvogel: lena.pechvogel },
      ],
    });
    expect(entries.ids.length).toBeGreaterThan(180_000);
    const t0 = performance.now();
    const result = runDraw(entries, seatAllocation(bvb).memberBallot, 'klassiker');
    expect(performance.now() - t0).toBeLessThan(3_000);
    expect(result.seatsAllocated).toBe(seatAllocation(bvb).memberBallot);
    const mine = outcomeAt(result, entries, entries.ids.length - 1);
    expect(mine.id).toBe(myId);

    const facts = buildBallotLetterFacts({
      member: lena,
      fixture: bvb,
      odds: oddsForMember(bvb, lena),
      outcome: mine,
      result,
      upcoming: FIXTURES,
    });
    expect(facts.won).toBe(mine.won);
    expect(facts.pechvogelAfter).toBe(mine.won ? 0 : lena.pechvogel + 1);
    expect(facts.nextBest.length).toBeGreaterThan(0);
    expect(facts.fixture).toBe('FC Bayern vs Borussia Dortmund');
  });
});

describe('apply-smart recommender', () => {
  it('beats "apply for the big games" on P(at least one match)', () => {
    for (const member of DEMO_MEMBERS) {
      const fixtures = openFixtures();
      const odds = fixtures.map((f) => oddsForMember(f, member));
      const rec = recommendApplications({
        fixtures,
        odds,
        preferences: member.preferences,
        maxApplications: 3,
      });
      expect(rec.smart.picks.length).toBeLessThanOrEqual(3);
      expect(rec.smart.pAtLeastOne).toBeGreaterThanOrEqual(rec.naive.pAtLeastOne - 1e-12);
      expect(rec.uplift).toBeGreaterThanOrEqual(-1e-12);
      for (const p of rec.smart.picks) {
        expect(member.preferences[p.fixtureId] ?? 0).toBeGreaterThan(0);
        expect(p.reason).toMatch(/^1 in /);
      }
    }
  });

  it('supports a favourites strategy and fans without preferences', () => {
    const fixtures = openFixtures();
    const lena = getMember('lena');
    const odds = fixtures.map((f) => oddsForMember(f, lena));
    const fav = recommendApplications({
      fixtures,
      odds,
      preferences: lena.preferences,
      strategy: 'favourites',
    });
    expect(fav.smart.expectedJoy).toBeGreaterThanOrEqual(fav.naive.expectedJoy - 1e-12);
    const none = recommendApplications({ fixtures, odds, preferences: {}, maxApplications: 2 });
    expect(none.smart.picks).toHaveLength(2);
  });
});

describe('pseudonymous entry ids', () => {
  it('are stable and do not reveal the member', () => {
    expect(entryIdFor('lena', 'f1')).toBe(entryIdFor('lena', 'f1'));
    expect(entryIdFor('lena', 'f1')).not.toBe(entryIdFor('lena', 'f2'));
    expect(entryIdFor('lena', 'f1')).toMatch(/^M-[0-9A-Z]{7}$/);
    expect(() => getMember('ghost')).toThrow();
  });
});
