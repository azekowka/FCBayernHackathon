import { z } from 'zod';
import { performDraw } from '@/lib/server/draws';
import { DRAW_BUCKET, handler, json, readJson } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const Body = z.object({
  drawId: z.string().min(1).max(64),
  fixtureId: z.string().min(1).max(64),
  memberId: z.string().min(1).max(32),
});

/** Step 2: run the full-size draw and reveal the seed. */
export const POST = handler(DRAW_BUCKET, async (req: Request) => {
  const { drawId, fixtureId, memberId } = await readJson(req, Body);
  return json(performDraw(drawId, fixtureId, memberId).response);
});
