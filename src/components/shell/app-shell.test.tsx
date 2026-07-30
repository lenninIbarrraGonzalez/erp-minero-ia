import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock Sidebar — AppShell is a Server Component; we test its structural output
// ---------------------------------------------------------------------------

vi.mock("./sidebar", () => ({
  Sidebar: ({ mines }: { mines: { id: string; name: string }[] }) => (
    <nav data-testid="sidebar" data-mine-count={mines.length}>
      <span>Sidebar</span>
    </nav>
  ),
}));

const { AppShell } = await import("./app-shell");

const mines = [
  { id: "mine-1", name: "Cerro Rojo" },
  { id: "mine-2", name: "Loma Grande" },
];

describe("AppShell", () => {
  it("renders children inside the main content area", async () => {
    const element = await AppShell({ children: <p>Page Content</p>, mines });
    render(element);
    expect(screen.getByText("Page Content")).toBeInTheDocument();
  });

  it("renders the Sidebar component", async () => {
    const element = await AppShell({ children: <p>Content</p>, mines });
    render(element);
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
  });

  it("passes mines array to Sidebar", async () => {
    const element = await AppShell({ children: <p>Content</p>, mines });
    render(element);
    expect(screen.getByTestId("sidebar")).toHaveAttribute("data-mine-count", "2");
  });

  it("renders sidebar and main as siblings in a flex-row container", async () => {
    const element = await AppShell({ children: <p>Content</p>, mines });
    const { container } = render(element);
    const wrapper = container.firstElementChild;
    expect(wrapper?.tagName).toBe("DIV");
    // Sidebar + main are direct children
    expect(wrapper?.children.length).toBe(2);
  });

  it("renders main element that contains children", async () => {
    const element = await AppShell({ children: <p data-testid="inner">Inner</p>, mines });
    render(element);
    const inner = screen.getByTestId("inner");
    // The main wrapping the content should be present
    expect(inner.closest("main")).toBeTruthy();
  });
});
