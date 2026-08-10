import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      shell: {
        appName: "ERP Minero",
        "nav.dashboard": "Dashboard",
        "nav.about": "About",
      },
    };
    return translations[namespace]?.[key] ?? key;
  },
}));

// Mock MineSelector — Sidebar imports it
vi.mock("@/components/mine-selector", () => ({
  MineSelector: ({ mines }: { mines: { id: string; name: string }[] }) => (
    <div data-testid="mine-selector" data-mine-count={mines.length}>
      MineSelector
    </div>
  ),
}));

const { Sidebar } = await import("./sidebar");

const mines = [
  { id: "mine-1", name: "Cerro Rojo" },
  { id: "mine-2", name: "Loma Grande" },
];

describe("Sidebar", () => {
  it("renders the translated app name", () => {
    render(<Sidebar mines={mines} />);
    expect(screen.getByText("ERP Minero")).toBeInTheDocument();
  });

  it("renders a translated Dashboard navigation link", () => {
    render(<Sidebar mines={mines} />);
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
  });

  it("renders the aside element as the root", () => {
    const { container } = render(<Sidebar mines={mines} />);
    expect(container.firstElementChild?.tagName).toBe("ASIDE");
  });

  it("passes mines to MineSelector", () => {
    render(<Sidebar mines={mines} />);
    const selector = screen.getByTestId("mine-selector");
    expect(selector).toHaveAttribute("data-mine-count", "2");
  });

  it("renders zero mine entries when mines is empty", () => {
    render(<Sidebar mines={[]} />);
    const selector = screen.getByTestId("mine-selector");
    expect(selector).toHaveAttribute("data-mine-count", "0");
  });
});
