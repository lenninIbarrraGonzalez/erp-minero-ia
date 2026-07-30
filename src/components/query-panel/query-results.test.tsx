import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("recharts", () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}));

const { QueryResults } = await import("./query-results");

const sampleResult = {
  rows: [{ period: "2024-01", value: 100 }],
  chartType: "line" as const,
  insightText: "Costs increased by 10%",
};

describe("QueryResults", () => {
  it("renders nothing when result is null", () => {
    const { container } = render(<QueryResults result={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders insight label before insight text when insightText is provided", () => {
    render(<QueryResults result={sampleResult} />);
    // The insight label key should be rendered (mocked t returns the key)
    expect(screen.getByText("insight.label")).toBeInTheDocument();
    expect(screen.getByText("Costs increased by 10%")).toBeInTheDocument();
  });

  it("insight label appears before insight text in DOM order", () => {
    render(<QueryResults result={sampleResult} />);
    const label = screen.getByText("insight.label");
    const insight = screen.getByText("Costs increased by 10%");
    // label comes before insight text
    expect(label.compareDocumentPosition(insight)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it("does not render insight label when insightText is empty", () => {
    render(
      <QueryResults
        result={{ ...sampleResult, insightText: "" }}
      />
    );
    expect(screen.queryByText("insight.label")).toBeNull();
  });

  it("renders empty result message when rows are empty", () => {
    render(
      <QueryResults
        result={{ rows: [], chartType: "line", insightText: "" }}
      />
    );
    expect(screen.getByText("emptyResult")).toBeInTheDocument();
  });
});
