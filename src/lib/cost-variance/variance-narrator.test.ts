import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LLMProvider, LLMResponse } from "@/lib/llm/types";

vi.mock("server-only", () => ({}));

import { narrateVariance } from "./variance-narrator";
import type { CostVarianceResult } from "./types";

function makeLLM(response: LLMResponse | Error): LLMProvider {
  return {
    name: "mock",
    complete: vi.fn().mockImplementation(() => {
      if (response instanceof Error) return Promise.reject(response);
      return Promise.resolve(response);
    }),
  };
}

const sampleResult: Omit<CostVarianceResult, "narrative"> = {
  mineId: "550e8400-e29b-41d4-a716-446655440000",
  mineName: "La Escondida",
  period: "2024-08-01",
  comparisonPeriod: "2024-07-01",
  drivers: [
    { driver: "fuel", currentAmount: 5000, priorAmount: 800, delta: 4200, deltaPct: 525 },
    { driver: "supplies", currentAmount: 310, priorAmount: 250, delta: 60, deltaPct: 24 },
    { driver: "equipment", currentAmount: 210, priorAmount: 150, delta: 60, deltaPct: 40 },
    { driver: "labor", currentAmount: 600, priorAmount: 400, delta: 200, deltaPct: 50 },
  ],
  totalCurrent: 6120,
  totalPrior: 1600,
  totalDelta: 4520,
  totalDeltaPct: 282.5,
};

describe("narrateVariance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns trimmed LLM response string on success", async () => {
    const llm = makeLLM({
      text: "  Fuel costs spiked dramatically in August.  ",
      provider: "mock",
      model: "mock-model",
    });

    const narrative = await narrateVariance(sampleResult, llm);

    expect(narrative).toBe("Fuel costs spiked dramatically in August.");
  });

  it("returns empty string when LLM throws without propagating the error", async () => {
    const llm = makeLLM(new Error("LLM unavailable"));

    const result = await narrateVariance(sampleResult, llm);

    expect(result).toBe("");
  });

  it("calls llm.complete with maxTokens 150 and temperature 0.3", async () => {
    const completeMock = vi.fn().mockResolvedValue({
      text: "Costs increased.",
      provider: "mock",
      model: "mock-model",
    });
    const llm: LLMProvider = { name: "mock", complete: completeMock };

    await narrateVariance(sampleResult, llm);

    expect(completeMock).toHaveBeenCalledWith(
      expect.any(String),
      { maxTokens: 150, temperature: 0.3 }
    );
  });

  it("prompt includes mine name and period information", async () => {
    const completeMock = vi.fn().mockResolvedValue({
      text: "narrative",
      provider: "mock",
      model: "mock-model",
    });
    const llm: LLMProvider = { name: "mock", complete: completeMock };

    await narrateVariance(sampleResult, llm);

    const promptArg = completeMock.mock.calls[0][0] as string;
    expect(promptArg).toContain("La Escondida");
    expect(promptArg).toContain("2024-08-01");
  });
});
