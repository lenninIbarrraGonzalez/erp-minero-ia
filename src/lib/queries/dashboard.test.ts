import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchMines,
  fetchKpiSummary,
  fetchCostTrend,
  fetchCostByDriver,
} from "./dashboard";

// ---------------------------------------------------------------------------
// Chainable Supabase query builder mock
// ---------------------------------------------------------------------------

type MockResult<T> = { data: T; error: null };

function makeQueryBuilder<T>(result: MockResult<T>) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: (resolve: (value: MockResult<T>) => unknown) => resolve(result),
  };
  return builder;
}

function makeDb<T>(result: MockResult<T>): SupabaseClient {
  const builder = makeQueryBuilder(result);
  return {
    from: vi.fn().mockReturnValue(builder),
  } as unknown as SupabaseClient;
}

// ---------------------------------------------------------------------------
// fetchMines
// ---------------------------------------------------------------------------

describe("fetchMines", () => {
  it("returns an array of MineOption when mock returns rows", async () => {
    const rows = [
      { id: "uuid-1", name: "Mina Norte" },
      { id: "uuid-2", name: "Mina Sur" },
    ];
    const db = makeDb({ data: rows, error: null });

    const result = await fetchMines(db);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: "uuid-1", name: "Mina Norte" });
    expect(result[1]).toEqual({ id: "uuid-2", name: "Mina Sur" });
  });

  it("returns an empty array without throwing when mock returns zero rows", async () => {
    const db = makeDb({ data: [], error: null });

    const result = await fetchMines(db);

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// fetchKpiSummary
// ---------------------------------------------------------------------------

describe("fetchKpiSummary", () => {
  it("returns aggregated KPIs with costPerTonne = SUM(amount)/SUM(tonnage) when mineId provided", async () => {
    // cost_entries and production_runs are queried together
    // The implementation fetches both and computes in TS
    // We mock two separate .from() calls — need separate db stubs per call
    const costRows = [
      { mine_id: "uuid-1", period: "2024-01-01", driver: "fuel", amount: 5000 },
      { mine_id: "uuid-1", period: "2024-01-01", driver: "labor", amount: 3000 },
    ];
    const prodRows = [
      { mine_id: "uuid-1", period: "2024-01-01", tonnage: 400 },
    ];
    const mineRows = [{ id: "uuid-1", name: "Mina Norte" }];

    let callCount = 0;
    const builderCost = makeQueryBuilder({ data: costRows, error: null });
    const builderProd = makeQueryBuilder({ data: prodRows, error: null });
    const builderMine = makeQueryBuilder({ data: mineRows, error: null });

    const db = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "cost_entries") return builderCost;
        if (table === "production_runs") return builderProd;
        if (table === "mines") return builderMine;
        callCount++;
        return makeQueryBuilder({ data: [], error: null });
      }),
    } as unknown as SupabaseClient;

    const result = await fetchKpiSummary(db, "uuid-1");

    // SUM(amount) = 8000, SUM(tonnage) = 400 → costPerTonne = 20
    expect(result.costPerTonne).toBeCloseTo(20);
    expect(result.totalTonnage).toBe(400);
    expect(result.mineName).toBe("Mina Norte");
    void callCount;
  });

  it("returns mineName null and aggregates all mines when no mineId provided", async () => {
    const costRows = [
      { mine_id: "uuid-1", period: "2024-01-01", driver: "fuel", amount: 6000 },
      { mine_id: "uuid-2", period: "2024-01-01", driver: "fuel", amount: 4000 },
    ];
    const prodRows = [
      { mine_id: "uuid-1", period: "2024-01-01", tonnage: 500 },
      { mine_id: "uuid-2", period: "2024-01-01", tonnage: 500 },
    ];

    const builderCost = makeQueryBuilder({ data: costRows, error: null });
    const builderProd = makeQueryBuilder({ data: prodRows, error: null });

    const db = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "cost_entries") return builderCost;
        if (table === "production_runs") return builderProd;
        return makeQueryBuilder({ data: [], error: null });
      }),
    } as unknown as SupabaseClient;

    const result = await fetchKpiSummary(db);

    // SUM(amount) = 10000, SUM(tonnage) = 1000 → costPerTonne = 10
    expect(result.costPerTonne).toBeCloseTo(10);
    expect(result.totalTonnage).toBe(1000);
    expect(result.mineName).toBeNull();
  });

  it("returns costPerTonne of 0 when tonnage is 0 (divide-by-zero guard)", async () => {
    const costRows = [
      { mine_id: "uuid-1", period: "2024-01-01", driver: "fuel", amount: 5000 },
    ];
    const prodRows: unknown[] = [];

    const builderCost = makeQueryBuilder({ data: costRows, error: null });
    const builderProd = makeQueryBuilder({ data: prodRows, error: null });

    const db = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "cost_entries") return builderCost;
        if (table === "production_runs") return builderProd;
        return makeQueryBuilder({ data: [], error: null });
      }),
    } as unknown as SupabaseClient;

    const result = await fetchKpiSummary(db);

    expect(result.costPerTonne).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// fetchCostTrend
// ---------------------------------------------------------------------------

describe("fetchCostTrend", () => {
  it("returns 12 CostTrendPoints in ascending chronological order for a mineId", async () => {
    // Build 12 months of mock data (unordered to test sort)
    const months = [
      "2024-12-01", "2024-11-01", "2024-10-01", "2024-09-01",
      "2024-08-01", "2024-07-01", "2024-06-01", "2024-05-01",
      "2024-04-01", "2024-03-01", "2024-02-01", "2024-01-01",
    ];
    const costRows = months.map((period, i) => ({
      mine_id: "uuid-1",
      period,
      driver: "fuel",
      amount: (i + 1) * 1000,
    }));
    const prodRows = months.map((period) => ({
      mine_id: "uuid-1",
      period,
      tonnage: 100,
    }));

    const builderCost = makeQueryBuilder({ data: costRows, error: null });
    const builderProd = makeQueryBuilder({ data: prodRows, error: null });

    const db = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "cost_entries") return builderCost;
        if (table === "production_runs") return builderProd;
        return makeQueryBuilder({ data: [], error: null });
      }),
    } as unknown as SupabaseClient;

    const result = await fetchCostTrend(db, "uuid-1");

    expect(result).toHaveLength(12);
    // First entry must be the earliest period (ascending order)
    expect(result[0].period).toBe("2024-01-01");
    expect(result[11].period).toBe("2024-12-01");
    // Each entry has costPerTonne computed
    expect(result[0].costPerTonne).toBeGreaterThan(0);
  });

  it("returns an empty array without throwing for a mineId with no cost entries", async () => {
    const builderCost = makeQueryBuilder({ data: [], error: null });
    const builderProd = makeQueryBuilder({ data: [], error: null });

    const db = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "cost_entries") return builderCost;
        if (table === "production_runs") return builderProd;
        return makeQueryBuilder({ data: [], error: null });
      }),
    } as unknown as SupabaseClient;

    const result = await fetchCostTrend(db, "uuid-empty");

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// fetchCostByDriver
// ---------------------------------------------------------------------------

describe("fetchCostByDriver", () => {
  it("returns one entry per distinct driver with summed totalCost", async () => {
    const costRows = [
      { mine_id: "uuid-1", period: "2024-01-01", driver: "fuel", amount: 3000 },
      { mine_id: "uuid-1", period: "2024-01-01", driver: "fuel", amount: 2000 },
      { mine_id: "uuid-1", period: "2024-01-01", driver: "labor", amount: 4000 },
      { mine_id: "uuid-1", period: "2024-01-01", driver: "supplies", amount: 1500 },
      { mine_id: "uuid-1", period: "2024-01-01", driver: "equipment", amount: 2500 },
    ];

    const builder = makeQueryBuilder({ data: costRows, error: null });
    const db = {
      from: vi.fn().mockReturnValue(builder),
    } as unknown as SupabaseClient;

    const result = await fetchCostByDriver(db, "uuid-1");

    expect(result).toHaveLength(4);
    const fuel = result.find((r) => r.driver === "fuel");
    expect(fuel?.totalCost).toBe(5000);
    const labor = result.find((r) => r.driver === "labor");
    expect(labor?.totalCost).toBe(4000);
  });

  it("applies mine filter only when mineId is provided and aggregates all mines otherwise", async () => {
    const allRows = [
      { mine_id: "uuid-1", period: "2024-01-01", driver: "fuel", amount: 3000 },
      { mine_id: "uuid-2", period: "2024-01-01", driver: "fuel", amount: 2000 },
    ];

    const builder = makeQueryBuilder({ data: allRows, error: null });
    const eqSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      then: (resolve: (value: MockResult<typeof allRows>) => unknown) =>
        resolve({ data: allRows, error: null }),
    });
    const fromResult = {
      select: vi.fn().mockReturnThis(),
      eq: eqSpy,
      then: (resolve: (value: MockResult<typeof allRows>) => unknown) =>
        resolve({ data: allRows, error: null }),
    };
    const db = {
      from: vi.fn().mockReturnValue(fromResult),
    } as unknown as SupabaseClient;

    // Without mineId — eq should NOT be called
    await fetchCostByDriver(db);
    expect(eqSpy).not.toHaveBeenCalled();

    // With mineId — eq SHOULD be called
    vi.clearAllMocks();
    const fromResult2 = {
      select: vi.fn().mockReturnThis(),
      eq: eqSpy,
      then: (resolve: (value: MockResult<typeof allRows>) => unknown) =>
        resolve({ data: allRows, error: null }),
    };
    const db2 = {
      from: vi.fn().mockReturnValue(fromResult2),
    } as unknown as SupabaseClient;
    await fetchCostByDriver(db2, "uuid-1");
    expect(eqSpy).toHaveBeenCalledWith("mine_id", "uuid-1");
    void builder;
  });
});
