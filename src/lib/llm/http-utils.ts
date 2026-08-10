import { LLMProviderError, type LLMErrorKind } from "./types";

export function classifyHttpStatus(status: number): LLMErrorKind {
  if (status === 429) return "rate_limit";
  if (status === 401 || status === 403) return "auth_error";
  if (status === 408 || status === 504) return "timeout";
  if (status >= 500 && status <= 599) return "server_error";
  return "unknown";
}

export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  opts: {
    maxRetries: number;
    baseDelayMs: number;
    factor: number;
    retryOn: LLMErrorKind[];
  }
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable =
        err instanceof LLMProviderError && opts.retryOn.includes(err.kind);

      if (!isRetryable || attempt >= opts.maxRetries) {
        throw err;
      }

      const delay = opts.baseDelayMs * Math.pow(opts.factor, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt++;
    }
  }
}
