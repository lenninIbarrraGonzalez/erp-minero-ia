import "server-only";
import type { LLMProvider } from "@/lib/llm/types";
import type { CostVarianceResult } from "./types";

function buildPrompt(result: Omit<CostVarianceResult, "narrative">): string {
  const topDriver = [...result.drivers].sort(
    (a, b) => Math.abs(b.delta) - Math.abs(a.delta)
  )[0];
  const direction = result.totalDelta >= 0 ? "increased" : "decreased";

  return `You are a mining ERP analyst. Summarize the following cost variance in 2-3 sentences. No markdown, no lists, plain text only.

Mine: ${result.mineName}
Period: ${result.period} vs ${result.comparisonPeriod}
Total cost ${direction} by ${Math.abs(result.totalDelta).toFixed(0)} (${result.totalDeltaPct !== null ? result.totalDeltaPct.toFixed(1) + "%" : "N/A"}).
Largest driver change: ${topDriver.driver} (Δ ${topDriver.delta.toFixed(0)}).

Variance summary:`;
}

export async function narrateVariance(
  result: Omit<CostVarianceResult, "narrative">,
  llm: LLMProvider
): Promise<string> {
  try {
    const response = await llm.complete(buildPrompt(result), {
      maxTokens: 150,
      temperature: 0.3,
    });
    return response.text.trim();
  } catch {
    return "";
  }
}
