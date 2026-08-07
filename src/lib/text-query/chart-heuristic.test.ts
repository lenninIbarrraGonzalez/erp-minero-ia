import { describe, it, expect } from "vitest";
import type { ParsedIntent, QueryRow } from "./types";
import { getChartType } from "./chart-heuristic";

const rows: QueryRow[] = [
  { period: "2024-01-01", value: 10 },
  { period: "2024-02-01", value: 12 },
];

const singleRow: QueryRow[] = [{ period: "2024-08-01", value: 10 }];

const emptyRows: QueryRow[] = [];

describe("getChartType", () => {
  it("returns 'line' for cost_per_tonne with a period.month (temporal query)", () => {
    const intent: ParsedIntent = {
      metric: "cost_per_tonne",
      period: { year: 2024, month: 3 },
    };
    expect(getChartType(intent, rows)).toBe("line");
  });

  it("returns 'line' for cost_per_tonne without a period when rows have period column", () => {
    const intent: ParsedIntent = {
      metric: "cost_per_tonne",
    };
    expect(getChartType(intent, rows)).toBe("line");
  });

  it("returns 'bar' for cost_per_tonne when rows have no period column", () => {
    const intent: ParsedIntent = {
      metric: "cost_per_tonne",
    };
    const nonTemporalRows: QueryRow[] = [{ driver: "fuel", amount: 100 }];
    expect(getChartType(intent, nonTemporalRows)).toBe("bar");
  });

  it("returns 'line' for tonnage with period column in rows", () => {
    const intent: ParsedIntent = {
      metric: "tonnage",
      groupBy: "month",
    };
    expect(getChartType(intent, rows)).toBe("line");
  });

  it("returns 'bar' for cost_by_driver when rows have driver-category shape", () => {
    const intent: ParsedIntent = {
      metric: "cost_by_driver",
      period: { year: 2024, month: 1 },
    };
    const driverRows: QueryRow[] = [{ driver: "fuel", amount: 500000 }];
    expect(getChartType(intent, driverRows)).toBe("bar");
  });

  it("returns 'none' when rows are empty", () => {
    const intent: ParsedIntent = {
      metric: "cost_per_tonne",
      period: { year: 2024, month: 1 },
    };
    expect(getChartType(intent, emptyRows)).toBe("none");
  });

  it("returns 'none' for a single-row temporal result (no trend to show)", () => {
    const intent: ParsedIntent = {
      metric: "cost_per_tonne",
      period: { year: 2024, month: 8 },
    };
    expect(getChartType(intent, singleRow)).toBe("none");
  });

  it("returns 'line' for cost_by_driver when rows have a period column (time-series)", () => {
    const intent: ParsedIntent = {
      metric: "cost_by_driver",
      driverFilter: "fuel",
      groupBy: "month",
    };
    const timeSeriesRows: QueryRow[] = [
      { period: "2024-01-01", amount: 500000 },
      { period: "2024-02-01", amount: 480000 },
    ];
    expect(getChartType(intent, timeSeriesRows)).toBe("line");
  });
});
