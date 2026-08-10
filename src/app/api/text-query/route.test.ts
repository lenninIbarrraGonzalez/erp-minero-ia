import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TextQueryError } from "@/lib/text-query/types";

// Mock all dependencies before importing the route
vi.mock("@/lib/text-query/intent-parser", () => ({
  parseIntent: vi.fn(),
}));
vi.mock("@/lib/text-query/error-tracker", () => ({
  recordError: vi.fn(),
}));
vi.mock("@/lib/text-query/query-builder", () => ({
  buildAndExecuteQuery: vi.fn(),
}));
vi.mock("@/lib/text-query/chart-heuristic", () => ({
  getChartType: vi.fn(),
}));
vi.mock("@/lib/text-query/insight-generator", () => ({
  generateInsight: vi.fn(),
}));
vi.mock("@/lib/llm/create-llm-provider", () => ({
  createLlmChain: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { parseIntent } from "@/lib/text-query/intent-parser";
import { buildAndExecuteQuery } from "@/lib/text-query/query-builder";
import { getChartType } from "@/lib/text-query/chart-heuristic";
import { generateInsight } from "@/lib/text-query/insight-generator";
import { createLlmChain } from "@/lib/llm/create-llm-provider";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordError } from "@/lib/text-query/error-tracker";
import { POST } from "./route";

const mockRecordError = vi.mocked(recordError);

const mockParseIntent = vi.mocked(parseIntent);
const mockBuildAndExecuteQuery = vi.mocked(buildAndExecuteQuery);
const mockGetChartType = vi.mocked(getChartType);
const mockGenerateInsight = vi.mocked(generateInsight);
const mockCreateLlmChain = vi.mocked(createLlmChain);
const mockCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient);

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/text-query", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeTextQueryError(
  code: TextQueryError["code"],
  message: string
): TextQueryError & Error {
  const err = new Error(message) as Error & TextQueryError;
  err.code = code;
  return err;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: createLlmChain and createSupabaseServerClient return mock objects
  mockCreateLlmChain.mockReturnValue({ name: "mock-llm", complete: vi.fn() });
  mockCreateSupabaseServerClient.mockReturnValue({ from: vi.fn() } as never);
});

describe("POST /api/text-query", () => {
  it("returns 200 with rows, chartType, and insightText on success", async () => {
    const intent = { metric: "cost_per_tonne" as const };
    const rows = [{ period: "2024-01-01", cost_per_tonne: 15 }];

    mockParseIntent.mockResolvedValue(intent);
    mockBuildAndExecuteQuery.mockResolvedValue(rows);
    mockGetChartType.mockReturnValue("line");
    mockGenerateInsight.mockResolvedValue("Costs increased in Q1.");

    const req = makeRequest({ question: "¿Cuál es el costo por tonelada?" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toEqual(rows);
    expect(body.chartType).toBe("line");
    expect(body.insightText).toBe("Costs increased in Q1.");
  });

  it("returns 422 when body is missing question field", async () => {
    const req = makeRequest({});
    const res = await POST(req);

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBeDefined();
    // None of the pipeline functions should be called
    expect(mockParseIntent).not.toHaveBeenCalled();
  });

  it("returns 422 when question is empty string", async () => {
    const req = makeRequest({ question: "" });
    const res = await POST(req);

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(mockParseIntent).not.toHaveBeenCalled();
  });

  it("returns 422 when intent-parser throws TextQueryError with code parse_failure", async () => {
    mockParseIntent.mockRejectedValue(
      makeTextQueryError("parse_failure", "LLM returned invalid JSON")
    );

    const req = makeRequest({ question: "algo que no se puede parsear" });
    const res = await POST(req);

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 422 when query-builder throws TextQueryError with code mine_not_found", async () => {
    const intent = { metric: "tonnage" as const, mineName: "Mina Inexistente" };
    mockParseIntent.mockResolvedValue(intent);
    mockBuildAndExecuteQuery.mockRejectedValue(
      makeTextQueryError("mine_not_found", "Mine not found: Mina Inexistente")
    );

    const req = makeRequest({ question: "tonelaje de mina inexistente" });
    const res = await POST(req);

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 200 with empty rows when query-builder throws TextQueryError with code empty_result", async () => {
    const intent = { metric: "tonnage" as const };
    mockParseIntent.mockResolvedValue(intent);
    mockBuildAndExecuteQuery.mockRejectedValue(
      makeTextQueryError("empty_result", "No data found for the given query")
    );

    const req = makeRequest({ question: "tonelaje sin datos" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toEqual([]);
    expect(body.chartType).toBe("none");
    expect(body.insightText).toBe("");
  });

  it("returns 500 when LLM chain throws an unexpected error", async () => {
    mockParseIntent.mockRejectedValue(new Error("Unexpected LLM failure"));

    const req = makeRequest({ question: "costo por tonelada" });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  // QW-2: Zod validation tests
  it("returns 422 with invalidQuestion when question exceeds 500 characters", async () => {
    const longQuestion = "a".repeat(501);
    const req = makeRequest({ question: longQuestion });
    const res = await POST(req);

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("textQuery.error.invalidQuestion");
    expect(mockParseIntent).not.toHaveBeenCalled();
  });

  it("returns 422 with invalidQuestion when mineId is not a valid UUID", async () => {
    const req = makeRequest({ question: "costo por tonelada", mineId: "not-a-uuid" });
    const res = await POST(req);

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("textQuery.error.invalidQuestion");
    expect(mockParseIntent).not.toHaveBeenCalled();
  });

  it("succeeds when mineId is a valid UUID", async () => {
    const intent = { metric: "cost_per_tonne" as const };
    const rows = [{ period: "2024-01-01", cost_per_tonne: 15 }];
    mockParseIntent.mockResolvedValue(intent);
    mockBuildAndExecuteQuery.mockResolvedValue(rows);
    mockGetChartType.mockReturnValue("line");
    mockGenerateInsight.mockResolvedValue("Cost trend.");

    const req = makeRequest({
      question: "costo por tonelada",
      mineId: "123e4567-e89b-12d3-a456-426614174000",
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    // mineId must NOT be injected into the intent passed to buildAndExecuteQuery
    const calledIntent = mockBuildAndExecuteQuery.mock.calls[0]?.[1] as unknown as Record<string, unknown>;
    expect(calledIntent._mineIdDirect).toBeUndefined();
  });

  it("succeeds when mineId is absent", async () => {
    const intent = { metric: "tonnage" as const };
    const rows = [{ period: "2024-01-01", tonnage: 100 }];
    mockParseIntent.mockResolvedValue(intent);
    mockBuildAndExecuteQuery.mockResolvedValue(rows);
    mockGetChartType.mockReturnValue("bar");
    mockGenerateInsight.mockResolvedValue("Tonnage insight.");

    const req = makeRequest({ question: "tonelaje total" });
    const res = await POST(req);

    expect(res.status).toBe(200);
  });

  // I4: year_out_of_range — must return 422, not silent 200
  it("returns 422 with year_out_of_range when question mentions a year before 2024", async () => {
    const req = makeRequest({ question: "tonelaje en 2023" });
    const res = await POST(req);

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("year_out_of_range");
    expect(mockParseIntent).not.toHaveBeenCalled();
  });

  it("returns 422 with year_out_of_range when question mentions a year after 2024", async () => {
    const req = makeRequest({ question: "costos en 2025" });
    const res = await POST(req);

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("year_out_of_range");
    expect(mockParseIntent).not.toHaveBeenCalled();
  });

  it("proceeds normally when question mentions 2024", async () => {
    const intent = { metric: "tonnage" as const };
    mockParseIntent.mockResolvedValue(intent);
    mockBuildAndExecuteQuery.mockResolvedValue([]);
    mockGetChartType.mockReturnValue("none");
    mockGenerateInsight.mockResolvedValue("");

    const req = makeRequest({ question: "tonelaje en 2024" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockParseIntent).toHaveBeenCalled();
  });

  it("proceeds normally when no year is mentioned", async () => {
    const intent = { metric: "tonnage" as const };
    mockParseIntent.mockResolvedValue(intent);
    mockBuildAndExecuteQuery.mockResolvedValue([]);
    mockGetChartType.mockReturnValue("none");
    mockGenerateInsight.mockResolvedValue("");

    const req = makeRequest({ question: "tonelaje total" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockParseIntent).toHaveBeenCalled();
  });

  it("logs structured JSON and calls recordError on TextQueryError (non-empty_result)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockParseIntent.mockRejectedValue(makeTextQueryError("mine_not_found", "Mine not found"));

    const req = makeRequest({ question: "tonelaje de Mina Inexistente" });
    await POST(req);

    expect(consoleSpy).toHaveBeenCalled();
    const logged = JSON.parse((consoleSpy.mock.calls[0] as string[])[0]);
    expect(logged.level).toBe("ERROR");
    expect(logged.event).toBe("text_query_error");
    expect(logged.code).toBe("mine_not_found");
    expect(mockRecordError).toHaveBeenCalledWith("mine_not_found");

    consoleSpy.mockRestore();
  });

  it("returns suggestions array when mine_not_found has a close typo", async () => {
    const err = makeTextQueryError("mine_not_found", "Mine not found: Serro Rojo");
    (err as TextQueryError & { context?: Record<string, unknown> }).context = { attempted: "Serro Rojo" };
    mockParseIntent.mockRejectedValue(err);

    const req = makeRequest({ question: "tonelaje de Serro Rojo" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.suggestions).toContain("Cerro Rojo");
  });

  it("returns empty suggestions when mine name is too different", async () => {
    const err = makeTextQueryError("mine_not_found", "Mine not found: XYZ123");
    (err as TextQueryError & { context?: Record<string, unknown> }).context = { attempted: "XYZ123" };
    mockParseIntent.mockRejectedValue(err);

    const req = makeRequest({ question: "tonelaje de XYZ123" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.suggestions).toEqual([]);
  });

  it("does NOT log or call recordError for empty_result (200 path)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockParseIntent.mockRejectedValue(makeTextQueryError("empty_result", "No data"));

    const req = makeRequest({ question: "tonelaje" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(mockRecordError).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
