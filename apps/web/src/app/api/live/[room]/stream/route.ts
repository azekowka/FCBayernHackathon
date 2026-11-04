import { apiError } from '@/lib/server/http';
import { ROOM_ID, getRoom, type LiveState } from '@/lib/server/liveRooms';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Server-Sent Events: every phone in the room gets each new state instantly. */
export async function GET(req: Request, ctx: { params: Promise<{ room: string }> }) {
  const { room: id } = await ctx.params;
  if (!ROOM_ID.test(id)) return apiError('bad_request', 'Invalid room id', 400);
  const room = await getRoom(id);
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (s: LiveState) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(s)}\n\n`));
        } catch {
          cleanup();
        }
      };
      send(room.snapshot());
      const unsubscribe = room.subscribe(send);
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          cleanup();
        }
      }, 15_000);
      cleanup = () => {
        unsubscribe();
        clearInterval(heartbeat);
      };
      req.signal.addEventListener('abort', () => {
        cleanup();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
