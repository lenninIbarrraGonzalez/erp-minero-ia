import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      driver: "Driver",
      prior: "Prior",
      current: "Current",
      delta: "Change",
      deltaPct: "Change %",
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

const { CostVarianceResults } = await import("./cost-variance-results");

const resultWithPositiveDelta = {
  mineId: "mine-1",
  mineName: "Cerro Rojo",
  period: "2024-08-01",
  comparisonPeriod: "2024-07-01",
  drivers: [
    { driver: "fuel" as const, currentAmount: 690000, priorAmount: 600000, delta: 90000, deltaPct: 15 },
    { driver: "supplies" as const, currentAmount: 350000, priorAmount: 400000, delta: -50000, deltaPct: -12.5 },
  ],
  totalCurrent: 1040000,
  totalPrior: 1000000,
  totalDelta: 40000,
  totalDeltaPct: 4,
  narrative: "Fuel costs spiked due to diesel price shock.",
};

describe("CostVarianceResults", () => {
  it("renders null when result is null", () => {
    const { container } = render(<CostVarianceResults result={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders driver names in the table", () => {
    render(<CostVarianceResults result={resultWithPositiveDelta} />);
    expect(screen.getByText("fuel")).toBeInTheDocument();
    expect(screen.getByText("supplies")).toBeInTheDocument();
  });

  it("applies text-negative class to positive delta cells (cost increase)", () => {
    render(<CostVarianceResults result={resultWithPositiveDelta} />);
    // fuel delta is +90000 — should use text-negative
    const cells = screen.getAllByRole("cell");
    const fuelDeltaCell = cells.find((c) => c.textContent === "+90,000");
    expect(fuelDeltaCell).toBeTruthy();
    expect(fuelDeltaCell!.className).toContain("text-negative");
    expect(fuelDeltaCell!.className).not.toContain("text-red");
  });

  it("applies text-positive class to negative delta cells (cost decrease)", () => {
    render(<CostVarianceResults result={resultWithPositiveDelta} />);
    // supplies delta is -50000 — should use text-positive
    const cells = screen.getAllByRole("cell");
    const suppliesDeltaCell = cells.find((c) => c.textContent === "-50,000");
    expect(suppliesDeltaCell).toBeTruthy();
    expect(suppliesDeltaCell!.className).toContain("text-positive");
    expect(suppliesDeltaCell!.className).not.toContain("text-green");
  });

  it("renders narrative when present", () => {
    render(<CostVarianceResults result={resultWithPositiveDelta} />);
    expect(screen.getByText("Fuel costs spiked due to diesel price shock.")).toBeInTheDocument();
  });
});
