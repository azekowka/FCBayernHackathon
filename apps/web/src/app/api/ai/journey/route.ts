import { SUPPORTED_LANGUAGES, answerJourneyQuestion, narrateJourney, parseJourneyRequest } from '@fcb/ai';
import { ORIGINS, getBlock, getOrigin, planJourney, type JourneyRequest } from '@fcb/core';
import { z } from 'zod';
import { getAi } from '@/lib/server/ai';
import { AI_BUCKET, HttpError, handler, json, readJson } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const Lang = z.enum(SUPPORTED_LANGUAGES as [string, ...string[]]).default('en');

const Request = z.object({
  originId: z.string().max(32),
  mode: z.enum(['ubahn', 'bike', 'car', 'fanbus', 'walk']),
  blockId: z.string().regex(/^\d{3}$/),
  kickoff: z.iso.datetime({ offset: true }),
  fixtureLabel: z.string().max(80).optional(),
  preferences: z
    .object({
      seatedBy: z.number().int().min(5).max(120).optional(),
      wantsFood: z.boolean().optional(),
      withKids: z.boolean().optional(),
      stepFree: z.boolean().optional(),
      postMatch: z.enum(['asap', 'relaxed', 'auto']).optional(),
    })
    .optional(),
  disruption: z.enum(['u6-strike', 'u6-north-closure', 'heavy-rain']).nullable().optional(),
});

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('parse'), text: z.string().trim().min(1).max(600) }),
  z.object({ action: z.literal('narrate'), request: Request, language: Lang }),
  z.object({ action: z.literal('ask'), request: Request, question: z.string().trim().min(1).max(300), language: Lang }),
]);

function plan(req: JourneyRequest) {
  try {
    getOrigin(req.originId);
    getBlock(req.blockId);
  } catch {
    throw new HttpError('bad_request', 'Unknown start point or block', 400);
  }
  return planJourney(req);
}

export const POST = handler(AI_BUCKET, async (req: Request) => {
  const body = await readJson(req, Body);
  const ai = getAi();
  if (body.action === 'parse') {
    return json(await parseJourneyRequest(ai, body.text, ORIGINS.map((o) => ({ id: o.id, label: o.label, keywords: o.keywords }))));
  }
  const p = plan(body.request as JourneyRequest);
  if (body.action === 'narrate') return json(await narrateJourney(ai, p.facts, body.language));
  const timeline = p.timeline.map((s) => ({ clock: s.clock, title: s.title, detail: s.detail }));
  return json(await answerJourneyQuestion(ai, { question: body.question, facts: p.facts, timeline, language: body.language }));
});
