import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type MineFilter = string | undefined;

export interface MineOption {
  id: string;
  name: string;
}

export interface DashboardKpis {
  totalTonnage: number;
  costPerTonne: number;
  mineName: string | null;
}

export interface CostTrendPoint {
  period: string;
  costPerTonne: number;
}

export interface CostByDriverPoint {
  driver: string;
  totalCost: number;
}

// ---------------------------------------------------------------------------
// Raw row shapes returned by Supabase (not exposed to callers)
// ---------------------------------------------------------------------------

interface CostEntryRow {
  mine_id: string;
  period: string;
  driver: string;
  amount: number;
}

interface ProductionRunRow {
  mine_id: string;
  period: string;
  tonnage: number;
}

interface MineRow {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCostQuery(db: SupabaseClient, mine: MineFilter) {
  const q = db.from("cost_entries").select("mine_id, period, driver, amount");
  if (mine !== undefined) {
    return q.eq("mine_id", mine);
  }
  return q;
}

function buildProdQuery(db: SupabaseClient, mine: MineFilter) {
  const q = db.from("production_runs").select("mine_id, period, tonnage");
  if (mine !== undefined) {
    return q.eq("mine_id", mine);
  }
  return q;
}

// ---------------------------------------------------------------------------
// fetchPeriodRange
// ---------------------------------------------------------------------------

export interface PeriodRange {
  min: string; // YYYY-MM
  max: string; // YYYY-MM
}

export async function fetchPeriodRange(
  db: SupabaseClient,
): Promise<PeriodRange | null> {
  const [minResult, maxResult] = await Promise.all([
    db.from("cost_entries").select("period").order("period", { ascending: true }).limit(1),
    db.from("cost_entries").select("period").order("period", { ascending: false }).limit(1),
  ]);

  const minPeriod = (minResult.data as Array<{ period: string }> | null)?.[0]?.period;
  const maxPeriod = (maxResult.data as Array<{ period: string }> | null)?.[0]?.period;

  if (!minPeriod || !maxPeriod) return null;

  return { min: minPeriod.slice(0, 7), max: maxPeriod.slice(0, 7) };
}

// ---------------------------------------------------------------------------
// fetchMines
// ---------------------------------------------------------------------------

/**
 * Returns all mines as `{ id, name }` options for the selector.
 * Returns `[]` on error or when no rows exist.
 */
export async function fetchMines(db: SupabaseClient): Promise<MineOption[]> {
  const { data, error } = await db
    .from("mines")
    .select("id, name");

  if (error ?? !data) return [];

  return (data as MineRow[]).map((row) => ({ id: row.id, name: row.name }));
}

// ---------------------------------------------------------------------------
// fetchKpiSummary
// ---------------------------------------------------------------------------

/**
 * Returns aggregated KPIs for the selected mine or all mines.
 * - `costPerTonne` = SUM(amount) / SUM(tonnage); 0 when tonnage is 0.
 * - `mineName` = mine's name string when filtered; `null` when aggregating all.
 */
export async function fetchKpiSummary(
  db: SupabaseClient,
  mine?: MineFilter,
): Promise<DashboardKpis> {
  const [costResult, prodResult] = await Promise.all([
    buildCostQuery(db, mine),
    buildProdQuery(db, mine),
  ]);

  const costRows = (costResult.data ?? []) as CostEntryRow[];
  const prodRows = (prodResult.data ?? []) as ProductionRunRow[];

  const totalAmount = costRows.reduce((sum, r) => sum + Number(r.amount), 0);
  const totalTonnage = prodRows.reduce((sum, r) => sum + Number(r.tonnage), 0);
  const costPerTonne = totalTonnage > 0 ? totalAmount / totalTonnage : 0;

  let mineName: string | null = null;
  if (mine !== undefined) {
    const { data: mineData } = await db
      .from("mines")
      .select("id, name")
      .eq("id", mine);
    const mineRows = (mineData ?? []) as MineRow[];
    mineName = mineRows.length > 0 ? mineRows[0].name : null;
  }

  return { totalTonnage, costPerTonne, mineName };
}

// ---------------------------------------------------------------------------
// fetchCostTrend
// ---------------------------------------------------------------------------

/**
 * Returns cost per tonne grouped by period, sorted ascending.
 * Returns `[]` when no data exists for the mine/filter.
 */
export async function fetchCostTrend(
  db: SupabaseClient,
  mine?: MineFilter,
): Promise<CostTrendPoint[]> {
  const [costResult, prodResult] = await Promise.all([
    buildCostQuery(db, mine),
    buildProdQuery(db, mine),
  ]);

  const costRows = (costResult.data ?? []) as CostEntryRow[];
  const prodRows = (prodResult.data ?? []) as ProductionRunRow[];

  if (costRows.length === 0) return [];

  // Aggregate cost amounts by period
  const amountByPeriod = new Map<string, number>();
  for (const row of costRows) {
    amountByPeriod.set(row.period, (amountByPeriod.get(row.period) ?? 0) + Number(row.amount));
  }

  // Aggregate tonnage by period
  const tonnageByPeriod = new Map<string, number>();
  for (const row of prodRows) {
    tonnageByPeriod.set(row.period, (tonnageByPeriod.get(row.period) ?? 0) + Number(row.tonnage));
  }

  // Compute cost per tonne per period and sort ascending
  const periods = Array.from(amountByPeriod.keys()).sort();
  return periods.map((period) => {
    const amount = amountByPeriod.get(period) ?? 0;
    const tonnage = tonnageByPeriod.get(period) ?? 0;
    const costPerTonne = tonnage > 0 ? amount / tonnage : 0;
    return { period, costPerTonne };
  });
}

// ---------------------------------------------------------------------------
// fetchCostByDriver
// ---------------------------------------------------------------------------

/**
 * Returns total cost grouped by driver for the selected mine or all mines.
 * Applies `.eq('mine_id', mine)` only when mine is defined.
 */
export async function fetchCostByDriver(
  db: SupabaseClient,
  mine?: MineFilter,
): Promise<CostByDriverPoint[]> {
  const query = buildCostQuery(db, mine);
  const { data, error } = await query;

  if (error ?? !data) return [];

  const costRows = data as CostEntryRow[];

  // Group by driver and sum amounts
  const totals = new Map<string, number>();
  for (const row of costRows) {
    totals.set(row.driver, (totals.get(row.driver) ?? 0) + Number(row.amount));
  }

  return Array.from(totals.entries()).map(([driver, totalCost]) => ({
    driver,
    totalCost,
  }));
}
