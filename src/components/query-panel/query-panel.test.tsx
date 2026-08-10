import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { QueryRow } from "@/lib/text-query/types";

// ---------------------------------------------------------------------------
// Mock next-intl
// ---------------------------------------------------------------------------

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const map: Record<string, string> = {
      placeholder: "Ask about costs, tonnage...",
      submit: "Query",
      loading: "Processing...",
      emptyResult: "No data found for this query.",
      "error.parseFailure": "Could not parse the query.",
      "error.unsupportedMetric": "Unsupported metric.",
      "error.mineNotFound": "Mine not found.",
      "error.generic": "An unexpected error occurred.",
      "error.invalidQuestion": "The query is invalid. Make sure it is text up to 500 characters.",
      "error.yearOutOfRange": "Only 2024 data is available. Try: 'tonnage in 2024'.",
      "error.ambiguousQuery": "Query is ambiguous. Specify: 'cost per tonne', 'tonnage', or 'cost by driver'.",
      "error.overlappingPeriod": "Specify either a quarter or a month, not both.",
      "error.llmTimeout": "LLM timeout.",
      "error.llmRateLimit": "LLM rate limit.",
      "error.llmAuthError": "LLM auth error.",
      "error.dbConnectionError": "DB connection error.",
      "error.dbTimeout": "DB timeout.",
      "error.didYouMean": "Did you mean:",
      "error.hint.mineNotFound": "Available mines: Cerro Rojo, Veta Dorada, Loma Grande, Quebrada Sur, Peña Azul.",
      "error.hint.llmRateLimit": "Query limit reached. Wait a moment and try again.",
      "error.hint.llmTimeout": "Service is slow. Try again in 30 seconds.",
      "error.hint.llmAuthError": "Service configuration error. Contact the administrator.",
      "error.hint.dbConnectionError": "Could not connect to the database. Check your connection.",
      "error.hint.dbTimeout": "Database timed out. Try a narrower period.",
      "error.hint.parseFailure": "Try rephrasing: 'Cost per tonne for Cerro Rojo in 2024'.",
      "error.hint.yearOutOfRange": "Change the year to 2024 — it's the only available period.",
      "error.hint.outOfScope": "Ask about costs, tonnage, or cost breakdown by driver.",
      "insight.label": "Analysis",
      examplesLabel: "Examples",
    };
    const t = (key: string) => map[key] ?? key;
    t.raw = (key: string) => {
      if (key === "examples") return ["Example question 1", "Example question 2"];
      return [];
    };
    return t;
  },
}));

// ---------------------------------------------------------------------------
// Import component after mocks
// ---------------------------------------------------------------------------

const { QueryPanel } = await import("./query-panel");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSuccessResponse(
  rows: QueryRow[],
  chartType = "bar",
  insightText = "Some insight."
) {
  return {
    ok: true,
    json: async () => ({ rows, chartType, insightText }),
  };
}

function makeErrorResponse(error: string, status = 422, extra?: Record<string, unknown>) {
  return {
    ok: false,
    status,
    json: async () => ({ error, ...extra }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("QueryPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders input field and submit button in initial state", () => {
    render(<QueryPanel />);

    expect(
      screen.getByPlaceholderText("Ask about costs, tonnage...")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Query" })).toBeInTheDocument();
  });

  it("disables submit button while fetching (loading state)", async () => {
    // Simulate a slow fetch: never resolves immediately
    let resolvePromise: (val: unknown) => void;
    const pendingPromise = new Promise((res) => {
      resolvePromise = res;
    });
    vi.mocked(global.fetch).mockReturnValue(pendingPromise as never);

    render(<QueryPanel />);

    const input = screen.getByPlaceholderText("Ask about costs, tonnage...");
    const button = screen.getByRole("button", { name: "Query" });

    fireEvent.change(input, { target: { value: "tonelaje" } });
    fireEvent.click(button);

    // During pending: submit button should be disabled
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Query" })).toBeDisabled();
    });

    // Resolve fetch so test doesn't leak
    resolvePromise!(makeSuccessResponse([]));
  });

  it("renders data table after successful fetch with rows", async () => {
    const rows: QueryRow[] = [
      { period: "2024-01-01", cost_per_tonne: 15 },
      { period: "2024-02-01", cost_per_tonne: 12 },
    ];
    vi.mocked(global.fetch).mockResolvedValue(
      makeSuccessResponse(rows) as never
    );

    render(<QueryPanel />);

    const input = screen.getByPlaceholderText("Ask about costs, tonnage...");
    fireEvent.change(input, { target: { value: "costo por tonelada" } });
    fireEvent.click(screen.getByRole("button", { name: "Query" }));

    await waitFor(() => {
      expect(screen.getByText("period")).toBeInTheDocument();
      expect(screen.getByText("cost_per_tonne")).toBeInTheDocument();
      expect(screen.getByText("2024-01-01")).toBeInTheDocument();
      expect(screen.getByText("15")).toBeInTheDocument();
    });
  });

  it("renders insight text after successful fetch", async () => {
    const rows: QueryRow[] = [{ period: "2024-01-01", cost_per_tonne: 15 }];
    vi.mocked(global.fetch).mockResolvedValue(
      makeSuccessResponse(rows, "line", "Costs rose sharply in Q1.") as never
    );

    render(<QueryPanel />);

    const input = screen.getByPlaceholderText("Ask about costs, tonnage...");
    fireEvent.change(input, { target: { value: "tendencia de costo" } });
    fireEvent.click(screen.getByRole("button", { name: "Query" }));

    await waitFor(() => {
      expect(screen.getByText("Costs rose sharply in Q1.")).toBeInTheDocument();
    });
  });

  it("renders empty state message when rows is empty array", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      makeSuccessResponse([]) as never
    );

    render(<QueryPanel />);

    const input = screen.getByPlaceholderText("Ask about costs, tonnage...");
    fireEvent.change(input, { target: { value: "datos vacios" } });
    fireEvent.click(screen.getByRole("button", { name: "Query" }));

    await waitFor(() => {
      expect(
        screen.getByText("No data found for this query.")
      ).toBeInTheDocument();
    });
  });

  it("renders error message when fetch returns error JSON", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      makeErrorResponse("parse_failure") as never
    );

    render(<QueryPanel />);

    const input = screen.getByPlaceholderText("Ask about costs, tonnage...");
    fireEvent.change(input, { target: { value: "consulta invalida" } });
    fireEvent.click(screen.getByRole("button", { name: "Query" }));

    await waitFor(() => {
      // Error message should be visible (the generic error key)
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("shows specific invalidQuestion message when API returns the full i18n key error", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      makeErrorResponse("textQuery.error.invalidQuestion") as never
    );

    render(<QueryPanel />);

    fireEvent.change(screen.getByPlaceholderText("Ask about costs, tonnage..."), {
      target: { value: "?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Query" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "The query is invalid. Make sure it is text up to 500 characters."
      );
    });
  });

  it("shows yearOutOfRange hint when API returns year_out_of_range error", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      makeErrorResponse("year_out_of_range") as never
    );

    render(<QueryPanel />);

    fireEvent.change(screen.getByPlaceholderText("Ask about costs, tonnage..."), {
      target: { value: "tonelaje en 2025" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Query" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Only 2024 data is available. Try: 'tonnage in 2024'."
      );
    });
  });

  // D2: Did you mean? suggestions UI
  it("shows suggestions list when API returns mine_not_found with suggestions", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      makeErrorResponse("mine_not_found", 422, { suggestions: ["Cerro Rojo"] }) as never
    );

    render(<QueryPanel />);
    fireEvent.change(screen.getByPlaceholderText("Ask about costs, tonnage..."), {
      target: { value: "Serro Rojo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Query" }));

    await waitFor(() => {
      expect(screen.getByTestId("query-suggestions")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cerro Rojo" })).toBeInTheDocument();
    });
  });

  it("clicking a suggestion fills the input", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      makeErrorResponse("mine_not_found", 422, { suggestions: ["Cerro Rojo"] }) as never
    );

    render(<QueryPanel />);
    const input = screen.getByPlaceholderText("Ask about costs, tonnage...");
    fireEvent.change(input, { target: { value: "Serro Rojo" } });
    fireEvent.click(screen.getByRole("button", { name: "Query" }));

    await waitFor(() => {
      expect(screen.getByTestId("query-suggestions")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Cerro Rojo" }));
    expect(input).toHaveValue("Cerro Rojo");
  });

  it("does not render suggestions element when suggestions array is empty", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      makeErrorResponse("mine_not_found", 422, { suggestions: [] }) as never
    );

    render(<QueryPanel />);
    fireEvent.change(screen.getByPlaceholderText("Ask about costs, tonnage..."), {
      target: { value: "XYZ123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Query" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("query-suggestions")).not.toBeInTheDocument();
  });

  // E2: Recovery hints
  it("shows recovery hint for mine_not_found", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      makeErrorResponse("mine_not_found", 422, { suggestions: [] }) as never
    );

    render(<QueryPanel />);
    fireEvent.change(screen.getByPlaceholderText("Ask about costs, tonnage..."), {
      target: { value: "Mina Inexistente" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Query" }));

    await waitFor(() => {
      expect(screen.getByTestId("query-error-hint")).toBeInTheDocument();
    });
    expect(screen.getByTestId("query-error-hint")).toHaveTextContent(
      "Available mines: Cerro Rojo"
    );
  });

  it("shows recovery hint for llm_rate_limit", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      makeErrorResponse("llm_rate_limit") as never
    );

    render(<QueryPanel />);
    fireEvent.change(screen.getByPlaceholderText("Ask about costs, tonnage..."), {
      target: { value: "costos" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Query" }));

    await waitFor(() => {
      expect(screen.getByTestId("query-error-hint")).toBeInTheDocument();
    });
    expect(screen.getByTestId("query-error-hint")).toHaveTextContent(
      "Query limit reached"
    );
  });

  it("does not render hint for errors without a hint key", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      makeErrorResponse("db_error") as never
    );

    render(<QueryPanel />);
    fireEvent.change(screen.getByPlaceholderText("Ask about costs, tonnage..."), {
      target: { value: "costos" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Query" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("query-error-hint")).not.toBeInTheDocument();
  });
});
