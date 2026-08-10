import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { MineOption } from "@/lib/queries/dashboard";

// ---------------------------------------------------------------------------
// Mock next/navigation
// ---------------------------------------------------------------------------

const mockPush = vi.fn();
const mockGet = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockGet }),
}));

// ---------------------------------------------------------------------------
// Mock next-intl
// ---------------------------------------------------------------------------

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      "filter.label": "Filter by Mine",
      "filter.allMines": "All Mines",
    };
    return map[key] ?? key;
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks are set up
// ---------------------------------------------------------------------------

const { MineSelector } = await import("./mine-selector");

const mines: MineOption[] = [
  { id: "uuid-1", name: "Mina Norte", mineral_type: "Cu" },
  { id: "uuid-2", name: "Mina Sur", mineral_type: "Au" },
];

describe("MineSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReturnValue(null);
  });

  it("renders select with all mine options and the all-mines option", () => {
    render(<MineSelector mines={mines} />);

    expect(screen.getByText("All Mines")).toBeInTheDocument();
    expect(screen.getByText("Mina Norte (Cu)")).toBeInTheDocument();
    expect(screen.getByText("Mina Sur (Au)")).toBeInTheDocument();
  });

  it("selects the currently active mine from URL param", () => {
    mockGet.mockReturnValue("uuid-2");

    render(<MineSelector mines={mines} />);

    const select = screen.getByRole("combobox");
    expect((select as HTMLSelectElement).value).toBe("uuid-2");
  });

  it("calls router.push with ?mine=<id> when a mine is selected", () => {
    render(<MineSelector mines={mines} />);

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "uuid-1" } });

    expect(mockPush).toHaveBeenCalledWith("/?mine=uuid-1");
  });

  it("calls router.push('/') when 'All Mines' is selected", () => {
    render(<MineSelector mines={mines} />);

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "" } });

    expect(mockPush).toHaveBeenCalledWith("/");
  });
});
