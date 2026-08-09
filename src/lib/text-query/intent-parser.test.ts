import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LLMProvider, LLMResponse } from "@/lib/llm/types";
import { LLMProviderError } from "@/lib/llm/types";

// We import the module under test AFTER the vi.mock call
vi.mock("server-only", () => ({}));

import { parseIntent } from "./intent-parser";
import type { ParsedIntent, TextQueryError } from "./types";
import { ParsedIntentSchema } from "./intent-schema";

function makeLLM(response: LLMResponse | Error): LLMProvider {
  return {
    name: "mock",
    complete: vi.fn().mockImplementation(() => {
      if (response instanceof Error) return Promise.reject(response);
      return Promise.resolve(response);
    }),
  };
}

function makeLLMResponse(text: string): LLMResponse {
  return { text, provider: "mock", model: "mock-model" };
}

describe("parseIntent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ParsedIntent when LLM returns valid JSON", async () => {
    const validPayload: ParsedIntent = {
      metric: "cost_per_tonne",
      mineName: "La Escondida",
      period: { year: 2024, month: 3 },
    };
    const llm = makeLLM(makeLLMResponse(JSON.stringify(validPayload)));

    const result = await parseIntent("costo por tonelada La Escondida marzo 2024", llm);

    expect(result).toEqual(validPayload);
  });

  it("throws TextQueryError with code 'parse_failure' when LLM returns malformed JSON", async () => {
    const llm = makeLLM(makeLLMResponse("not valid json {{{"));

    await expect(parseIntent("cualquier pregunta", llm)).rejects.toMatchObject({
      code: "parse_failure",
    } satisfies Partial<TextQueryError>);
  });

  it("throws TextQueryError with code 'unsupported_metric' when LLM returns valid JSON with unknown metric", async () => {
    const badPayload = { metric: "unknown_metric", mineName: "Test" };
    const llm = makeLLM(makeLLMResponse(JSON.stringify(badPayload)));

    await expect(parseIntent("algo que no entiendo", llm)).rejects.toMatchObject({
      code: "unsupported_metric",
    } satisfies Partial<TextQueryError>);
  });

  it("throws TextQueryError with code 'llm_error' when LLM provider throws", async () => {
    const llm = makeLLM(new LLMProviderError("mock", "provider unavailable"));

    await expect(parseIntent("cualquier pregunta", llm)).rejects.toMatchObject({
      code: "llm_error",
    } satisfies Partial<TextQueryError>);
  });

  // QW4: question truncation — oversized question must be trimmed to 500 chars before LLM call
  it("truncates question to 500 characters before passing to LLM", async () => {
    const longQuestion = "a".repeat(501);
    // LLM returns a valid intent regardless of prompt length
    const validPayload: ParsedIntent = { metric: "tonnage" };
    const completeMock = vi.fn().mockResolvedValue(makeLLMResponse(JSON.stringify(validPayload)));
    const llm: LLMProvider = { name: "mock", complete: completeMock };

    await parseIntent(longQuestion, llm);

    const promptArg = completeMock.mock.calls[0][0] as string;
    // The prompt embeds the question; the question portion must be <= 500 chars
    // buildPrompt appends "User question: {question}" at the end
    const marker = "User question: ";
    const questionInPrompt = promptArg.slice(promptArg.lastIndexOf(marker) + marker.length);
    expect(questionInPrompt.length).toBeLessThanOrEqual(500);
  });

  it("does not truncate a question of exactly 500 characters", async () => {
    const exactQuestion = "b".repeat(500);
    const validPayload: ParsedIntent = { metric: "tonnage" };
    const completeMock = vi.fn().mockResolvedValue(makeLLMResponse(JSON.stringify(validPayload)));
    const llm: LLMProvider = { name: "mock", complete: completeMock };

    await parseIntent(exactQuestion, llm);

    const promptArg = completeMock.mock.calls[0][0] as string;
    const marker = "User question: ";
    const questionInPrompt = promptArg.slice(promptArg.lastIndexOf(marker) + marker.length);
    expect(questionInPrompt).toBe(exactQuestion);
  });

  it("throws overlapping_period when quarter and month are both set in parsed intent", async () => {
    // Zod allows both quarter and month simultaneously — P9 guard catches this
    const payload = { metric: "cost_per_tonne", period: { year: 2024, quarter: 1, month: 3 } };
    const llm = makeLLM(makeLLMResponse(JSON.stringify(payload)));

    await expect(
      parseIntent("costo en Q1 en marzo 2024", llm)
    ).rejects.toMatchObject({
      code: "overlapping_period",
    } satisfies Partial<TextQueryError>);
  });

  it("throws ambiguous_query when metric is undefined after all post-parse rules", async () => {
    // metric is required by Zod schema; we bypass it via spyOn to test the P10 safety guard
    const spy = vi.spyOn(ParsedIntentSchema, "safeParse").mockReturnValue({
      success: true,
      data: { period: { year: 2024 } } as unknown as ParsedIntent,
    });
    const llm = makeLLM(makeLLMResponse("{}"));
    try {
      await expect(
        parseIntent("¿qué pasó en la mina?", llm)
      ).rejects.toMatchObject({
        code: "ambiguous_query",
      } satisfies Partial<TextQueryError>);
    } finally {
      spy.mockRestore();
    }
  });
});
