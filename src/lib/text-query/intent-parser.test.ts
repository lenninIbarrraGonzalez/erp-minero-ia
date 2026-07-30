import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LLMProvider, LLMResponse } from "@/lib/llm/types";
import { LLMProviderError } from "@/lib/llm/types";

// We import the module under test AFTER the vi.mock call
vi.mock("server-only", () => ({}));

import { parseIntent } from "./intent-parser";
import type { ParsedIntent, TextQueryError } from "./types";

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
});
