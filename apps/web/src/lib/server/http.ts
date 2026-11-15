import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { rateLimit } from './rateLimit';

export const MAX_BODY_BYTES = 16 * 1024;

export type ApiErrorCode =
  | 'bad_request'
  | 'not_found'
  | 'rate_limited'
  | 'payload_too_large'
  | 'internal';

export function json<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, {
    ...init,
    headers: { 'Cache-Control': 'no-store', ...(init?.headers ?? {}) },
  });
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  headers?: HeadersInit,
) {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: { 'Cache-Control': 'no-store', ...headers } },
  );
}

/**
 * Rate-limit key. Clients can prepend anything to X-Forwarded-For, so we use
 * the platform-set X-Real-IP, else the right-most XFF hop (added by our proxy).
 */
export function clientKey(req: Request): string {
  const real = req.headers.get('x-real-ip')?.trim();
  if (real) return real;
  const hops = req.headers.get('x-forwarded-for')?.split(',') ?? [];
  return hops.at(-1)?.trim() || 'local';
}

export class HttpError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Reads and validates a JSON body with a hard size cap. */
export async function readJson<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  const length = Number(req.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES)
    throw new HttpError('payload_too_large', 'Request body too large', 413);
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES)
    throw new HttpError('payload_too_large', 'Request body too large', 413);
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError('bad_request', 'Body must be valid JSON', 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new HttpError(
      'bad_request',
      issue ? `${issue.path.join('.') || 'body'}: ${issue.message}` : 'Invalid body',
      400,
    );
  }
  return parsed.data;
}

/**
 * Wraps a route handler with rate limiting and uniform error responses.
 * `bucket` lets AI routes have a tighter budget than cheap reads.
 */
export function handler<A extends unknown[]>(
  bucket: { name: string; capacity: number; refillPerMinute: number },
  fn: (req: Request, ...args: A) => Promise<Response>,
) {
  return async (req: Request, ...args: A): Promise<Response> => {
    const limit = rateLimit(
      `${bucket.name}:${clientKey(req)}`,
      bucket.capacity,
      bucket.refillPerMinute,
    );
    if (!limit.ok) {
      return apiError('rate_limited', 'Too many requests — try again in a moment.', 429, {
        'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)),
      });
    }
    try {
      return await fn(req, ...args);
    } catch (error) {
      if (error instanceof HttpError) return apiError(error.code, error.message, error.status);
      console.error(`[api:${bucket.name}]`, error instanceof Error ? error.message : error);
      return apiError('internal', 'Something went wrong on our side.', 500);
    }
  };
}

export const AI_BUCKET = { name: 'ai', capacity: 20, refillPerMinute: 30 } as const;
export const API_BUCKET = { name: 'api', capacity: 60, refillPerMinute: 120 } as const;
/** Full-size draws are CPU-heavy (~190k entries): a tighter budget. */
export const DRAW_BUCKET = { name: 'draw', capacity: 10, refillPerMinute: 20 } as const;
