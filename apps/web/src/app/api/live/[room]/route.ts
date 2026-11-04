import { z } from 'zod';
import { AI_BUCKET, HttpError, handler, json, readJson } from '@/lib/server/http';
import { ROOM_ID, getRoom } from '@/lib/server/liveRooms';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ room: string }> };

async function roomFrom(ctx: Ctx) {
  const { room } = await ctx.params;
  if (!ROOM_ID.test(room)) throw new HttpError('bad_request', 'Invalid room id', 400);
  return getRoom(room);
}

const Action = z.discriminatedUnion('action', [
  z.object({ action: z.literal('say'), text: z.string().trim().min(1).max(500) }),
  z.object({ action: z.literal('release'), mode: z.enum(['waitlist', 'youth']) }),
  z.object({ action: z.literal('keep') }),
  z.object({ action: z.literal('respond'), fanId: z.string().min(1).max(32), accept: z.boolean() }),
  z.object({ action: z.literal('reset'), language: z.enum(['en', 'de']).optional() }),
]);

export const GET = handler({ name: 'live-read', capacity: 120, refillPerMinute: 240 }, async (_req: Request, ctx: Ctx) =>
  json((await roomFrom(ctx)).snapshot()),
);

export const POST = handler(AI_BUCKET, async (req: Request, ctx: Ctx) => {
  const room = await roomFrom(ctx);
  const action = await readJson(req, Action);
  return json(await room.dispatch(action));
});
