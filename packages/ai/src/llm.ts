/**
 * Provider-neutral LLM contract. The rest of the system never imports a
 * vendor SDK — swapping Gemini models (or adding Vertex AI) touches one file.
 */

export interface LlmRequest {
  /** System instruction: role, rules, tone. */
  system: string;
  /** The user-turn prompt, including grounded facts. */
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** When set, the model must return JSON matching this JSON Schema. */
  json?: { schema: Record<string, unknown> };
  timeoutMs?: number;
}

export interface LlmClient {
  readonly provider: 'gemini';
  readonly model: string;
  generate(request: LlmRequest): Promise<string>;
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly code: 'empty' | 'timeout' | 'invalid_json' | 'schema' | 'ungrounded' | 'upstream',
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

export type AiSource = 'gemini' | 'demo' | 'fallback';

export interface AiResult<T> {
  value: T;
  source: AiSource;
  model: string | null;
  latencyMs: number;
  /** Why a fallback happened (never contains secrets or user data). */
  note?: string;
}

export interface AiContext {
  /** `null` = demo mode (no API key): deterministic templates. */
  llm: LlmClient | null;
}
