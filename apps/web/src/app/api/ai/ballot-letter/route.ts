import { SUPPORTED_LANGUAGES, writeBallotLetter } from '@fcb/ai';
import { z } from 'zod';
import { getAi } from '@/lib/server/ai';
import { performDraw } from '@/lib/server/draws';
import { AI_BUCKET, handler, json, readJson } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const Body = z.object({
  drawId: z.string().min(1).max(64),
  fixtureId: z.string().min(1).max(64),
  memberId: z.string().min(1).max(32),
  language: z.enum(SUPPORTED_LANGUAGES as [string, ...string[]]).optional(),
});

/**
 * Facts are recomputed on the server from (drawId, fixture, member) — the
 * client never supplies numbers that end up in a prompt.
 */
export const POST = handler(AI_BUCKET, async (req: Request) => {
  const { drawId, fixtureId, memberId, language } = await readJson(req, Body);
  const { facts } = performDraw(drawId, fixtureId, memberId);
  return json(await writeBallotLetter(getAi(), { facts, language }));
});
