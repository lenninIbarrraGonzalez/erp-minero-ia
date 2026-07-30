import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { CostByDriverPoint } from "@/lib/queries/dashboard";

// ---------------------------------------------------------------------------
// Mock Recharts
// ---------------------------------------------------------------------------

vi.mock("recharts", () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: ({ dataKey, fill }: { dataKey: string; fill?: string }) => (
    <div data-testid="bar" data-key={dataKey} data-fill={fill} />
  ),
  XAxis: ({ dataKey }: { dataKey: string }) => (
    <div data-testid="x-axis" data-key={dataKey} />
  ),
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}));

// ---------------------------------------------------------------------------
// Mock useChartColors — hook returns resolved token colors
// ---------------------------------------------------------------------------

vi.mock("@/hooks/use-chart-colors", () => ({
  useChartColors: () => ({
    primary: "#714B67",
    positive: "#00875A",
    negative: "#DE350B",
  }),
}));

const { CostBreakdownChart } = await import("./cost-breakdown-chart");

const breakdownData: CostByDriverPoint[] = [
  { driver: "fuel", totalCost: 5000 },
  { driver: "labor", totalCost: 4000 },
  { driver: "supplies", totalCost: 1500 },
  { driver: "equipment", totalCost: 2500 },
];

describe("CostBreakdownChart", () => {
  it("renders a BarChart wrapped in ResponsiveContainer when data is provided", () => {
    render(<CostBreakdownChart data={breakdownData} />);

    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("renders X axis with driver dataKey", () => {
    render(<CostBreakdownChart data={breakdownData} />);

    const xAxis = screen.getByTestId("x-axis");
    expect(xAxis).toBeInTheDocument();
    expect(xAxis.getAttribute("data-key")).toBe("driver");
  });

  it("renders Bar with totalCost dataKey", () => {
    render(<CostBreakdownChart data={breakdownData} />);

    const bar = screen.getByTestId("bar");
    expect(bar.getAttribute("data-key")).toBe("totalCost");
  });

  it("renders Bar with color from useChartColors, not hardcoded #d97706", () => {
    render(<CostBreakdownChart data={breakdownData} />);

    const bar = screen.getByTestId("bar");
    expect(bar.getAttribute("data-fill")).toBe("#714B67");
    expect(bar.getAttribute("data-fill")).not.toBe("#d97706");
  });

  it("renders an empty state message when data is empty", () => {
    render(<CostBreakdownChart data={[]} />);

    expect(screen.queryByTestId("bar-chart")).toBeNull();
    expect(screen.getByTestId("cost-breakdown-empty")).toBeInTheDocument();
  });
});
