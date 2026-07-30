import {
  type CompletionOptions,
  type LLMProvider,
  type LLMResponse,
  LLMProviderError,
} from "@/lib/llm/types";

const DEFAULT_MODEL = "gemini-2.0-flash";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiResponseBody {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
}

export class GeminiAdapter implements LLMProvider {
  readonly name = "gemini";

  constructor(private readonly apiKey: string | undefined) {}

  async complete(prompt: string, opts?: CompletionOptions): Promise<LLMResponse> {
    void opts;

    if (!this.apiKey) {
      throw new LLMProviderError("gemini", "Missing Gemini API key");
    }

    const model = DEFAULT_MODEL;
    const url = `${BASE_URL}/${model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      throw new LLMProviderError(
        "gemini",
        `Gemini API error: ${response.status}`,
        response.status
      );
    }

    const data = (await response.json()) as GeminiResponseBody;
    return {
      text: data.candidates[0].content.parts[0].text,
      provider: "gemini",
      model,
    };
  }
}
