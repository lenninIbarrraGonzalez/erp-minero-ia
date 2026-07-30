import { describe, it, expect, vi, beforeEach } from "vitest";

// Chainable Supabase mock — mirrors query-builder.test.ts pattern
function makeChainableQuery(result: { data: unknown[] | null; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (val: typeof result) => unknown) => resolve(result);
  return chain;
}

type TableResults = Record<string, { data: unknown[] | null; error: unknown }>;

function makeSupabaseMock(tableResults: TableResults) {
  return {
    from: vi.fn((table: string) =>
      makeChainableQuery(tableResults[table] ?? { data: [], error: null })
    ),
  };
}

// We need a more sophisticated mock where the same table can be queried twice
// with different .eq("period", ...) values returning different data
function makeSupabaseMockWithPeriods(opts: {
  mines: { id: string; name: string }[];
  currentEntries: { driver: string; amount: number }[];
  priorEntries: { driver: string; amount: number }[];
}) {
  let costCallCount = 0;

  return {
    from: vi.fn((table: string) => {
      if (table === "mines") {
        return makeChainableQuery({ data: opts.mines, error: null });
      }
      if (table === "cost_entries") {
        // First call → current period, second call → prior period
        const callIndex = costCallCount++;
        const data = callIndex === 0 ? opts.currentEntries : opts.priorEntries;
        return makeChainableQuery({ data, error: null });
      }
      return makeChainableQuery({ data: [], error: null });
    }),
  };
}

import { computeVariance } from "./variance-calculator";

describe("computeVariance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns exactly 4 driver entries in DRIVERS order", async () => {
    const db = makeSupabaseMockWithPeriods({
      mines: [{ id: "mine-uuid-1", name: "La Escondida" }],
      currentEntries: [
        { driver: "fuel", amount: 1000 },
        { driver: "labor", amount: 500 },
        { driver: "supplies", amount: 300 },
        { driver: "equipment", amount: 200 },
      ],
      priorEntries: [
        { driver: "fuel", amount: 800 },
        { driver: "labor", amount: 400 },
        { driver: "supplies", amount: 250 },
        { driver: "equipment", amount: 150 },
      ],
    });

    const result = await computeVariance(
      db as never,
      "mine-uuid-1",
      "2024-08-01",
      "2024-07-01"
    );

    expect(result.drivers).toHaveLength(4);
    expect(result.drivers.map((d) => d.driver)).toEqual([
      "fuel",
      "supplies",
      "equipment",
      "labor",
    ]);
  });

  it("sums amounts correctly and computes totalCurrent, totalPrior, totalDelta", async () => {
    const db = makeSupabaseMockWithPeriods({
      mines: [{ id: "mine-uuid-1", name: "La Escondida" }],
      currentEntries: [
        { driver: "fuel", amount: 1000 },
        { driver: "labor", amount: 500 },
      ],
      priorEntries: [
        { driver: "fuel", amount: 800 },
        { driver: "labor", amount: 400 },
      ],
    });

    const result = await computeVariance(
      db as never,
      "mine-uuid-1",
      "2024-08-01",
      "2024-07-01"
    );

    expect(result.totalCurrent).toBe(1500);
    expect(result.totalPrior).toBe(1200);
    expect(result.totalDelta).toBe(300);
  });

  it("zero-fills missing driver in current period", async () => {
    const db = makeSupabaseMockWithPeriods({
      mines: [{ id: "mine-uuid-1", name: "La Escondida" }],
      currentEntries: [{ driver: "fuel", amount: 1000 }],
      priorEntries: [{ driver: "fuel", amount: 800 }],
    });

    const result = await computeVariance(
      db as never,
      "mine-uuid-1",
      "2024-08-01",
      "2024-07-01"
    );

    const suppliesDriver = result.drivers.find((d) => d.driver === "supplies");
    expect(suppliesDriver).toBeDefined();
    expect(suppliesDriver!.currentAmount).toBe(0);
    expect(suppliesDriver!.priorAmount).toBe(0);
  });

  it("returns deltaPct null when priorAmount is 0 for a specific driver (other drivers have prior data)", async () => {
    const db = makeSupabaseMockWithPeriods({
      mines: [{ id: "mine-uuid-1", name: "La Escondida" }],
      currentEntries: [
        { driver: "fuel", amount: 500 },
        { driver: "labor", amount: 300 },
      ],
      // Prior has labor but NOT fuel — fuel priorAmount will be 0
      priorEntries: [{ driver: "labor", amount: 400 }],
    });

    const result = await computeVariance(
      db as never,
      "mine-uuid-1",
      "2024-08-01",
      "2024-07-01"
    );

    const fuelDriver = result.drivers.find((d) => d.driver === "fuel");
    expect(fuelDriver!.priorAmount).toBe(0);
    expect(fuelDriver!.deltaPct).toBeNull();
    // labor has prior data so deltaPct is not null
    const laborDriver = result.drivers.find((d) => d.driver === "labor");
    expect(laborDriver!.deltaPct).not.toBeNull();
  });

  it("throws no_prior_period when prior period has zero entries for that mine", async () => {
    const db = makeSupabaseMockWithPeriods({
      mines: [{ id: "mine-uuid-1", name: "La Escondida" }],
      currentEntries: [{ driver: "fuel", amount: 1000 }],
      priorEntries: [],
    });

    // Override so mine returns rows but prior is empty (all drivers zero)
    // Actually we need to test the specific case where ALL prior entries are empty
    // We simulate this by returning currentEntries but empty priorEntries
    // However, deltaPct null is valid — the error is thrown when all prior = 0
    // which means it's the first month with ANY data for this mine
    // Let's test with a mock that explicitly returns empty for prior
    const db2 = {
      from: vi.fn((table: string) => {
        if (table === "mines") {
          return makeChainableQuery({
            data: [{ id: "mine-uuid-1", name: "La Escondida" }],
            error: null,
          });
        }
        if (table === "cost_entries") {
          // First call = current (has data), second call = prior (empty)
          const calls = (db2.from as ReturnType<typeof vi.fn>).mock.calls;
          const costCalls = calls.filter((c: unknown[]) => c[0] === "cost_entries");
          if (costCalls.length <= 1) {
            return makeChainableQuery({
              data: [{ driver: "fuel", amount: 1000 }],
              error: null,
            });
          } else {
            return makeChainableQuery({ data: [], error: null });
          }
        }
        return makeChainableQuery({ data: [], error: null });
      }),
    };

    await expect(
      computeVariance(db2 as never, "mine-uuid-1", "2024-08-01", "2024-07-01")
    ).rejects.toMatchObject({ code: "no_prior_period" });
  });

  it("identifies fuel spike as driver with largest absolute delta", async () => {
    const db = makeSupabaseMockWithPeriods({
      mines: [{ id: "mine-uuid-1", name: "La Escondida" }],
      currentEntries: [
        { driver: "fuel", amount: 5000 }, // big spike
        { driver: "labor", amount: 600 },
        { driver: "supplies", amount: 310 },
        { driver: "equipment", amount: 210 },
      ],
      priorEntries: [
        { driver: "fuel", amount: 800 }, // was 800 → now 5000 = delta 4200
        { driver: "labor", amount: 400 },
        { driver: "supplies", amount: 250 },
        { driver: "equipment", amount: 150 },
      ],
    });

    const result = await computeVariance(
      db as never,
      "mine-uuid-1",
      "2024-08-01",
      "2024-07-01"
    );

    const maxDeltaDriver = result.drivers.reduce((max, d) =>
      Math.abs(d.delta) > Math.abs(max.delta) ? d : max
    );
    expect(maxDeltaDriver.driver).toBe("fuel");
    expect(maxDeltaDriver.delta).toBe(4200);
  });

  it("includes mineName from mines table", async () => {
    const db = makeSupabaseMockWithPeriods({
      mines: [{ id: "mine-uuid-1", name: "Cerro Negro" }],
      currentEntries: [{ driver: "fuel", amount: 1000 }],
      priorEntries: [{ driver: "fuel", amount: 800 }],
    });

    const result = await computeVariance(
      db as never,
      "mine-uuid-1",
      "2024-08-01",
      "2024-07-01"
    );

    expect(result.mineName).toBe("Cerro Negro");
    expect(result.mineId).toBe("mine-uuid-1");
  });

  it("throws mine_not_found when mines table returns empty for given mineId", async () => {
    const db = makeSupabaseMock({
      mines: { data: [], error: null },
      cost_entries: { data: [], error: null },
    });

    await expect(
      computeVariance(db as never, "mine-uuid-999", "2024-08-01", "2024-07-01")
    ).rejects.toMatchObject({ code: "mine_not_found" });
  });
});
