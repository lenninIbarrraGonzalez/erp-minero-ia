import "server-only";
import type { LLMProvider } from "@/lib/llm/types";
import type { QueryRow } from "./types";

// ---------------------------------------------------------------------------
// Insight Generator — produces a one-sentence natural-language summary
// ---------------------------------------------------------------------------

function roundNumbers(rows: QueryRow[]): QueryRow[] {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [
        k,
        typeof v === "number" ? parseFloat(v.toFixed(2)) : v,
      ])
    )
  );
}

function buildPrompt(question: string, rows: QueryRow[]): string {
  const dataPreview = JSON.stringify(roundNumbers(rows.slice(0, 24)));
  return `You are a mining ERP analyst. Given the user's question and the data below, write 2–3 sentences: (1) the main finding with the most relevant number, (2) a visible trend or anomaly if present, (3) a brief operational implication or recommendation. No markdown, no lists, plain prose only. Respond in Spanish, unless the user's question is clearly written in English or another language.

IMPORTANT: Before making any comparison (highest, lowest, greater, lesser), verify the claim against EVERY value in the data. Do not assume — read all rows carefully.

User question: ${question}

Data: ${dataPreview}

Insight:`;
}

const MIN_INSIGHT_LENGTH = 30;

export async function generateInsight(
  question: string,
  rows: QueryRow[],
  llm: LLMProvider
): Promise<string> {
  const prompt = buildPrompt(question, rows);

  try {
    const response = await llm.complete(prompt, { maxTokens: 350, temperature: 0.3 });
    const text = response.text.trim();
    if (text.length >= MIN_INSIGHT_LENGTH) return text;

    // P5: Retry with higher temperature when response is empty or too short
    const retry = await llm.complete(prompt, { maxTokens: 350, temperature: 0.7 });
    return retry.text.trim();
  } catch {
    try {
      // P5: Retry once on transient LLM error
      const retry = await llm.complete(prompt, { maxTokens: 350, temperature: 0.7 });
      return retry.text.trim();
    } catch {
      return "";
    }
  }
}
