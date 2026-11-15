import 'server-only';
import { createAiContext, type AiConfig, type AiContext } from '@fcb/ai';

/**
 * One AI context per server process. The API key is read from the
 * environment on the server only and never serialised to the client.
 */
let ctx: (AiContext & { config: AiConfig }) | null = null;

export function getAi(): AiContext & { config: AiConfig } {
  ctx ??= createAiContext(process.env);
  return ctx;
}

export function aiStatus(): AiConfig {
  return getAi().config;
}

/** Test hook: rebuild the context after changing env. */
export function resetAiForTests(): void {
  ctx = null;
}
