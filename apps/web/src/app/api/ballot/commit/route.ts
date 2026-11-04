import { z } from 'zod';
import { commitDraw } from '@/lib/server/draws';
import { API_BUCKET, handler, json, readJson } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const Body = z.object({ fixtureId: z.string().min(1).max(64) });

/** Step 1 of commit–reveal: publish SHA-256(seed) before the draw. */
export const POST = handler(API_BUCKET, async (req: Request) => {
  const { fixtureId } = await readJson(req, Body);
  return json(commitDraw(fixtureId));
});
