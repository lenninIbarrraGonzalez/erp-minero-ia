"use client";

const FALLBACKS = {
  primary: "#714B67",
  positive: "#00875A",
  negative: "#DE350B",
} as const;

function readToken(property: string): string {
  if (typeof window === "undefined") return "";
  try {
    return window
      .getComputedStyle(document.documentElement)
      .getPropertyValue(property)
      .trim();
  } catch {
    return "";
  }
}

export interface ChartColors {
  primary: string;
  positive: string;
  negative: string;
}

export function useChartColors(): ChartColors {
  const primary = readToken("--color-primary") || FALLBACKS.primary;
  const positive = readToken("--color-positive") || FALLBACKS.positive;
  const negative = readToken("--color-negative") || FALLBACKS.negative;

  return { primary, positive, negative };
}
