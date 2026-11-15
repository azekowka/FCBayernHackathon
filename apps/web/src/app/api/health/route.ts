import { aiStatus } from '@/lib/server/ai';
import { json } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

/** Liveness + which AI path is active (never exposes the key). */
export function GET() {
  const ai = aiStatus();
  return json({ ok: true, ai: { mode: ai.mode, model: ai.model }, time: new Date().toISOString() });
}
