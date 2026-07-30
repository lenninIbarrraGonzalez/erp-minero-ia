import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock server-only and supabase
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() => ({})),
}));

// ---------------------------------------------------------------------------
// Mock query layer
// ---------------------------------------------------------------------------

vi.mock("@/lib/queries/dashboard", () => ({
  fetchMines: vi.fn().mockResolvedValue([
    { id: "uuid-1", name: "Mina Norte" },
    { id: "uuid-2", name: "Mina Sur" },
  ]),
}));

// ---------------------------------------------------------------------------
// Mock next-intl/server
// ---------------------------------------------------------------------------

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn().mockResolvedValue("en"),
}));

// ---------------------------------------------------------------------------
// Mock next-intl (client side, used by MineSelector inside Sidebar)
// ---------------------------------------------------------------------------

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// ---------------------------------------------------------------------------
// Mock next/navigation
// ---------------------------------------------------------------------------

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Mock next/font/google — Geist fonts
// ---------------------------------------------------------------------------

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans", className: "geist-sans" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono", className: "geist-mono" }),
}));

// ---------------------------------------------------------------------------
// Mock AppShell — layout wraps children in it
// ---------------------------------------------------------------------------

vi.mock("@/components/shell/app-shell", () => ({
  AppShell: ({
    children,
    mines,
  }: {
    children: React.ReactNode;
    mines: { id: string; name: string }[];
  }) => (
    <div data-testid="app-shell" data-mine-count={mines.length}>
      {children}
    </div>
  ),
}));

const { default: RootLayout } = await import("./layout");

describe("RootLayout", () => {
  it("renders children inside the layout", async () => {
    const element = await RootLayout({ children: <p>Hello World</p> });
    render(element);
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("wraps children in AppShell", async () => {
    const element = await RootLayout({ children: <p>Content</p> });
    render(element);
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
  });

  it("passes mines from fetchMines to AppShell", async () => {
    const element = await RootLayout({ children: <p>Content</p> });
    render(element);
    expect(screen.getByTestId("app-shell")).toHaveAttribute("data-mine-count", "2");
  });
});
