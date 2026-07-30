import type { SupabaseClient } from "@supabase/supabase-js";
import { DRIVERS } from "./types";
import type { CostVarianceResult, DriverDelta } from "./types";

// ---------------------------------------------------------------------------
// Internal raw row types
// ---------------------------------------------------------------------------

interface CostEntryRow {
  driver: string;
  amount: number;
}

interface MineRow {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

function makeCostVarianceError(
  code: "mine_not_found" | "no_prior_period",
  message: string
): Error & { code: string } {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

// ---------------------------------------------------------------------------
// computeVariance — pure function, no LLM, no side effects besides Supabase read
// ---------------------------------------------------------------------------

export async function computeVariance(
  db: SupabaseClient,
  mineId: string,
  period: string,
  comparisonPeriod: string
): Promise<Omit<CostVarianceResult, "narrative">> {
  // Fetch mine name
  const { data: mineData } = await (db
    .from("mines")
    .select("id, name")
    .eq("id", mineId) as unknown as Promise<{ data: MineRow[] | null }>);

  const mine = mineData?.[0];
  if (!mine) {
    throw makeCostVarianceError(
      "mine_not_found",
      `Mine not found: ${mineId}`
    );
  }

  // Fetch current period entries
  const { data: currentData } = await (db
    .from("cost_entries")
    .select("driver, amount")
    .eq("mine_id", mineId)
    .eq("period", period) as unknown as Promise<{ data: CostEntryRow[] | null }>);

  // Fetch prior period entries
  const { data: priorData } = await (db
    .from("cost_entries")
    .select("driver, amount")
    .eq("mine_id", mineId)
    .eq("period", comparisonPeriod) as unknown as Promise<{ data: CostEntryRow[] | null }>);

  const currentRows = currentData ?? [];
  const priorRows = priorData ?? [];

  // Check for no_prior_period: prior has 0 rows
  if (priorRows.length === 0) {
    throw makeCostVarianceError(
      "no_prior_period",
      `No cost entries found for comparison period: ${comparisonPeriod}`
    );
  }

  // Aggregate amounts by driver using a Map
  const currentByDriver = new Map<string, number>();
  for (const row of currentRows) {
    currentByDriver.set(
      row.driver,
      (currentByDriver.get(row.driver) ?? 0) + Number(row.amount)
    );
  }

  const priorByDriver = new Map<string, number>();
  for (const row of priorRows) {
    priorByDriver.set(
      row.driver,
      (priorByDriver.get(row.driver) ?? 0) + Number(row.amount)
    );
  }

  // Build DriverDelta[] — zero-fill all 4 DRIVERS
  const drivers: DriverDelta[] = DRIVERS.map((driver) => {
    const currentAmount = currentByDriver.get(driver) ?? 0;
    const priorAmount = priorByDriver.get(driver) ?? 0;
    const delta = currentAmount - priorAmount;
    const deltaPct =
      priorAmount !== 0 ? (delta / priorAmount) * 100 : null;

    return { driver, currentAmount, priorAmount, delta, deltaPct };
  });

  // Compute totals
  const totalCurrent = drivers.reduce((sum, d) => sum + d.currentAmount, 0);
  const totalPrior = drivers.reduce((sum, d) => sum + d.priorAmount, 0);
  const totalDelta = totalCurrent - totalPrior;
  const totalDeltaPct =
    totalPrior !== 0 ? (totalDelta / totalPrior) * 100 : null;

  return {
    mineId,
    mineName: mine.name,
    period,
    comparisonPeriod,
    drivers,
    totalCurrent,
    totalPrior,
    totalDelta,
    totalDeltaPct,
  };
}
