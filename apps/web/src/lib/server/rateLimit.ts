/**
 * In-memory token bucket per key. Good enough for a single-instance demo
 * server; a production deployment would back this with Redis/Memorystore.
 */
interface Bucket {
  tokens: number;
  updated: number;
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

export function rateLimit(
  key: string,
  capacity: number,
  refillPerMinute: number,
  now: number = Date.now(),
): { ok: boolean; remaining: number; retryAfterMs: number } {
  let b = buckets.get(key);
  if (!b) {
    if (buckets.size >= MAX_KEYS) {
      const oldest = buckets.keys().next().value;
      if (oldest !== undefined) buckets.delete(oldest);
    }
    b = { tokens: capacity, updated: now };
    buckets.set(key, b);
  }
  const refill = ((now - b.updated) / 60_000) * refillPerMinute;
  b.tokens = Math.min(capacity, b.tokens + refill);
  b.updated = now;
  if (b.tokens >= 1) {
    b.tokens -= 1;
    return { ok: true, remaining: Math.floor(b.tokens), retryAfterMs: 0 };
  }
  const retryAfterMs = Math.ceil(((1 - b.tokens) / refillPerMinute) * 60_000);
  return { ok: false, remaining: 0, retryAfterMs };
}

export function resetRateLimits(): void {
  buckets.clear();
}
