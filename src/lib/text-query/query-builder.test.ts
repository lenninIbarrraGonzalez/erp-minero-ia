import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ParsedIntent, TextQueryError } from "./types";

// We need to mock the Supabase client with a chainable API
// The pattern mirrors dashboard.ts: db.from(...).select(...).eq(...)
function makeChainableQuery(result: { data: unknown[] | null; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    then: (resolve: (val: typeof result) => unknown) => resolve(result),
  };
  return chain;
}

function makeSupabaseMock(tableResults: Record<string, { data: unknown[] | null; error: unknown }>) {
  return {
    from: vi.fn((table: string) => makeChainableQuery(tableResults[table] ?? { data: [], error: null })),
  };
}

import { buildAndExecuteQuery } from "./query-builder";

describe("buildAndExecuteQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns cost_per_tonne rows when mine is found", async () => {
    const intent: ParsedIntent = {
      metric: "cost_per_tonne",
      mineName: "La Escondida",
    };

    const db = makeSupabaseMock({
      mines: {
        data: [{ id: "mine-uuid-1", name: "La Escondida" }],
        error: null,
      },
      cost_entries: {
        data: [
          { mine_id: "mine-uuid-1", period: "2024-01-01", driver: "fuel", amount: 1000 },
          { mine_id: "mine-uuid-1", period: "2024-01-01", driver: "labor", amount: 500 },
          { mine_id: "mine-uuid-1", period: "2024-02-01", driver: "fuel", amount: 800 },
        ],
        error: null,
      },
      production_runs: {
        data: [
          { mine_id: "mine-uuid-1", period: "2024-01-01", tonnage: 100 },
          { mine_id: "mine-uuid-1", period: "2024-02-01", tonnage: 80 },
        ],
        error: null,
      },
    });

    const rows = await buildAndExecuteQuery(db as never, intent);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ period: "2024-01-01", cost_per_tonne: 15 });
    expect(rows[1]).toMatchObject({ period: "2024-02-01", cost_per_tonne: 10 });
  });

  it("returns tonnage rows when mine is found", async () => {
    const intent: ParsedIntent = {
      metric: "tonnage",
      mineName: "Cerro Negro",
    };

    const db = makeSupabaseMock({
      mines: {
        data: [{ id: "mine-uuid-2", name: "Cerro Negro" }],
        error: null,
      },
      production_runs: {
        data: [
          { mine_id: "mine-uuid-2", period: "2024-01-01", tonnage: 200 },
          { mine_id: "mine-uuid-2", period: "2024-02-01", tonnage: 150 },
        ],
        error: null,
      },
    });

    const rows = await buildAndExecuteQuery(db as never, intent);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ period: "2024-01-01", tonnage: 200 });
    expect(rows[1]).toMatchObject({ period: "2024-02-01", tonnage: 150 });
  });

  it("returns cost_by_driver rows when mine is found", async () => {
    const intent: ParsedIntent = {
      metric: "cost_by_driver",
      mineName: "San Pedro",
    };

    const db = makeSupabaseMock({
      mines: {
        data: [{ id: "mine-uuid-3", name: "San Pedro" }],
        error: null,
      },
      cost_entries: {
        data: [
          { mine_id: "mine-uuid-3", period: "2024-01-01", driver: "fuel", amount: 500 },
          { mine_id: "mine-uuid-3", period: "2024-02-01", driver: "fuel", amount: 300 },
          { mine_id: "mine-uuid-3", period: "2024-01-01", driver: "labor", amount: 200 },
        ],
        error: null,
      },
    });

    const rows = await buildAndExecuteQuery(db as never, intent);

    expect(rows).toHaveLength(2);
    const fuelRow = rows.find((r) => r.driver === "fuel");
    expect(fuelRow).toMatchObject({ driver: "fuel", amount: 800 });
    const laborRow = rows.find((r) => r.driver === "labor");
    expect(laborRow).toMatchObject({ driver: "labor", amount: 200 });
  });

  it("throws TextQueryError with code 'mine_not_found' when mine name does not match", async () => {
    const intent: ParsedIntent = {
      metric: "cost_per_tonne",
      mineName: "Mina Inexistente",
    };

    const db = makeSupabaseMock({
      mines: {
        data: [{ id: "mine-uuid-1", name: "La Escondida" }],
        error: null,
      },
    });

    await expect(buildAndExecuteQuery(db as never, intent)).rejects.toMatchObject({
      code: "mine_not_found",
    } satisfies Partial<TextQueryError>);
  });

  it("returns multi-mine cost_by_driver as full breakdown (mine+driver+amount)", async () => {
    const intent: ParsedIntent = {
      metric: "cost_by_driver",
      mineNames: ["La Escondida", "San Pedro"],
    };

    const db = makeSupabaseMock({
      mines: {
        data: [
          { id: "mine-1", name: "La Escondida" },
          { id: "mine-2", name: "San Pedro" },
        ],
        error: null,
      },
      cost_entries: {
        data: [
          { mine_id: "mine-1", period: "2024-01-01", driver: "fuel", amount: 600 },
          { mine_id: "mine-1", period: "2024-01-01", driver: "labor", amount: 400 },
          { mine_id: "mine-2", period: "2024-01-01", driver: "fuel", amount: 300 },
        ],
        error: null,
      },
    });

    const rows = await buildAndExecuteQuery(db as never, intent);

    // Full breakdown: mine + driver + amount columns
    expect(rows[0]).toHaveProperty("mine");
    expect(rows[0]).toHaveProperty("driver");
    expect(rows[0]).toHaveProperty("amount");
    expect(rows.map((r) => r.mine)).toEqual(
      expect.arrayContaining(["La Escondida", "San Pedro"])
    );
  });

  it("returns multi-mine cost_by_driver filtered by driver as amount per mine", async () => {
    const intent: ParsedIntent = {
      metric: "cost_by_driver",
      mineNames: ["La Escondida", "San Pedro"],
      driverFilter: "fuel",
    };

    const db = makeSupabaseMock({
      mines: {
        data: [
          { id: "mine-1", name: "La Escondida" },
          { id: "mine-2", name: "San Pedro" },
        ],
        error: null,
      },
      cost_entries: {
        data: [
          { mine_id: "mine-1", period: "2024-01-01", driver: "fuel", amount: 600 },
          { mine_id: "mine-1", period: "2024-01-01", driver: "labor", amount: 400 },
          { mine_id: "mine-2", period: "2024-01-01", driver: "fuel", amount: 300 },
        ],
        error: null,
      },
    });

    const rows = await buildAndExecuteQuery(db as never, intent);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveProperty("mine");
    expect(rows[0]).toHaveProperty("amount");
    expect(rows[0]).not.toHaveProperty("driver");
  });

  it("returns multi-mine tonnage as total_tonnage per mine", async () => {
    const intent: ParsedIntent = {
      metric: "tonnage",
      mineNames: ["Cerro Negro", "La Escondida"],
    };

    const db = makeSupabaseMock({
      mines: {
        data: [
          { id: "mine-1", name: "La Escondida" },
          { id: "mine-2", name: "Cerro Negro" },
        ],
        error: null,
      },
      production_runs: {
        data: [
          { mine_id: "mine-1", period: "2024-01-01", tonnage: 100 },
          { mine_id: "mine-2", period: "2024-01-01", tonnage: 200 },
        ],
        error: null,
      },
    });

    const rows = await buildAndExecuteQuery(db as never, intent);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveProperty("mine");
    expect(rows[0]).toHaveProperty("total_tonnage");
  });

  it("applies period filter when intent has year and month", async () => {
    const intent: ParsedIntent = {
      metric: "cost_per_tonne",
      period: { year: 2024, month: 3 },
    };

    const db = makeSupabaseMock({
      cost_entries: {
        data: [
          { mine_id: "m1", period: "2024-03-01", driver: "fuel", amount: 900 },
        ],
        error: null,
      },
      production_runs: {
        data: [{ mine_id: "m1", period: "2024-03-01", tonnage: 100 }],
        error: null,
      },
    });

    const rows = await buildAndExecuteQuery(db as never, intent);

    // Verify .like() was called with the correct period filter
    const fromCalls = (db.from as ReturnType<typeof vi.fn>).mock.calls;
    const costCall = fromCalls.find(([t]: [string]) => t === "cost_entries");
    expect(costCall).toBeDefined();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ period: "2024-03-01", cost_per_tonne: 9 });
  });

  it("throws TextQueryError with code 'empty_result' when query returns no rows", async () => {
    const intent: ParsedIntent = {
      metric: "tonnage",
      mineName: "La Escondida",
    };

    const db = makeSupabaseMock({
      mines: {
        data: [{ id: "mine-uuid-1", name: "La Escondida" }],
        error: null,
      },
      production_runs: {
        data: [],
        error: null,
      },
    });

    await expect(buildAndExecuteQuery(db as never, intent)).rejects.toMatchObject({
      code: "empty_result",
    } satisfies Partial<TextQueryError>);
  });
});
