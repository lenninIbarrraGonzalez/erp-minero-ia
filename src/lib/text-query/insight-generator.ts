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
  const dataPreview = JSON.stringify(roundNumbers(rows.slice(0, 10)));
  return `You are a mining ERP analyst. Given the user's question and the data below, write ONE concise sentence summarizing the key insight. No markdown, no lists, just one sentence. Respond in Spanish, unless the user's question is clearly written in English or another language.

IMPORTANT: Before making any comparison (highest, lowest, greater, lesser), verify the claim against EVERY value in the data. Do not assume — read all rows carefully.

User question: ${question}

Data: ${dataPreview}

Insight:`;
}

export async function generateInsight(
  question: string,
  rows: QueryRow[],
  llm: LLMProvider
): Promise<string> {
  try {
    const response = await llm.complete(buildPrompt(question, rows), {
      maxTokens: 150,
      temperature: 0.3,
    });
    return response.text.trim();
  } catch {
    // Graceful degrade — insight is non-critical
    return "";
  }
}
