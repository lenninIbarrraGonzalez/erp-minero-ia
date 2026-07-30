"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { CostByDriverPoint } from "@/lib/queries/dashboard";
import { useChartColors } from "@/hooks/use-chart-colors";

interface CostBreakdownChartProps {
  data: CostByDriverPoint[];
}

export function CostBreakdownChart({ data }: CostBreakdownChartProps) {
  const { primary } = useChartColors();

  if (data.length === 0) {
    return (
      <div
        data-testid="cost-breakdown-empty"
        className="flex items-center justify-center h-48 text-text-muted text-sm"
      >
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <XAxis dataKey="driver" />
        <YAxis
          tickFormatter={(value: number) =>
            `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
          }
        />
        <Tooltip
          formatter={(value) => [
            `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
            "Total Cost",
          ]}
        />
        <Bar dataKey="totalCost" fill={primary} />
      </BarChart>
    </ResponsiveContainer>
  );
}
