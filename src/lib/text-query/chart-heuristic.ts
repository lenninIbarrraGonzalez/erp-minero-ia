import type { ChartType, ParsedIntent, QueryRow } from "./types";

// ---------------------------------------------------------------------------
// Chart type heuristic — pure function, no side effects
// ---------------------------------------------------------------------------

/**
 * Determines the appropriate chart type based on the query intent and result rows.
 *
 * Decision table:
 * - empty rows → 'none'
 * - cost_by_driver → always 'bar' (drivers are categorical, not temporal)
 * - cost_per_tonne with period.month OR tonnage with groupBy=month → 'line' (temporal series)
 * - everything else → 'bar'
 */
export function getChartType(intent: ParsedIntent, rows: QueryRow[]): ChartType {
  if (rows.length === 0) return "none";

  if (intent.metric === "cost_by_driver") return "bar";

  const isTemporal =
    (intent.period?.month !== undefined) ||
    intent.groupBy === "month";

  return isTemporal ? "line" : "bar";
}
