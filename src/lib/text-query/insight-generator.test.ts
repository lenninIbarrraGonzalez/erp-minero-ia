import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LLMProvider, LLMResponse } from "@/lib/llm/types";
import { LLMProviderError } from "@/lib/llm/types";

vi.mock("server-only", () => ({}));

import { generateInsight } from "./insight-generator";
import type { QueryRow } from "./types";

function makeLLM(response: LLMResponse | Error): LLMProvider {
  return {
    name: "mock",
    complete: vi.fn().mockImplementation(() => {
      if (response instanceof Error) return Promise.reject(response);
      return Promise.resolve(response);
    }),
  };
}

const sampleRows: QueryRow[] = [
  { period: "2024-01-01", cost_per_tonne: 15 },
  { period: "2024-02-01", cost_per_tonne: 10 },
];

describe("generateInsight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns insight string when LLM responds successfully", async () => {
    const insightText = "  El costo por tonelada bajó en febrero.  ";
    const llm = makeLLM({ text: insightText, provider: "mock", model: "mock-model" });

    const result = await generateInsight("costo La Escondida", sampleRows, llm);

    expect(result).toBe("El costo por tonelada bajó en febrero.");
  });

  it("passes Spanish-first language instruction in prompt", async () => {
    const llm = makeLLM({ text: "respuesta", provider: "mock", model: "mock-model" });

    await generateInsight("¿Cuánto costó?", sampleRows, llm);

    const prompt = (llm.complete as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(prompt).toContain("Respond in Spanish");
  });

  it("rounds numeric values in data preview sent to LLM", async () => {
    const llm = makeLLM({ text: "ok", provider: "mock", model: "mock-model" });
    const rowsWithLongDecimals: QueryRow[] = [
      { period: "2024-01-01", cost_per_tonne: 29.718293847 },
    ];

    await generateInsight("costo", rowsWithLongDecimals, llm);

    const prompt = (llm.complete as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(prompt).toContain("29.72");
    expect(prompt).not.toContain("29.718293847");
  });

  it("returns empty string when LLM provider throws (graceful degrade, no throw)", async () => {
    const llm = makeLLM(new LLMProviderError("mock", "unavailable"));

    const result = await generateInsight("costo La Escondida", sampleRows, llm);

    expect(result).toBe("");
  });
});
