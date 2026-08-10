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

export type LLMErrorKind = "rate_limit" | "timeout" | "auth_error" | "server_error" | "unknown";

export class LLMProviderError extends Error {
  readonly provider: string;
  readonly cause: unknown;
  readonly kind: LLMErrorKind;

  constructor(provider: string, message: string, cause?: unknown, kind: LLMErrorKind = "unknown") {
    super(message);
    this.name = "LLMProviderError";
    this.provider = provider;
    this.cause = cause;
    this.kind = kind;
  }
}
