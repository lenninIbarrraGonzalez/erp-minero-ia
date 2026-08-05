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

function buildCostQuery(db: SupabaseClient, mineId?: string): AnyQuery {
  const q = db.from("cost_entries").select("mine_id, period, driver, amount");
  return mineId !== undefined ? q.eq("mine_id", mineId) : q;
}

function buildProdQuery(db: SupabaseClient, mineId?: string): AnyQuery {
  const q = db.from("production_runs").select("mine_id, period, tonnage");
  return mineId !== undefined ? q.eq("mine_id", mineId) : q;
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
  mineId?: string
): Promise<QueryRow[]> {
  const [costResult, prodResult] = await Promise.all([
    buildCostQuery(db, mineId),
    buildProdQuery(db, mineId),
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
  mineId?: string
): Promise<QueryRow[]> {
  const result = await buildProdQuery(db, mineId);
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
  mineId?: string
): Promise<QueryRow[]> {
  const result = await buildCostQuery(db, mineId);
  const rows = (result.data ?? []) as CostEntryRow[];

  if (rows.length === 0) return [];

  // Group by driver and sum amounts
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.driver, (totals.get(row.driver) ?? 0) + Number(row.amount));
  }

  return Array.from(totals.entries()).map(([driver, amount]) => ({
    driver,
    amount,
  }));
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function buildAndExecuteQuery(
  db: SupabaseClient,
  intent: ParsedIntent
): Promise<QueryRow[]> {
  // Resolve mine name to ID if provided
  let mineId: string | undefined;
  if (intent.mineName) {
    mineId = await resolveMineId(db, intent.mineName);
  }

  // Dispatch to per-metric function
  let rows: QueryRow[];
  switch (intent.metric) {
    case "cost_per_tonne":
      rows = await queryCostPerTonne(db, mineId);
      break;
    case "tonnage":
      rows = await queryTonnage(db, mineId);
      break;
    case "cost_by_driver":
      rows = await queryCostByDriver(db, mineId);
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
