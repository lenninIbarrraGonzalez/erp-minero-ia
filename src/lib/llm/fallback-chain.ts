import type { LLMProvider, LLMResponse, CompletionOptions } from "./types";
import { LLMProviderError } from "./types";

export class FallbackChain implements LLMProvider {
  readonly name = "fallback-chain";

  constructor(private readonly providers: LLMProvider[]) {}

  async complete(
    prompt: string,
    opts?: CompletionOptions
  ): Promise<LLMResponse> {
    for (const provider of this.providers) {
      try {
        return await provider.complete(prompt, opts);
      } catch {
        // try next provider
      }
    }

    throw new LLMProviderError("all", "All LLM providers failed");
  }
}
