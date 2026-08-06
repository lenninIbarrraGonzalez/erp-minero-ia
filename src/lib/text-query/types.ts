// ---------------------------------------------------------------------------
// Domain types for the text-to-query pipeline
// ---------------------------------------------------------------------------

export type ChartType = "line" | "bar" | "none";

export type Metric = "cost_per_tonne" | "tonnage" | "cost_by_driver";

export interface ParsedIntent {
  metric: Metric;
  mineName?: string;
  mineNames?: string[]; // 2+ mines for comparison queries
  driverFilter?: "fuel" | "supplies" | "equipment" | "labor";
  period?: {
    year: number;
    month?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
    quarter?: 1 | 2 | 3 | 4;
  };
  groupBy?: "mine" | "driver" | "month";
}

export type QueryRow = Record<string, string | number>;

export interface QueryResult {
  rows: QueryRow[];
  chartType: ChartType;
  insightText: string;
}

export interface TextQueryError {
  code:
    | "parse_failure"
    | "unsupported_metric"
    | "mine_not_found"
    | "empty_result"
    | "llm_error"
    | "db_error"
    | "out_of_scope";
  message: string;
}
