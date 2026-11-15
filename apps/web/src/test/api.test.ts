import { commitmentFor, verifyCommitment } from '@fcb/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { POST as aiJourney } from '@/app/api/ai/journey/route';
import { POST as ballotLetter } from '@/app/api/ai/ballot-letter/route';
import { POST as commitRoute } from '@/app/api/ballot/commit/route';
import { POST as drawRoute } from '@/app/api/ballot/draw/route';
import { GET as health } from '@/app/api/health/route';
import { GET as liveGet, POST as livePost } from '@/app/api/live/[room]/route';
import { aiStatus } from '@/lib/server/ai';
import { commitDraw, isValidDrawId, performDraw, seedFor } from '@/lib/server/draws';
import { HttpError, MAX_BODY_BYTES, clientKey, handler, readJson } from '@/lib/server/http';
import { LiveRoom } from '@/lib/server/liveRooms';
import { rateLimit, resetRateLimits } from '@/lib/server/rateLimit';

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://test${url}`, {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...headers },
  });

beforeEach(() => resetRateLimits());

describe('rate limiter', () => {
  it('allows a burst, then refills over time', () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) expect(rateLimit('k', 3, 60, t).ok).toBe(true);
    const blocked = rateLimit('k', 3, 60, t);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(rateLimit('k', 3, 60, t + 1_000).ok).toBe(true);
  });
});

describe('http helpers', () => {
  const Schema = z.object({ a: z.number() });

  it('validates JSON bodies and caps their size', async () => {
    expect(await readJson(post('/x', { a: 1 }), Schema)).toEqual({ a: 1 });
    await expect(readJson(post('/x', '{oops'), Schema)).rejects.toMatchObject({ status: 400 });
    await expect(readJson(post('/x', { a: 'no' }), Schema)).rejects.toThrow(/a:/);
    await expect(
      readJson(post('/x', { a: 'x'.repeat(MAX_BODY_BYTES) }), Schema),
    ).rejects.toMatchObject({ status: 413 });
  });

  it('keys rate limits on the proxy-added hop, not a client-supplied one', () => {
    const spoofed = (first: string) =>
      clientKey(post('/x', {}, { 'x-forwarded-for': `${first}, 203.0.113.7` }));
    expect(spoofed('1.1.1.1')).toBe('203.0.113.7');
    expect(spoofed('9.9.9.9')).toBe('203.0.113.7');
    expect(
      clientKey(post('/x', {}, { 'x-real-ip': '198.51.100.2', 'x-forwarded-for': '1.1.1.1' })),
    ).toBe('198.51.100.2');
  });

  it('maps errors and rate limits to clean JSON responses', async () => {
    const h = handler({ name: 't', capacity: 1, refillPerMinute: 1 }, async () => {
      throw new HttpError('not_found', 'nope', 404);
    });
    const first = await h(post('/x', {}, { 'x-forwarded-for': '1.2.3.4' }));
    expect(first.status).toBe(404);
    expect(await first.json()).toEqual({ error: { code: 'not_found', message: 'nope' } });
    const second = await h(post('/x', {}, { 'x-forwarded-for': '1.2.3.4' }));
    expect(second.status).toBe(429);
    expect(second.headers.get('retry-after')).toBeTruthy();
    const boom = handler({ name: 'b', capacity: 5, refillPerMinute: 5 }, async () => {
      throw new Error('secret internals');
    });
    const res = await boom(post('/x', {}));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('secret internals');
  });
});

describe('health', () => {
  it('reports demo mode without leaking a key', async () => {
    const res = health();
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, ai: { mode: 'demo' } });
    expect(aiStatus().mode).toBe('demo');
  });
});

describe('verifiable ballot API', () => {
  it('commits before the draw and reveals a matching seed after', async () => {
    const c = commitDraw('fcb-fch-2026-12-15');
    expect(c.commitment).toBe(commitmentFor(seedFor(c.drawId, c.fixtureId)));
    const d = performDraw(c.drawId, c.fixtureId, 'lena');
    expect(verifyCommitment(d.response.seed, c.commitment)).toBe(true);
    expect(performDraw(c.drawId, c.fixtureId, 'lena')).toBe(d);
    expect(d.response.entrants).toBeGreaterThan(70_000);
    expect(d.facts.firstName).toBe('Lena');
  });

  it('rejects closed ballots, unknown members and bad ids', async () => {
    expect(() => commitDraw('fcb-scf-2026-11-07')).toThrow(/closed/);
    expect(() => commitDraw('nope')).toThrow(/Unknown fixture/);
    const c = commitDraw('fcb-wob-2026-12-05');
    expect(() => performDraw(c.drawId, c.fixtureId, 'ghost')).toThrow(/Unknown member/);
    // Draw ids are minted (and signed) by /commit — invented or re-targeted ids are refused.
    expect(() => performDraw(crypto.randomUUID(), c.fixtureId, 'lena')).toThrow(/commitment first/);
    expect(() => performDraw(c.drawId, 'fcb-fch-2026-12-15', 'lena')).toThrow(/commitment first/);
    expect(isValidDrawId(c.drawId, c.fixtureId)).toBe(true);
    expect(
      (
        await drawRoute(
          post('/api/ballot/draw', { drawId: 'not-a-uuid', fixtureId: 'x', memberId: 'y' }),
        )
      ).status,
    ).toBe(400);
  });

  it('serves commit → draw → letter over HTTP', async () => {
    const commit = await (
      await commitRoute(post('/api/ballot/commit', { fixtureId: 'fcb-wob-2026-12-05' }))
    ).json();
    expect(commit.commitment).toMatch(/^[0-9a-f]{64}$/);
    const drawRes = await drawRoute(
      post('/api/ballot/draw', {
        drawId: commit.drawId,
        fixtureId: commit.fixtureId,
        memberId: 'huber',
      }),
    );
    expect(drawRes.status).toBe(200);
    const draw = await drawRes.json();
    expect(draw.outcome.groupSize).toBe(4);
    const letter = await (
      await ballotLetter(
        post('/api/ai/ballot-letter', {
          drawId: commit.drawId,
          fixtureId: commit.fixtureId,
          memberId: 'huber',
          language: 'de',
        }),
      )
    ).json();
    expect(letter).toMatchObject({ source: 'demo' });
    expect(letter.value).toMatch(/^Servus Anna/);
    const bad = await ballotLetter(
      post('/api/ai/ballot-letter', {
        drawId: commit.drawId,
        fixtureId: commit.fixtureId,
        memberId: 'huber',
        language: 'klingon',
      }),
    );
    expect(bad.status).toBe(400);
  });
});

describe('live room choreography', () => {
  it('nudges Sepp, routes the seat past ineligible fans to Mia, cascades on pass', async () => {
    const room = new LiveRoom('test-room');
    await room.init();
    let s = room.snapshot();
    expect(s.holder.chat[0]?.text).toMatch(/^Servus Sepp/);
    s = await room.dispatch({ action: 'say', text: "I can't make it, I'm in Hamburg" });
    expect(s.holder.chat.at(-1)?.confirm).toBe('release');
    s = await room.dispatch({ action: 'release', mode: 'waitlist' });
    expect(s.holder.status).toBe('released');
    expect(s.events.filter((e) => e.kind === 'skipped').map((e) => e.text)).toEqual([
      '#1 Familie Huber skipped — needs 4 seats together.',
      '#2 Elif Yılmaz skipped — wants a seated seat.',
    ]);
    const mia = s.fans.find((f) => f.id === 'mia');
    expect(mia?.offer?.message).toMatch(/^Mia, your patience pays off/);
    s = await room.dispatch({ action: 'respond', fanId: 'mia', accept: false });
    expect(s.fans.find((f) => f.id === 'jonas')?.offer).not.toBeNull();
    s = await room.dispatch({ action: 'respond', fanId: 'jonas', accept: true });
    expect(s.fans.find((f) => f.id === 'jonas')?.ticket).not.toBeNull();
    expect(s.holder.chat.at(-1)?.text).toMatch(/Jonas from Garching/);
    // Releasing twice is a no-op.
    const v = s.version;
    s = await room.dispatch({ action: 'release', mode: 'waitlist' });
    expect(s.version).toBe(v);
    s = await room.dispatch({ action: 'reset', language: 'de' });
    expect(s.version).toBeGreaterThan(v);
    expect(s.holder.status).toBe('open');
    expect(s.holder.chat[0]?.text).toMatch(/^Servus Sepp!.*Was möchtest du tun\?$/);
  });

  it('respects "I’m coming" and gifting', async () => {
    const a = new LiveRoom('keep');
    await a.init();
    expect(
      (await a.dispatch({ action: 'say', text: "No worries, I'm coming!" })).holder.status,
    ).toBe('kept');
    const b = new LiveRoom('gift');
    await b.init();
    const s = await b.dispatch({ action: 'release', mode: 'youth' });
    expect(s.holder.status).toBe('gifted');
    expect(s.fans.every((f) => f.offer === null)).toBe(true);
  });

  it('exposes the room over HTTP with validation', async () => {
    const ctx = { params: Promise.resolve({ room: 'http-room' }) };
    expect((await liveGet(new Request('http://test/api/live/http-room'), ctx)).status).toBe(200);
    const res = await livePost(
      post('/api/live/http-room', { action: 'release', mode: 'waitlist' }),
      ctx,
    );
    expect((await res.json()).holder.status).toBe('released');
    expect((await livePost(post('/api/live/http-room', { action: 'explode' }), ctx)).status).toBe(
      400,
    );
    expect(
      (
        await liveGet(new Request('http://test/api/live/BAD!'), {
          params: Promise.resolve({ room: 'BAD!' }),
        })
      ).status,
    ).toBe(400);
  });
});

describe('journey AI route', () => {
  const request = {
    originId: 'marienplatz',
    mode: 'ubahn',
    blockId: '112',
    kickoff: '2026-11-07T15:30:00+01:00',
  };

  it('parses, narrates and answers from a recomputed plan', async () => {
    const parsed = await (
      await aiJourney(
        post('/api/ai/journey', {
          action: 'parse',
          text: 'From Rosenheim with the fan club bus, Block 330',
        }),
      )
    ).json();
    expect(parsed.value).toMatchObject({ originId: 'rosenheim', mode: 'fanbus', blockId: '330' });
    const narrated = await (
      await aiJourney(post('/api/ai/journey', { action: 'narrate', request, language: 'de' }))
    ).json();
    expect(narrated.value).toMatch(/^Los geht's um \d{2}:\d{2} ab Marienplatz/);
    const answer = await (
      await aiJourney(
        post('/api/ai/journey', {
          action: 'ask',
          request: { ...request, disruption: 'u6-strike' },
          question: 'How do I get home?',
        }),
      )
    ).json();
    expect(answer.value).toMatch(/home around/);
  });

  it('rejects unknown origins, blocks and malformed requests', async () => {
    expect(
      (
        await aiJourney(
          post('/api/ai/journey', { action: 'narrate', request: { ...request, originId: 'mars' } }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await aiJourney(
          post('/api/ai/journey', { action: 'narrate', request: { ...request, blockId: '999' } }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await aiJourney(
          post('/api/ai/journey', {
            action: 'narrate',
            request: { ...request, kickoff: 'tomorrow' },
          }),
        )
      ).status,
    ).toBe(400);
  });
});
