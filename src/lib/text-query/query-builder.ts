import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedIntent, QueryRow, TextQueryError } from "./types";

// ---------------------------------------------------------------------------
// Internal raw row types
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
// Error helper
// ---------------------------------------------------------------------------

function makeError(
  code: TextQueryError["code"],
  message: string
): TextQueryError & Error {
  const err = new Error(message) as Error & TextQueryError;
  err.code = code;
  err.message = message;
  return err;
}

// ---------------------------------------------------------------------------
// Supabase query helpers — mirror dashboard.ts pattern
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any;

interface PeriodRange {
  start: string;
  end: string; // exclusive upper bound
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function buildPeriodRange(period: ParsedIntent["period"]): PeriodRange | undefined {
  if (!period) return undefined;
  const { year, month, quarter } = period;

  if (quarter !== undefined) {
    const startMonth = (quarter - 1) * 3 + 1; // Q1→1, Q2→4, Q3→7, Q4→10
    const endMonth = quarter * 3;              // Q1→3, Q2→6, Q3→9, Q4→12
    const nextMonth = endMonth === 12 ? 1 : endMonth + 1;
    const nextYear = endMonth === 12 ? year + 1 : year;
    return { start: `${year}-${pad(startMonth)}-01`, end: `${nextYear}-${pad(nextMonth)}-01` };
  }

  if (month !== undefined) {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return { start: `${year}-${pad(month)}-01`, end: `${nextYear}-${pad(nextMonth)}-01` };
  }

  return { start: `${year}-01-01`, end: `${year + 1}-01-01` };
}

function buildCostQuery(db: SupabaseClient, mineId?: string, range?: PeriodRange): AnyQuery {
  let q = db.from("cost_entries").select("mine_id, period, driver, amount");
  if (mineId !== undefined) q = q.eq("mine_id", mineId);
  if (range !== undefined) q = q.gte("period", range.start).lt("period", range.end);
  return q;
}

function buildProdQuery(db: SupabaseClient, mineId?: string, range?: PeriodRange): AnyQuery {
  let q = db.from("production_runs").select("mine_id, period, tonnage");
  if (mineId !== undefined) q = q.eq("mine_id", mineId);
  if (range !== undefined) q = q.gte("period", range.start).lt("period", range.end);
  return q;
}

// ---------------------------------------------------------------------------
// Mine name resolution
// ---------------------------------------------------------------------------

const GENERIC_MINE_TERMS = new Set([
  "all", "todas", "todas las minas", "all mines", "minas", "mines",
  "every mine", "each mine", "cualquier mina",
]);

async function resolveMineId(
  db: SupabaseClient,
  mineName: string
): Promise<string | undefined> {
  // Generic terms mean "no specific mine" — return undefined to query all
  if (GENERIC_MINE_TERMS.has(mineName.toLowerCase().trim())) {
    return undefined;
  }

  const { data, error } = await db.from("mines").select("id, name");

  if (error ?? !data) {
    throw makeError("db_error", "Failed to fetch mines");
  }

  const mines = data as MineRow[];
  const lower = mineName.toLowerCase();
  const match = mines.find(
    (m) => m.name.toLowerCase() === lower || m.name.toLowerCase().includes(lower)
  );

  if (!match) {
    throw makeError("mine_not_found", `Mine not found: ${mineName}`);
  }

  return match.id;
}

// ---------------------------------------------------------------------------
// Per-metric query functions
// ---------------------------------------------------------------------------

async function queryCostPerTonne(
  db: SupabaseClient,
  mineId?: string,
  range?: PeriodRange
): Promise<QueryRow[]> {
  const [costResult, prodResult] = await Promise.all([
    buildCostQuery(db, mineId, range),
    buildProdQuery(db, mineId, range),
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

  // Compute cost per tonne per period, sorted ascending
  const periods = Array.from(amountByPeriod.keys()).sort();
  return periods.map((period) => {
    const amount = amountByPeriod.get(period) ?? 0;
    const tonnage = tonnageByPeriod.get(period) ?? 0;
    const cost_per_tonne = tonnage > 0 ? amount / tonnage : 0;
    return { period, cost_per_tonne };
  });
}

async function queryTonnage(
  db: SupabaseClient,
  mineId?: string,
  range?: PeriodRange
): Promise<QueryRow[]> {
  const result = await buildProdQuery(db, mineId, range);
  const rows = (result.data ?? []) as ProductionRunRow[];

  if (rows.length === 0) return [];

  // Aggregate tonnage by period
  const tonnageByPeriod = new Map<string, number>();
  for (const row of rows) {
    tonnageByPeriod.set(row.period, (tonnageByPeriod.get(row.period) ?? 0) + Number(row.tonnage));
  }

  const periods = Array.from(tonnageByPeriod.keys()).sort();
  return periods.map((period) => ({
    period,
    tonnage: tonnageByPeriod.get(period) ?? 0,
  }));
}

async function queryCostByDriver(
  db: SupabaseClient,
  mineId?: string,
  range?: PeriodRange,
  driverFilter?: string
): Promise<QueryRow[]> {
  const result = await buildCostQuery(db, mineId, range);
  const rows = (result.data ?? []) as CostEntryRow[];

  if (rows.length === 0) return [];

  const filtered = driverFilter
    ? rows.filter((r) => r.driver === driverFilter)
    : rows;

  // Group by driver and sum amounts
  const totals = new Map<string, number>();
  for (const row of filtered) {
    totals.set(row.driver, (totals.get(row.driver) ?? 0) + Number(row.amount));
  }

  return Array.from(totals.entries()).map(([driver, amount]) => ({
    driver,
    amount,
  }));
}

async function queryTonnageByMine(
  db: SupabaseClient,
  range?: PeriodRange
): Promise<QueryRow[]> {
  const [minesResult, prodResult] = await Promise.all([
    db.from("mines").select("id, name"),
    buildProdQuery(db, undefined, range),
  ]);

  const mines = (minesResult.data ?? []) as MineRow[];
  const prodRows = (prodResult.data ?? []) as ProductionRunRow[];

  const tonnageByMineId = new Map<string, number>();
  for (const row of prodRows) {
    tonnageByMineId.set(row.mine_id, (tonnageByMineId.get(row.mine_id) ?? 0) + Number(row.tonnage));
  }

  return mines
    .filter((m) => tonnageByMineId.has(m.id))
    .map((m) => ({ mine: m.name, total_tonnage: tonnageByMineId.get(m.id) ?? 0 }))
    .sort((a, b) => (b.total_tonnage as number) - (a.total_tonnage as number));
}

async function queryCostByDriverTimeSeries(
  db: SupabaseClient,
  driverFilter: string,
  mineId?: string,
  range?: PeriodRange
): Promise<QueryRow[]> {
  const result = await buildCostQuery(db, mineId, range);
  const rows = (result.data ?? []) as CostEntryRow[];

  const filtered = rows.filter((r) => r.driver === driverFilter);

  const amountByPeriod = new Map<string, number>();
  for (const row of filtered) {
    amountByPeriod.set(row.period, (amountByPeriod.get(row.period) ?? 0) + Number(row.amount));
  }

  const periods = Array.from(amountByPeriod.keys()).sort();
  return periods.map((period) => ({ period, amount: amountByPeriod.get(period) ?? 0 }));
}

// ---------------------------------------------------------------------------
// Multi-mine comparison
// ---------------------------------------------------------------------------

async function buildMultiMineQuery(
  db: SupabaseClient,
  intent: ParsedIntent
): Promise<QueryRow[]> {
  const names = intent.mineNames!;
  const periodRange = buildPeriodRange(intent.period);

  // Resolve all mine IDs in parallel — throws mine_not_found for any mismatch
  const resolved = await Promise.all(
    names.map(async (name) => ({ name, id: await resolveMineId(db, name) }))
  );

  switch (intent.metric) {
    case "cost_by_driver": {
      const driverFilter = intent.driverFilter;
      const results = await Promise.all(
        resolved.map(({ id }) => queryCostByDriver(db, id, periodRange, driverFilter))
      );
      if (driverFilter) {
        // Specific driver: one row per mine with the filtered amount
        return resolved.map(({ name }, i) => ({
          mine: name,
          amount: parseFloat(
            results[i].reduce((sum, r) => sum + Number(r.amount), 0).toFixed(2)
          ),
        }));
      }
      // Full breakdown: one row per mine+driver combination
      return resolved.flatMap(({ name }, i) =>
        results[i].map((r) => ({
          mine: name,
          driver: r.driver,
          amount: r.amount,
        }))
      );
    }
    case "cost_per_tonne": {
      const results = await Promise.all(
        resolved.map(({ id }) => queryCostPerTonne(db, id, periodRange))
      );
      return resolved.map(({ name }, i) => {
        const rows = results[i];
        const avg =
          rows.length > 0
            ? rows.reduce((sum, r) => sum + Number(r.cost_per_tonne), 0) / rows.length
            : 0;
        return { mine: name, avg_cost_per_tonne: parseFloat(avg.toFixed(2)) };
      });
    }
    case "tonnage": {
      const results = await Promise.all(
        resolved.map(({ id }) => queryTonnage(db, id, periodRange))
      );
      return resolved.map(({ name }, i) => ({
        mine: name,
        total_tonnage: results[i].reduce((sum, r) => sum + Number(r.tonnage), 0),
      }));
    }
    default: {
      const _exhaustive: never = intent.metric;
      throw makeError("unsupported_metric", `Unsupported metric: ${String(_exhaustive)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function buildAndExecuteQuery(
  db: SupabaseClient,
  intent: ParsedIntent
): Promise<QueryRow[]> {
  // Multi-mine comparison mode
  if (intent.mineNames && intent.mineNames.length >= 2) {
    const rows = await buildMultiMineQuery(db, intent);
    if (rows.length === 0) {
      throw makeError("empty_result", "No data found for the given query");
    }
    return rows;
  }

  // Single-mine or all-mines mode
  let mineId: string | undefined;
  if (intent.mineName) {
    mineId = await resolveMineId(db, intent.mineName);
  }

  const periodRange = buildPeriodRange(intent.period);

  let rows: QueryRow[];
  switch (intent.metric) {
    case "cost_per_tonne":
      rows = await queryCostPerTonne(db, mineId, periodRange);
      break;
    case "tonnage":
      if (intent.groupBy === "mine") {
        rows = await queryTonnageByMine(db, periodRange);
      } else {
        rows = await queryTonnage(db, mineId, periodRange);
      }
      break;
    case "cost_by_driver":
      if (intent.groupBy === "month" && intent.driverFilter) {
        rows = await queryCostByDriverTimeSeries(db, intent.driverFilter, mineId, periodRange);
      } else {
        rows = await queryCostByDriver(db, mineId, periodRange, intent.driverFilter);
      }
      break;
    default: {
      const _exhaustive: never = intent.metric;
      throw makeError("unsupported_metric", `Unsupported metric: ${String(_exhaustive)}`);
    }
  }

  if (rows.length === 0) {
    throw makeError("empty_result", "No data found for the given query");
  }

  return rows;
}
