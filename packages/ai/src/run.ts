import type { z } from 'zod';
import { ungroundedNumbers } from './grounding';
import { LlmError, type AiContext, type AiResult, type LlmClient } from './llm';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Runs a skill against Gemini and falls back to the deterministic template on
 * any failure (no key, timeout, invalid JSON, ungrounded numbers…). The demo
 * never breaks on stage, and the UI always knows which path produced the text.
 */
export async function runSkill<T>(
  ctx: AiContext,
  live: (llm: LlmClient) => Promise<T>,
  demo: () => T,
): Promise<AiResult<T>> {
  const started = now();
  if (!ctx.llm)
    return { value: demo(), source: 'demo', model: null, latencyMs: Math.round(now() - started) };
  try {
    const value = await live(ctx.llm);
    return {
      value,
      source: 'gemini',
      model: ctx.llm.model,
      latencyMs: Math.round(now() - started),
    };
  } catch (error) {
    const note = error instanceof LlmError ? `${error.code}: ${error.message}` : 'unexpected error';
    return {
      value: demo(),
      source: 'fallback',
      model: ctx.llm.model,
      latencyMs: Math.round(now() - started),
      note,
    };
  }
}

/** Free text that must only use numbers present in `facts`. */
export async function groundedText(
  llm: LlmClient,
  request: Parameters<LlmClient['generate']>[0],
  facts: unknown,
  maxChars = 2_400,
): Promise<string> {
  const text = (await llm.generate(request)).trim();
  const bad = ungroundedNumbers(text, facts);
  if (bad.length > 0)
    throw new LlmError(`invented numbers: ${bad.slice(0, 5).join(', ')}`, 'ungrounded');
  return text.length > maxChars ? `${text.slice(0, maxChars - 1).trimEnd()}…` : text;
}

/** JSON output validated against a zod schema. */
export async function structured<T>(
  llm: LlmClient,
  request: Parameters<LlmClient['generate']>[0],
  schema: z.ZodType<T>,
): Promise<T> {
  const raw = await llm.generate(request);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    throw new LlmError('model did not return valid JSON', 'invalid_json');
  }
  const result = schema.safeParse(parsed);
  if (!result.success) throw new LlmError('model JSON did not match the schema', 'schema');
  return result.data;
}

/** Small deterministic variety for templates (same facts → same wording). */
export function pickVariant<T>(key: string, options: readonly T[]): T {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  return options[Math.abs(h) % options.length] as T;
}
