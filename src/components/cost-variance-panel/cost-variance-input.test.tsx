import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      selectMine: "Select a mine",
      selectPeriod: "Period",
      submit: "Analyze",
    };
    return map[key] ?? key;
  },
}));

const { CostVarianceInput } = await import("./cost-variance-input");

const mines = [
  { id: "mine-1", name: "Cerro Rojo" },
  { id: "mine-2", name: "Loma Grande" },
];

describe("CostVarianceInput", () => {
  it("renders mine select with options", () => {
    render(<CostVarianceInput mines={mines} onSubmit={vi.fn()} />);
    expect(screen.getByText("Cerro Rojo")).toBeInTheDocument();
    expect(screen.getByText("Loma Grande")).toBeInTheDocument();
  });

  it("renders period input", () => {
    render(<CostVarianceInput mines={mines} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText("Period")).toBeInTheDocument();
  });

  it("renders submit button with no amber classes", () => {
    render(<CostVarianceInput mines={mines} onSubmit={vi.fn()} />);
    const btn = screen.getByRole("button", { name: "Analyze" });
    expect(btn.className).not.toContain("amber");
    expect(btn.className).toContain("bg-primary");
  });

  it("submit button is disabled when period is empty", () => {
    render(<CostVarianceInput mines={mines} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Analyze" })).toBeDisabled();
  });

  it("calls onSubmit with mineId and ISO period after form submit", () => {
    const handleSubmit = vi.fn();
    render(<CostVarianceInput mines={mines} onSubmit={handleSubmit} />);

    const periodInput = screen.getByLabelText("Period");
    fireEvent.change(periodInput, { target: { value: "2024-08" } });

    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    expect(handleSubmit).toHaveBeenCalledWith("mine-1", "2024-08-01");
  });

  it("disables all controls when disabled=true", () => {
    render(<CostVarianceInput mines={mines} onSubmit={vi.fn()} disabled />);
    const selects = screen.getAllByRole("combobox");
    selects.forEach((s) => expect(s).toBeDisabled());
    expect(screen.getByRole("button", { name: "Analyze" })).toBeDisabled();
  });
});
