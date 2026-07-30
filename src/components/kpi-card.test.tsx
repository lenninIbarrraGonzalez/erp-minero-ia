import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiCard } from "./kpi-card";

describe("KpiCard", () => {
  it("renders label and value", () => {
    render(<KpiCard label="Total Tonnage" value="1,200 t" />);

    expect(screen.getByText("Total Tonnage")).toBeInTheDocument();
    expect(screen.getByText("1,200 t")).toBeInTheDocument();
  });

  it("renders positive delta with + prefix", () => {
    render(<KpiCard label="Cost" value="$20" delta={5.2} />);

    expect(screen.getByText("+5.2%")).toBeInTheDocument();
  });

  it("renders negative delta with - prefix", () => {
    render(<KpiCard label="Cost" value="$20" delta={-3.1} />);

    expect(screen.getByText("-3.1%")).toBeInTheDocument();
  });

  it("does not render delta element when delta is omitted", () => {
    render(<KpiCard label="Mines" value="4" />);

    // Should not find any +/- delta text
    expect(screen.queryByText(/[+-]\d/)).toBeNull();
  });
});
