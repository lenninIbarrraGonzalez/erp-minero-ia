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
 * - rows have a 'period' column → 'line' (temporal series, regardless of intent flags)
 * - everything else → 'bar'
 */
export function getChartType(intent: ParsedIntent, rows: QueryRow[]): ChartType {
  if (rows.length === 0) return "none";

  if (intent.metric === "cost_by_driver") {
    // Multi-mine full breakdown has both mine and driver columns — too complex for a simple chart
    if ("mine" in rows[0] && "driver" in rows[0]) return "none";
    // Time-series result (groupBy: "month") has a period column → line chart
    if ("period" in rows[0]) return "line";
    return "bar";
  }

  const hasPeriodColumn = "period" in rows[0];
  return hasPeriodColumn ? "line" : "bar";
}
