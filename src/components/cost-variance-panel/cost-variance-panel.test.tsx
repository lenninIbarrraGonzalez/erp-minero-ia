import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      title: "Cost Variance Explainer",
      selectMine: "Select a mine",
      selectPeriod: "Period",
      submit: "Analyze",
      loading: "Calculating variance...",
      driver: "Driver",
      prior: "Prior month",
      current: "Current month",
      delta: "Change",
      deltaPct: "Change %",
      narrative: "Analysis",
      "error.generic": "An unexpected error occurred.",
      "error.mineNotFound": "The specified mine was not found.",
      "error.noPriorPeriod": "No data available for the prior month to compare.",
    };
    return map[key] ?? key;
  },
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

const { CostVariancePanel } = await import("./cost-variance-panel");

const mines = [
  { id: "550e8400-e29b-41d4-a716-446655440000", name: "Cerro Rojo" },
  { id: "660e8400-e29b-41d4-a716-446655440001", name: "Loma Grande" },
];

const sampleVarianceResult = {
  mineId: "550e8400-e29b-41d4-a716-446655440000",
  mineName: "Cerro Rojo",
  period: "2024-08-01",
  comparisonPeriod: "2024-07-01",
  drivers: [
    { driver: "fuel", currentAmount: 690000, priorAmount: 600000, delta: 90000, deltaPct: 15 },
    { driver: "supplies", currentAmount: 400000, priorAmount: 400000, delta: 0, deltaPct: 0 },
    { driver: "equipment", currentAmount: 450000, priorAmount: 450000, delta: 0, deltaPct: 0 },
    { driver: "labor", currentAmount: 350000, priorAmount: 350000, delta: 0, deltaPct: 0 },
  ],
  totalCurrent: 1890000,
  totalPrior: 1800000,
  totalDelta: 90000,
  totalDeltaPct: 5,
  narrative: "Fuel costs spiked significantly in August due to a diesel price shock.",
};

function makeSuccessResponse(data: unknown) {
  return { ok: true, json: async () => data };
}

function makeErrorResponse(error: string, status = 422) {
  return { ok: false, status, json: async () => ({ error }) };
}

describe("CostVariancePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders mine selector with options from props", () => {
    render(<CostVariancePanel mines={mines} />);

    expect(screen.getByText("Cerro Rojo")).toBeInTheDocument();
    expect(screen.getByText("Loma Grande")).toBeInTheDocument();
  });

  it("renders period input and submit button", () => {
    render(<CostVariancePanel mines={mines} />);

    expect(screen.getByRole("button", { name: "Analyze" })).toBeInTheDocument();
  });

  it("shows loading state while fetching", async () => {
    let resolve: (val: unknown) => void;
    const pending = new Promise((res) => { resolve = res; });
    vi.mocked(global.fetch).mockReturnValue(pending as never);

    render(<CostVariancePanel mines={mines} />);

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: mines[0].id } });

    const periodInput = screen.getByLabelText(/period/i);
    fireEvent.change(periodInput, { target: { value: "2024-08" } });

    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    await waitFor(() => {
      expect(screen.getByText("Calculating variance...")).toBeInTheDocument();
    });

    resolve!(makeSuccessResponse(sampleVarianceResult));
  });

  it("renders driver breakdown table after successful fetch", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      makeSuccessResponse(sampleVarianceResult) as never
    );

    render(<CostVariancePanel mines={mines} />);

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: mines[0].id } });

    const periodInput = screen.getByLabelText(/period/i);
    fireEvent.change(periodInput, { target: { value: "2024-08" } });

    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    await waitFor(() => {
      expect(screen.getByText("fuel")).toBeInTheDocument();
      expect(screen.getByText("supplies")).toBeInTheDocument();
      expect(screen.getByText("equipment")).toBeInTheDocument();
      expect(screen.getByText("labor")).toBeInTheDocument();
    });
  });

  it("renders LLM narrative after successful fetch", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      makeSuccessResponse(sampleVarianceResult) as never
    );

    render(<CostVariancePanel mines={mines} />);

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: mines[0].id } });

    const periodInput = screen.getByLabelText(/period/i);
    fireEvent.change(periodInput, { target: { value: "2024-08" } });

    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    await waitFor(() => {
      expect(
        screen.getByText("Fuel costs spiked significantly in August due to a diesel price shock.")
      ).toBeInTheDocument();
    });
  });

  it("renders error message on mine_not_found", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      makeErrorResponse("mine_not_found") as never
    );

    render(<CostVariancePanel mines={mines} />);

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: mines[0].id } });

    const periodInput = screen.getByLabelText(/period/i);
    fireEvent.change(periodInput, { target: { value: "2024-08" } });

    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("The specified mine was not found.")).toBeInTheDocument();
    });
  });

  it("renders no_prior_period error message", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      makeErrorResponse("no_prior_period") as never
    );

    render(<CostVariancePanel mines={mines} />);

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: mines[0].id } });

    const periodInput = screen.getByLabelText(/period/i);
    fireEvent.change(periodInput, { target: { value: "2024-08" } });

    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    await waitFor(() => {
      expect(screen.getByText("No data available for the prior month to compare.")).toBeInTheDocument();
    });
  });

  it("sends correct API payload with mineId and ISO period", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      makeSuccessResponse(sampleVarianceResult) as never
    );

    render(<CostVariancePanel mines={mines} />);

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: mines[0].id } });

    const periodInput = screen.getByLabelText(/period/i);
    fireEvent.change(periodInput, { target: { value: "2024-08" } });

    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    await waitFor(() => {
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        "/api/cost-variance",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            mineId: mines[0].id,
            period: "2024-08-01",
          }),
        })
      );
    });
  });
});
