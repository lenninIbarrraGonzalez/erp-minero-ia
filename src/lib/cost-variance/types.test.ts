import { describe, it, expect } from "vitest";

// These imports will fail (RED) until types.ts is created
import {
  DriverDeltaSchema,
  CostVarianceResultSchema,
  DRIVERS,
} from "./types";

describe("DRIVERS constant", () => {
  it("contains exactly the 4 expected driver values", () => {
    expect(DRIVERS).toEqual(["fuel", "supplies", "equipment", "labor"]);
  });
});

describe("DriverDeltaSchema", () => {
  it("validates a correct driver delta with prior > 0", () => {
    const input = {
      driver: "fuel",
      currentAmount: 1200,
      priorAmount: 1000,
      delta: 200,
      deltaPct: 20,
    };
    const result = DriverDeltaSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("validates deltaPct as null when priorAmount is 0", () => {
    const input = {
      driver: "labor",
      currentAmount: 500,
      priorAmount: 0,
      delta: 500,
      deltaPct: null,
    };
    const result = DriverDeltaSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deltaPct).toBeNull();
    }
  });

  it("rejects an invalid driver enum value", () => {
    const input = {
      driver: "electricity",
      currentAmount: 100,
      priorAmount: 80,
      delta: 20,
      deltaPct: 25,
    };
    const result = DriverDeltaSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = DriverDeltaSchema.safeParse({ driver: "fuel" });
    expect(result.success).toBe(false);
  });
});

describe("CostVarianceResultSchema", () => {
  const validDriverDelta = (driver: string) => ({
    driver,
    currentAmount: 1000,
    priorAmount: 800,
    delta: 200,
    deltaPct: 25,
  });

  const validResult = {
    mineId: "550e8400-e29b-41d4-a716-446655440000",
    mineName: "La Escondida",
    period: "2024-08-01",
    comparisonPeriod: "2024-07-01",
    drivers: [
      validDriverDelta("fuel"),
      validDriverDelta("supplies"),
      validDriverDelta("equipment"),
      validDriverDelta("labor"),
    ],
    totalCurrent: 4000,
    totalPrior: 3200,
    totalDelta: 800,
    totalDeltaPct: 25,
    narrative: "Fuel costs drove the increase.",
  };

  it("validates a correct CostVarianceResult with 4 drivers", () => {
    const result = CostVarianceResultSchema.safeParse(validResult);
    expect(result.success).toBe(true);
  });

  it("validates totalDeltaPct as null when totalPrior is 0", () => {
    const input = {
      ...validResult,
      totalPrior: 0,
      totalDelta: 4000,
      totalDeltaPct: null,
    };
    const result = CostVarianceResultSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalDeltaPct).toBeNull();
    }
  });

  it("rejects mineId that is not a UUID", () => {
    const input = { ...validResult, mineId: "not-a-uuid" };
    const result = CostVarianceResultSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("validates with empty narrative string (LLM degraded)", () => {
    const input = { ...validResult, narrative: "" };
    const result = CostVarianceResultSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});
