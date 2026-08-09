import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseIntent } from "@/lib/text-query/intent-parser";
import { buildAndExecuteQuery } from "@/lib/text-query/query-builder";
import { getChartType } from "@/lib/text-query/chart-heuristic";
import { generateInsight } from "@/lib/text-query/insight-generator";
import { createLlmChain } from "@/lib/llm/create-llm-provider";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TextQueryError } from "@/lib/text-query/types";

const RequestSchema = z.object({
  question: z.string().min(1).max(500),
  mineId: z.string().uuid().optional(),
});

function isTextQueryError(err: unknown): err is TextQueryError & Error {
  return (
    err instanceof Error &&
    typeof (err as TextQueryError & Error).code === "string"
  );
}

export async function POST(request: Request) {
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "textQuery.error.invalidQuestion" },
      { status: 422 }
    );
  }

  const parsed = RequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "textQuery.error.invalidQuestion" },
      { status: 422 }
    );
  }

  const { question } = parsed.data;

  // I4: Pre-flight year check — skip LLM entirely for years outside the data range.
  // Only 2024 data is available; keep in sync with DATA_YEAR_MIN/MAX in query-builder.ts.
  const yearMatch = /\b(20\d{2})\b/.exec(question.trim());
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    if (year < 2024 || year > 2024) {
      return NextResponse.json(
        { rows: [], chartType: "none", insightText: "" },
        { status: 200 }
      );
    }
  }

  const llm = createLlmChain();
  const db = createSupabaseServerClient();

  try {
    const intent = await parseIntent(question.trim(), llm);

    const rows = await buildAndExecuteQuery(db, intent);
    const chartType = getChartType(intent, rows);
    const insightText = await generateInsight(question.trim(), rows, llm);

    return NextResponse.json({ rows, chartType, insightText }, { status: 200 });
  } catch (err) {
    if (isTextQueryError(err)) {
      if (err.code === "empty_result") {
        return NextResponse.json(
          { rows: [], chartType: "none", insightText: "" },
          { status: 200 }
        );
      }
      return NextResponse.json({ error: err.code }, { status: 422 });
    }

    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
