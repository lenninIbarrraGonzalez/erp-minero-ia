import {
  type CompletionOptions,
  type LLMProvider,
  type LLMResponse,
  LLMProviderError,
} from "@/lib/llm/types";
import { classifyHttpStatus, withExponentialBackoff } from "@/lib/llm/http-utils";

const DEFAULT_MODEL = "meta-llama/llama-3.1-8b-instruct";
const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const REFERER = "https://erp-minero.vercel.app";

interface OpenRouterResponseBody {
  choices: Array<{ message: { content: string } }>;
  model: string;
}

export class OpenRouterAdapter implements LLMProvider {
  readonly name = "openrouter";

  constructor(private readonly apiKey: string | undefined) {}

  async complete(prompt: string, opts?: CompletionOptions): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new LLMProviderError("openrouter", "Missing OpenRouter API key");
    }

    const model = DEFAULT_MODEL;
    const apiKey = this.apiKey;

    return withExponentialBackoff(
      async () => {
        const response = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": REFERER,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            max_tokens: opts?.maxTokens,
            temperature: opts?.temperature,
          }),
        });

        if (!response.ok) {
          const kind = classifyHttpStatus(response.status);
          throw new LLMProviderError("openrouter", `OpenRouter API error: ${response.status}`, response.status, kind);
        }

        const data = (await response.json()) as OpenRouterResponseBody;
        return {
          text: data.choices[0].message.content,
          provider: "openrouter",
          model: data.model,
        };
      },
      { maxRetries: 2, baseDelayMs: 500, factor: 3, retryOn: ["rate_limit", "timeout"] }
    );
  }
}
