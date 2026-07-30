import "server-only";
import type { LLMProvider } from "@/lib/llm/types";
import type { QueryRow } from "./types";

// ---------------------------------------------------------------------------
// Insight Generator — produces a one-sentence natural-language summary
// ---------------------------------------------------------------------------

function buildPrompt(question: string, rows: QueryRow[]): string {
  const dataPreview = JSON.stringify(rows.slice(0, 10));
  return `You are a mining ERP analyst. Given the user's question and the data below, write ONE concise sentence summarizing the key insight. No markdown, no lists, just one sentence.

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
