"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTranslations } from "next-intl";
import type { CostByDriverPoint } from "@/lib/queries/dashboard";
import { useChartColors } from "@/hooks/use-chart-colors";

const KNOWN_DRIVERS = ["fuel", "supplies", "equipment", "labor"] as const;
type KnownDriver = (typeof KNOWN_DRIVERS)[number];

interface CostBreakdownChartProps {
  data: CostByDriverPoint[];
}

export function CostBreakdownChart({ data }: CostBreakdownChartProps) {
  const { primary } = useChartColors();
  const t = useTranslations("costVariance");

  function translateDriver(key: string): string {
    if ((KNOWN_DRIVERS as readonly string[]).includes(key)) {
      return t(`drivers.${key as KnownDriver}`);
    }
    return key;
  }

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
        <XAxis dataKey="driver" tickFormatter={translateDriver} />
        <YAxis
          width={125}
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
