import {
  type CompletionOptions,
  type LLMProvider,
  type LLMResponse,
  LLMProviderError,
} from "@/lib/llm/types";

const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const API_URL = "https://api.groq.com/openai/v1/chat/completions";

interface GroqResponseBody {
  choices: Array<{ message: { content: string } }>;
  model: string;
}

export class GroqAdapter implements LLMProvider {
  readonly name = "groq";

  constructor(private readonly apiKey: string | undefined) {}

  async complete(prompt: string, opts?: CompletionOptions): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new LLMProviderError("groq", "Missing Groq API key");
    }

    const model = DEFAULT_MODEL;
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: opts?.maxTokens,
        temperature: opts?.temperature,
      }),
    });

    if (!response.ok) {
      throw new LLMProviderError(
        "groq",
        `Groq API error: ${response.status}`,
        response.status
      );
    }

    const data = (await response.json()) as GroqResponseBody;
    return {
      text: data.choices[0].message.content,
      provider: "groq",
      model: data.model,
    };
  }
}
