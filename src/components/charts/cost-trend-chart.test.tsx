import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { CostTrendPoint } from "@/lib/queries/dashboard";

// ---------------------------------------------------------------------------
// Mock Recharts — heavy DOM/SVG components that don't work in happy-dom
// ---------------------------------------------------------------------------

vi.mock("recharts", () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div data-testid="line" />,
  XAxis: ({ dataKey }: { dataKey: string }) => (
    <div data-testid="x-axis" data-key={dataKey} />
  ),
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}));

const { CostTrendChart } = await import("./cost-trend-chart");

const trendData: CostTrendPoint[] = [
  { period: "2024-01-01", costPerTonne: 20 },
  { period: "2024-02-01", costPerTonne: 18 },
  { period: "2024-03-01", costPerTonne: 22 },
];

describe("CostTrendChart", () => {
  it("renders a LineChart wrapped in ResponsiveContainer when data is provided", () => {
    render(<CostTrendChart data={trendData} />);

    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
  });

  it("renders X axis with period dataKey", () => {
    render(<CostTrendChart data={trendData} />);

    const xAxis = screen.getByTestId("x-axis");
    expect(xAxis).toBeInTheDocument();
    expect(xAxis.getAttribute("data-key")).toBe("period");
  });

  it("renders an empty state message when data is empty", () => {
    render(<CostTrendChart data={[]} />);

    expect(screen.queryByTestId("line-chart")).toBeNull();
    expect(screen.getByTestId("cost-trend-empty")).toBeInTheDocument();
  });
});
