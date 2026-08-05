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
- If no specific mine is mentioned, omit mineName entirely. Phrases like "all mines", "todas las minas", "todas" mean no specific mine — omit mineName
- If no time period is mentioned, omit period entirely (do not set year or month to null)
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

  // Strip markdown code fences if the model wraps the JSON
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw makeError("parse_failure", `LLM returned invalid JSON: ${cleaned}`);
  }

  // Some models return null for optional fields instead of omitting them.
  // Strip null/undefined values AND empty objects so Zod optional() works correctly.
  function stripNulls(obj: unknown): unknown {
    if (obj === null || obj === undefined) return undefined;
    if (typeof obj !== "object" || Array.isArray(obj)) return obj;
    const entries = Object.entries(obj as Record<string, unknown>)
      .map(([k, v]) => [k, stripNulls(v)] as [string, unknown])
      .filter(([, v]) => v !== undefined);
    if (entries.length === 0) return undefined;
    return Object.fromEntries(entries);
  }
  const cleaned2 = stripNulls(parsed);
  const result = ParsedIntentSchema.safeParse(cleaned2);
  if (!result.success) {
    const raw = parsed as Record<string, unknown>;
    const knownMetrics = ["cost_per_tonne", "tonnage", "cost_by_driver"];
    if (typeof raw?.metric === "string" && !knownMetrics.includes(raw.metric)) {
      throw makeError("unsupported_metric", `Unsupported metric: ${raw.metric}`);
    }
    const detail = JSON.stringify(result.error.issues ?? result.error);
    throw makeError("parse_failure", `Intent does not match expected schema: ${detail}`);
  }

  return result.data as ParsedIntent;
}
