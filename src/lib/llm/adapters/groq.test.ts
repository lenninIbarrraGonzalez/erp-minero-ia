import { describe, it, expect, vi, afterEach } from "vitest";
import { LLMProviderError } from "@/lib/llm/types";

// Import after test scaffolding — will fail in RED phase since file doesn't exist yet
import { GroqAdapter } from "./groq";

const MOCK_API_KEY = "test-api-key";
const MOCK_MODEL = "llama-3.3-70b-versatile";
const PROMPT = "Explain variance";

function makeFetchResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GroqAdapter", () => {
  it("throws LLMProviderError when apiKey is undefined", async () => {
    const adapter = new GroqAdapter(undefined);
    await expect(adapter.complete(PROMPT)).rejects.toBeInstanceOf(
      LLMProviderError
    );
    await expect(adapter.complete(PROMPT)).rejects.toMatchObject({
      provider: "groq",
    });
  });

  it("calls the correct URL with correct Authorization header", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      makeFetchResponse({
        choices: [{ message: { content: "Hello" } }],
        model: MOCK_MODEL,
      })
    );

    const adapter = new GroqAdapter(MOCK_API_KEY);
    await adapter.complete(PROMPT);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe(`Bearer ${MOCK_API_KEY}`);
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("returns LLMResponse with text, provider, and model on success", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      makeFetchResponse({
        choices: [{ message: { content: "Result text" } }],
        model: MOCK_MODEL,
      })
    );

    const adapter = new GroqAdapter(MOCK_API_KEY);
    const result = await adapter.complete(PROMPT);

    expect(result).toEqual({
      text: "Result text",
      provider: "groq",
      model: MOCK_MODEL,
    });
  });

  it("throws LLMProviderError on non-2xx HTTP response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      makeFetchResponse({ error: "Internal Server Error" }, 500)
    );

    const adapter = new GroqAdapter(MOCK_API_KEY);
    await expect(adapter.complete(PROMPT)).rejects.toBeInstanceOf(
      LLMProviderError
    );
    await expect(adapter.complete(PROMPT)).rejects.toMatchObject({
      provider: "groq",
    });
  });
});
