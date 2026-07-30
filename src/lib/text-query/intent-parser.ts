import "server-only";
import { ParsedIntentSchema } from "./intent-schema";
import type { ParsedIntent, TextQueryError } from "./types";
import type { LLMProvider } from "@/lib/llm/types";
import { LLMProviderError } from "@/lib/llm/types";

// ---------------------------------------------------------------------------
// Intent Parser — converts a natural-language question into a ParsedIntent
// ---------------------------------------------------------------------------

const SCHEMA_DESCRIPTION = `{
  "metric": "cost_per_tonne" | "tonnage" | "cost_by_driver",
  "mineName": string (optional),
  "period": { "year": number, "month": 1-12 (optional) } (optional),
  "groupBy": "mine" | "driver" | "month" (optional)
}`;

function buildPrompt(question: string): string {
  return `You are a mining ERP query parser. Extract the intent from the user's question and respond with ONLY a JSON object matching this schema:

${SCHEMA_DESCRIPTION}

Rules:
- metric must be exactly one of: "cost_per_tonne", "tonnage", "cost_by_driver"
- Convert any date mentions (e.g. "March 2024", "marzo 2024") to year/month numbers
- If no mine is mentioned, omit mineName
- If no time period is mentioned, omit period
- Respond with ONLY valid JSON, no explanation, no markdown, no code blocks

User question: ${question}`;
}

function makeError(
  code: TextQueryError["code"],
  message: string
): TextQueryError & Error {
  const err = new Error(message) as Error & TextQueryError;
  err.code = code;
  err.message = message;
  return err;
}

export async function parseIntent(
  question: string,
  llm: LLMProvider
): Promise<ParsedIntent> {
  let text: string;

  try {
    const response = await llm.complete(buildPrompt(question), {
      maxTokens: 200,
      temperature: 0,
    });
    text = response.text.trim();
  } catch (err) {
    if (err instanceof LLMProviderError) {
      throw makeError("llm_error", `LLM provider failed: ${err.message}`);
    }
    throw makeError("llm_error", "Unknown LLM error");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw makeError("parse_failure", `LLM returned invalid JSON: ${text}`);
  }

  const result = ParsedIntentSchema.safeParse(parsed);
  if (!result.success) {
    // Check specifically for unsupported metric
    const raw = parsed as Record<string, unknown>;
    const knownMetrics = ["cost_per_tonne", "tonnage", "cost_by_driver"];
    if (
      typeof raw?.metric === "string" &&
      !knownMetrics.includes(raw.metric)
    ) {
      throw makeError(
        "unsupported_metric",
        `Unsupported metric: ${raw.metric}`
      );
    }
    throw makeError(
      "parse_failure",
      `Intent does not match expected schema: ${result.error.message}`
    );
  }

  return result.data as ParsedIntent;
}
