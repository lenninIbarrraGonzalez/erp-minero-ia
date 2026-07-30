import "server-only";
import { NextResponse } from "next/server";
import { parseIntent } from "@/lib/text-query/intent-parser";
import { buildAndExecuteQuery } from "@/lib/text-query/query-builder";
import { getChartType } from "@/lib/text-query/chart-heuristic";
import { generateInsight } from "@/lib/text-query/insight-generator";
import { createLlmChain } from "@/lib/llm/create-llm-provider";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TextQueryError } from "@/lib/text-query/types";

function isTextQueryError(err: unknown): err is TextQueryError & Error {
  return (
    err instanceof Error &&
    typeof (err as TextQueryError & Error).code === "string"
  );
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "textQuery.error.invalidQuestion" },
      { status: 422 }
    );
  }

  const { question, mineId } = body as {
    question?: unknown;
    mineId?: unknown;
  };

  if (!question || typeof question !== "string" || question.trim() === "") {
    return NextResponse.json(
      { error: "textQuery.error.invalidQuestion" },
      { status: 422 }
    );
  }

  const llm = createLlmChain();
  const db = createSupabaseServerClient();

  try {
    const intent = await parseIntent(question.trim(), llm);

    // If mineId is provided as a string, inject it directly into the intent
    // so query-builder skips mine-name resolution
    const resolvedIntent =
      typeof mineId === "string" && mineId.trim() !== ""
        ? { ...intent, mineName: undefined, _mineIdDirect: mineId }
        : intent;

    const rows = await buildAndExecuteQuery(db, resolvedIntent as typeof intent);
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
