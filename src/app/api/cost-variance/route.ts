import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { computeVariance } from "@/lib/cost-variance/variance-calculator";
import { narrateVariance } from "@/lib/cost-variance/variance-narrator";
import { createLlmChain } from "@/lib/llm/create-llm-provider";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CostVarianceErrorCode } from "@/lib/cost-variance/types";

const RequestSchema = z.object({
  mineId: z.string().uuid(),
  period: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "period must be YYYY-MM-DD"),
  comparisonPeriod: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "comparisonPeriod must be YYYY-MM-DD")
    .optional(),
});

function priorMonth(isoDate: string): string {
  const [year, month] = isoDate.split("-").map(Number);
  const d = new Date(year, month - 2, 1); // month-2 because month is 1-based and we want prior
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function isCostVarianceError(
  err: unknown
): err is Error & { code: CostVarianceErrorCode } {
  return (
    err instanceof Error &&
    typeof (err as { code?: unknown }).code === "string" &&
    ["invalid_input", "mine_not_found", "no_prior_period"].includes(
      (err as { code: string }).code
    )
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 422 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 422 });
  }

  const { mineId, period } = parsed.data;
  const comparisonPeriod = parsed.data.comparisonPeriod ?? priorMonth(period);

  const db = createSupabaseServerClient();
  const llm = createLlmChain();

  try {
    const varianceResult = await computeVariance(db, mineId, period, comparisonPeriod);
    const narrative = await narrateVariance(varianceResult, llm);

    return NextResponse.json({ ...varianceResult, narrative }, { status: 200 });
  } catch (err) {
    if (isCostVarianceError(err)) {
      return NextResponse.json({ error: err.code }, { status: 422 });
    }
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
