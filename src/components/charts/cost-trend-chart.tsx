"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { CostTrendPoint } from "@/lib/queries/dashboard";
import { useChartColors } from "@/hooks/use-chart-colors";

interface CostTrendChartProps {
  data: CostTrendPoint[];
}

function formatPeriodLabel(period: string): string {
  const date = new Date(period);
  return date.toLocaleDateString("en-US", { month: "short" });
}

export function CostTrendChart({ data }: CostTrendChartProps) {
  const { primary } = useChartColors();

  if (data.length === 0) {
    return (
      <div
        data-testid="cost-trend-empty"
        className="flex items-center justify-center h-48 text-text-muted text-sm"
      >
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <XAxis dataKey="period" tickFormatter={formatPeriodLabel} />
        <YAxis
          tickFormatter={(value: number) =>
            `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
          }
        />
        <Tooltip
          formatter={(value) => [
            `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
            "Cost/Tonne",
          ]}
          labelFormatter={(label) => formatPeriodLabel(String(label))}
        />
        <Line
          type="monotone"
          dataKey="costPerTonne"
          stroke={primary}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
