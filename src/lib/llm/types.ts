export interface CompletionOptions {
  maxTokens?: number;
  temperature?: number;
}

export interface LLMResponse {
  text: string;
  provider: string;
  model: string;
}

export interface LLMProvider {
  readonly name: string;
  complete(prompt: string, opts?: CompletionOptions): Promise<LLMResponse>;
}

export class LLMProviderError extends Error {
  readonly provider: string;
  readonly cause: unknown;

  constructor(provider: string, message: string, cause?: unknown) {
    super(message);
    this.name = "LLMProviderError";
    this.provider = provider;
    this.cause = cause;
  }
}
