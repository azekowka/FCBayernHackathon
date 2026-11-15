import { GeminiClient, type GenAiLike } from './gemini';
import type { AiContext } from './llm';

export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';

export interface AiConfig {
  mode: 'gemini' | 'demo';
  model: string;
  reason: string;
}

type Env = Record<string, string | undefined>;

/**
 * Gemini when a key is configured, deterministic demo mode otherwise.
 * `AI_MODE=demo` forces demo mode (e.g. for a flaky venue Wi-Fi on stage).
 */
export function resolveAiConfig(
  env: Env,
): AiConfig & { apiKey: string | null; thinkingLevel?: string } {
  const apiKey = env.GEMINI_API_KEY?.trim() || env.GOOGLE_API_KEY?.trim() || null;
  const model = env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const thinkingLevel = env.GEMINI_THINKING_LEVEL?.trim() || undefined;
  if (env.AI_MODE?.trim().toLowerCase() === 'demo') {
    return { mode: 'demo', model, apiKey: null, reason: 'AI_MODE=demo', thinkingLevel };
  }
  if (!apiKey)
    return {
      mode: 'demo',
      model,
      apiKey: null,
      reason: 'No GEMINI_API_KEY configured',
      thinkingLevel,
    };
  return { mode: 'gemini', model, apiKey, reason: 'GEMINI_API_KEY configured', thinkingLevel };
}

export function createAiContext(env: Env, sdk?: GenAiLike): AiContext & { config: AiConfig } {
  const cfg = resolveAiConfig(env);
  const config: AiConfig = { mode: cfg.mode, model: cfg.model, reason: cfg.reason };
  if (cfg.mode === 'demo' || !cfg.apiKey) return { llm: null, config };
  return {
    llm: new GeminiClient({
      apiKey: cfg.apiKey,
      model: cfg.model,
      thinkingLevel: cfg.thinkingLevel,
      sdk,
    }),
    config,
  };
}
