import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useChartColors } from "./use-chart-colors";

describe("useChartColors", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns non-empty primary string", () => {
    const { result } = renderHook(() => useChartColors());
    expect(typeof result.current.primary).toBe("string");
    expect(result.current.primary.length).toBeGreaterThan(0);
  });

  it("returns non-empty positive string", () => {
    const { result } = renderHook(() => useChartColors());
    expect(typeof result.current.positive).toBe("string");
    expect(result.current.positive.length).toBeGreaterThan(0);
  });

  it("returns non-empty negative string", () => {
    const { result } = renderHook(() => useChartColors());
    expect(typeof result.current.negative).toBe("string");
    expect(result.current.negative.length).toBeGreaterThan(0);
  });

  it("returns overridden value from stubbed getComputedStyle", () => {
    const original = window.getComputedStyle;
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: (prop: string) => {
        if (prop === "--color-primary") return " #FF0000 ";
        if (prop === "--color-positive") return " #00FF00 ";
        if (prop === "--color-negative") return " #0000FF ";
        return "";
      },
    } as unknown as CSSStyleDeclaration);

    const { result } = renderHook(() => useChartColors());
    expect(result.current.primary).toBe("#FF0000");
    expect(result.current.positive).toBe("#00FF00");
    expect(result.current.negative).toBe("#0000FF");

    vi.mocked(window.getComputedStyle).mockRestore?.();
    window.getComputedStyle = original;
  });

  it("falls back to hardcoded values when getComputedStyle returns empty", () => {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => "",
    } as unknown as CSSStyleDeclaration);

    const { result } = renderHook(() => useChartColors());
    expect(result.current.primary).toBe("#714B67");
    expect(result.current.positive).toBe("#00875A");
    expect(result.current.negative).toBe("#DE350B");
  });
});
