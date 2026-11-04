import { GoogleGenAI } from '@google/genai';
import { LlmError, type LlmClient, type LlmRequest } from './llm';

/** The slice of the SDK we use — lets tests inject a fake without network. */
export interface GenAiLike {
  models: {
    generateContent(params: {
      model: string;
      contents: string;
      config?: Record<string, unknown>;
    }): Promise<{ text?: string | undefined }>;
  };
}

export interface GeminiOptions {
  apiKey: string;
  model: string;
  timeoutMs?: number;
  /** Optional thinking depth for Gemini 3.x+ models (e.g. "LOW"). */
  thinkingLevel?: string;
  sdk?: GenAiLike;
}

export class GeminiClient implements LlmClient {
  readonly provider = 'gemini' as const;
  readonly model: string;
  private readonly sdk: GenAiLike;
  private readonly timeoutMs: number;
  private readonly thinkingLevel: string | undefined;

  constructor(options: GeminiOptions) {
    if (!options.apiKey && !options.sdk) throw new Error('GeminiClient needs an API key');
    this.model = options.model;
    this.timeoutMs = options.timeoutMs ?? 12_000;
    this.thinkingLevel = options.thinkingLevel;
    this.sdk = options.sdk ?? (new GoogleGenAI({ apiKey: options.apiKey }) as unknown as GenAiLike);
  }

  async generate(request: LlmRequest): Promise<string> {
    const timeoutMs = request.timeoutMs ?? this.timeoutMs;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new LlmError(`Gemini did not answer within ${timeoutMs} ms`, 'timeout'));
      }, timeoutMs);
    });

    const config: Record<string, unknown> = {
      systemInstruction: request.system,
      temperature: request.temperature ?? 0.6,
      maxOutputTokens: request.maxOutputTokens ?? 2048,
      abortSignal: controller.signal,
    };
    if (request.json) {
      config.responseMimeType = 'application/json';
      config.responseJsonSchema = request.json.schema;
    }
    if (this.thinkingLevel) config.thinkingConfig = { thinkingLevel: this.thinkingLevel };

    try {
      const response = await Promise.race([
        this.sdk.models.generateContent({ model: this.model, contents: request.prompt, config }),
        timeout,
      ]);
      const text = response.text?.trim();
      if (!text) throw new LlmError('Gemini returned an empty response', 'empty');
      return text;
    } catch (error) {
      if (error instanceof LlmError) throw error;
      throw new LlmError(`Gemini request failed: ${describe(error)}`, 'upstream');
    } finally {
      clearTimeout(timer);
    }
  }
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    // Never echo request bodies or keys — keep the first line of the message only.
    return error.message.split('\n')[0]?.slice(0, 200) ?? error.name;
  }
  return 'unknown error';
}
