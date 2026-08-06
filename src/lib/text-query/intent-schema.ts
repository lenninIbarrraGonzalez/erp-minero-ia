import { z } from "zod";

// ---------------------------------------------------------------------------
// Zod schema for ParsedIntent
// ---------------------------------------------------------------------------

const monthSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
  z.literal(8),
  z.literal(9),
  z.literal(10),
  z.literal(11),
  z.literal(12),
]);

export const ParsedIntentSchema = z.object({
  metric: z.enum(["cost_per_tonne", "tonnage", "cost_by_driver"]),
  mineName: z.string().optional(),
  mineNames: z.array(z.string()).min(2).optional(),
  driverFilter: z.enum(["fuel", "supplies", "equipment", "labor"]).optional(),
  period: z
    .object({
      year: z.number().int().min(2000).max(2100),
      month: monthSchema.optional(),
      quarter: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
    })
    .optional(),
  groupBy: z.enum(["mine", "driver", "month"]).optional(),
});

export type ParsedIntentFromSchema = z.infer<typeof ParsedIntentSchema>;
