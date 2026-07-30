import { describe, it, expect, vi, afterEach } from "vitest";
import { LLMProviderError } from "@/lib/llm/types";
import { GeminiAdapter } from "./gemini";

const MOCK_API_KEY = "test-gemini-key";
const MOCK_MODEL = "gemini-2.0-flash";
const PROMPT = "Explain variance";
const EXPECTED_TEXT = "Variance result";

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

describe("GeminiAdapter", () => {
  it("throws LLMProviderError when apiKey is undefined", async () => {
    const adapter = new GeminiAdapter(undefined);
    await expect(adapter.complete(PROMPT)).rejects.toBeInstanceOf(
      LLMProviderError
    );
    await expect(adapter.complete(PROMPT)).rejects.toMatchObject({
      provider: "gemini",
    });
  });

  it("calls correct URL with API key in query param (not Authorization header)", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      makeFetchResponse({
        candidates: [{ content: { parts: [{ text: EXPECTED_TEXT }] } }],
      })
    );

    const adapter = new GeminiAdapter(MOCK_API_KEY);
    await adapter.complete(PROMPT);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(
      `https://generativelanguage.googleapis.com/v1beta/models/${MOCK_MODEL}:generateContent`
    );
    expect(url).toContain(`key=${MOCK_API_KEY}`);
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("returns LLMResponse with correct text, provider, and model", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      makeFetchResponse({
        candidates: [{ content: { parts: [{ text: EXPECTED_TEXT }] } }],
      })
    );

    const adapter = new GeminiAdapter(MOCK_API_KEY);
    const result = await adapter.complete(PROMPT);

    expect(result).toEqual({
      text: EXPECTED_TEXT,
      provider: "gemini",
      model: MOCK_MODEL,
    });
  });

  it("throws LLMProviderError on non-2xx HTTP response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      makeFetchResponse({ error: { message: "Internal Server Error" } }, 500)
    );

    const adapter = new GeminiAdapter(MOCK_API_KEY);
    await expect(adapter.complete(PROMPT)).rejects.toBeInstanceOf(
      LLMProviderError
    );
    await expect(adapter.complete(PROMPT)).rejects.toMatchObject({
      provider: "gemini",
    });
  });
});
