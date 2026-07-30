import { describe, it, expect } from "vitest";
import type { ParsedIntent, QueryRow } from "./types";
import { getChartType } from "./chart-heuristic";

const rows: QueryRow[] = [
  { period: "2024-01-01", value: 10 },
];

const emptyRows: QueryRow[] = [];

describe("getChartType", () => {
  it("returns 'line' for cost_per_tonne with a period.month (temporal query)", () => {
    const intent: ParsedIntent = {
      metric: "cost_per_tonne",
      period: { year: 2024, month: 3 },
    };
    expect(getChartType(intent, rows)).toBe("line");
  });

  it("returns 'bar' for cost_per_tonne without a period (no temporal)", () => {
    const intent: ParsedIntent = {
      metric: "cost_per_tonne",
    };
    expect(getChartType(intent, rows)).toBe("bar");
  });

  it("returns 'line' for tonnage with groupBy=month (temporal)", () => {
    const intent: ParsedIntent = {
      metric: "tonnage",
      groupBy: "month",
    };
    expect(getChartType(intent, rows)).toBe("line");
  });

  it("returns 'bar' for cost_by_driver regardless of period", () => {
    const intent: ParsedIntent = {
      metric: "cost_by_driver",
      period: { year: 2024, month: 1 },
    };
    expect(getChartType(intent, rows)).toBe("bar");
  });

  it("returns 'none' when rows are empty", () => {
    const intent: ParsedIntent = {
      metric: "cost_per_tonne",
      period: { year: 2024, month: 1 },
    };
    expect(getChartType(intent, emptyRows)).toBe("none");
  });
});
