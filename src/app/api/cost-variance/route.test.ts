import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/cost-variance/variance-calculator", () => ({
  computeVariance: vi.fn(),
}));
vi.mock("@/lib/cost-variance/variance-narrator", () => ({
  narrateVariance: vi.fn(),
}));
vi.mock("@/lib/llm/create-llm-provider", () => ({
  createLlmChain: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { computeVariance } from "@/lib/cost-variance/variance-calculator";
import { narrateVariance } from "@/lib/cost-variance/variance-narrator";
import { createLlmChain } from "@/lib/llm/create-llm-provider";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { POST } from "./route";

const mockComputeVariance = vi.mocked(computeVariance);
const mockNarrateVariance = vi.mocked(narrateVariance);
const mockCreateLlmChain = vi.mocked(createLlmChain);
const mockCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient);

const baseVarianceResult = {
  mineId: "550e8400-e29b-41d4-a716-446655440000",
  mineName: "Cerro Rojo",
  period: "2024-08-01",
  comparisonPeriod: "2024-07-01",
  drivers: [
    { driver: "fuel" as const, currentAmount: 690000, priorAmount: 600000, delta: 90000, deltaPct: 15 },
    { driver: "supplies" as const, currentAmount: 400000, priorAmount: 400000, delta: 0, deltaPct: 0 },
    { driver: "equipment" as const, currentAmount: 450000, priorAmount: 450000, delta: 0, deltaPct: 0 },
    { driver: "labor" as const, currentAmount: 350000, priorAmount: 350000, delta: 0, deltaPct: 0 },
  ],
  totalCurrent: 1890000,
  totalPrior: 1800000,
  totalDelta: 90000,
  totalDeltaPct: 5,
};

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/cost-variance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateSupabaseServerClient.mockReturnValue({} as never);
  mockCreateLlmChain.mockReturnValue({ name: "mock", complete: vi.fn() } as never);
  mockComputeVariance.mockResolvedValue(baseVarianceResult);
  mockNarrateVariance.mockResolvedValue("Fuel costs increased significantly in August.");
});

describe("POST /api/cost-variance", () => {
  it("returns 200 with CostVarianceResult on valid input", async () => {
    const res = await POST(makeRequest({
      mineId: "550e8400-e29b-41d4-a716-446655440000",
      period: "2024-08-01",
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.mineId).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(body.narrative).toBe("Fuel costs increased significantly in August.");
    expect(body.drivers).toHaveLength(4);
  });

  it("passes mineId to computeVariance (not orphaned)", async () => {
    const mineId = "550e8400-e29b-41d4-a716-446655440000";
    await POST(makeRequest({ mineId, period: "2024-08-01" }));

    expect(mockComputeVariance).toHaveBeenCalledWith(
      expect.anything(),
      mineId,
      "2024-08-01",
      expect.any(String)
    );
  });

  it("defaults comparisonPeriod to prior calendar month when omitted", async () => {
    await POST(makeRequest({
      mineId: "550e8400-e29b-41d4-a716-446655440000",
      period: "2024-08-01",
    }));

    expect(mockComputeVariance).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      "2024-08-01",
      "2024-07-01"
    );
  });

  it("accepts explicit comparisonPeriod when provided", async () => {
    await POST(makeRequest({
      mineId: "550e8400-e29b-41d4-a716-446655440000",
      period: "2024-08-01",
      comparisonPeriod: "2024-06-01",
    }));

    expect(mockComputeVariance).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      "2024-08-01",
      "2024-06-01"
    );
  });

  it("returns 422 invalid_input when mineId is missing", async () => {
    const res = await POST(makeRequest({ period: "2024-08-01" }));
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toBe("invalid_input");
  });

  it("returns 422 invalid_input when period is missing", async () => {
    const res = await POST(makeRequest({ mineId: "550e8400-e29b-41d4-a716-446655440000" }));
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toBe("invalid_input");
  });

  it("returns 422 mine_not_found when calculator throws mine_not_found", async () => {
    const err = Object.assign(new Error("Mine not found"), { code: "mine_not_found" });
    mockComputeVariance.mockRejectedValue(err);

    const res = await POST(makeRequest({
      mineId: "550e8400-e29b-41d4-a716-446655440000",
      period: "2024-08-01",
    }));
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toBe("mine_not_found");
  });

  it("returns 422 no_prior_period when calculator throws no_prior_period", async () => {
    const err = Object.assign(new Error("No prior period"), { code: "no_prior_period" });
    mockComputeVariance.mockRejectedValue(err);

    const res = await POST(makeRequest({
      mineId: "550e8400-e29b-41d4-a716-446655440000",
      period: "2024-08-01",
    }));
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toBe("no_prior_period");
  });

  it("returns 200 with empty narrative when narrator degrades to empty string", async () => {
    mockNarrateVariance.mockResolvedValue("");

    const res = await POST(makeRequest({
      mineId: "550e8400-e29b-41d4-a716-446655440000",
      period: "2024-08-01",
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.narrative).toBe("");
  });

  it("returns 500 on unexpected calculator error", async () => {
    mockComputeVariance.mockRejectedValue(new Error("Unexpected DB error"));

    const res = await POST(makeRequest({
      mineId: "550e8400-e29b-41d4-a716-446655440000",
      period: "2024-08-01",
    }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("internal_error");
  });
});
