import { z } from "zod";

// ---------------------------------------------------------------------------
// Driver enum — exactly 4 values, order matters for zero-fill
// ---------------------------------------------------------------------------

export const DRIVERS = ["fuel", "supplies", "equipment", "labor"] as const;
export type Driver = (typeof DRIVERS)[number];

// ---------------------------------------------------------------------------
// DriverDelta — per-driver cost comparison for one period pair
// ---------------------------------------------------------------------------

export const DriverDeltaSchema = z.object({
  driver: z.enum(DRIVERS),
  currentAmount: z.number(),
  priorAmount: z.number(),
  delta: z.number(),
  deltaPct: z.number().nullable(),
});

export type DriverDelta = z.infer<typeof DriverDeltaSchema>;

// ---------------------------------------------------------------------------
// CostVarianceResult — full result including LLM narrative
// ---------------------------------------------------------------------------

export const CostVarianceResultSchema = z.object({
  mineId: z.string().uuid(),
  mineName: z.string(),
  period: z.string(),
  comparisonPeriod: z.string(),
  drivers: z.array(DriverDeltaSchema),
  totalCurrent: z.number(),
  totalPrior: z.number(),
  totalDelta: z.number(),
  totalDeltaPct: z.number().nullable(),
  narrative: z.string(),
});

export type CostVarianceResult = z.infer<typeof CostVarianceResultSchema>;

// ---------------------------------------------------------------------------
// Error code literals
// ---------------------------------------------------------------------------

export type CostVarianceErrorCode =
  | "invalid_input"
  | "mine_not_found"
  | "no_prior_period";

export interface CostVarianceError {
  code: CostVarianceErrorCode;
  message: string;
}
