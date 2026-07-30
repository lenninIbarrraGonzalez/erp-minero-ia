import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock server-only modules
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() => ({})),
}));

// ---------------------------------------------------------------------------
// Mock query functions
// ---------------------------------------------------------------------------

vi.mock("@/lib/queries/dashboard", () => ({
  fetchMines: vi.fn().mockResolvedValue([
    { id: "uuid-1", name: "Mina Norte" },
    { id: "uuid-2", name: "Mina Sur" },
  ]),
  fetchKpiSummary: vi.fn().mockResolvedValue({
    totalTonnage: 1200,
    costPerTonne: 20,
    mineName: null,
  }),
  fetchCostTrend: vi.fn().mockResolvedValue([
    { period: "2024-01-01", costPerTonne: 20 },
  ]),
  fetchCostByDriver: vi.fn().mockResolvedValue([
    { driver: "fuel", totalCost: 5000 },
  ]),
}));

// ---------------------------------------------------------------------------
// Mock next-intl
// ---------------------------------------------------------------------------

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => {
    const map: Record<string, string> = {
      title: "Control Panel",
      "kpi.totalTonnage": "Total Tonnage",
      "kpi.avgCostPerTonne": "Avg Cost/Tonne",
      "kpi.activeMines": "Mine",
    };
    return map[key] ?? key;
  }),
}));

// ---------------------------------------------------------------------------
// Mock next/navigation (used by MineSelector child)
// ---------------------------------------------------------------------------

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn().mockReturnValue(null) }),
}));

// ---------------------------------------------------------------------------
// Mock next-intl (client hook used by MineSelector)
// ---------------------------------------------------------------------------

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// ---------------------------------------------------------------------------
// Import page component after mocks
// ---------------------------------------------------------------------------

const { default: Home } = await import("./page");

describe("Home (dashboard page)", () => {
  it("renders page title from i18n", async () => {
    const searchParams = Promise.resolve({});
    const element = await Home({ searchParams });
    render(element);

    expect(screen.getByText("Control Panel")).toBeInTheDocument();
  });

  it("renders KPI values from query data", async () => {
    const searchParams = Promise.resolve({});
    const element = await Home({ searchParams });
    render(element);

    // KpiCard renders the value prop
    expect(screen.getByText("1,200")).toBeInTheDocument();
  });

  it("renders the mine selector with mine options", async () => {
    const searchParams = Promise.resolve({});
    const element = await Home({ searchParams });
    render(element);

    expect(screen.getByText("Mina Norte")).toBeInTheDocument();
    expect(screen.getByText("Mina Sur")).toBeInTheDocument();
  });
});
