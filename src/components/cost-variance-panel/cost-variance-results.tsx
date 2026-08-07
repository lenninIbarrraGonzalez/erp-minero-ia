"use client";

import { useTranslations } from "next-intl";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { CostVarianceResult } from "@/lib/cost-variance/types";
import { useChartColors } from "@/hooks/use-chart-colors";

interface CostVarianceResultsProps {
  result: CostVarianceResult | null;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtPct(n: number | null): string {
  if (n === null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

export function deltaClass(delta: number): string {
  if (delta > 0) return "text-negative";
  if (delta < 0) return "text-positive";
  return "text-text";
}

export function CostVarianceResults({ result }: CostVarianceResultsProps) {
  const t = useTranslations("costVariance");
  const chartColors = useChartColors();

  if (!result) return null;

  const KNOWN_DRIVERS = ["fuel", "supplies", "equipment", "labor"] as const;
  type KnownDriver = (typeof KNOWN_DRIVERS)[number];
  const driverLabel = (driver: string) =>
    KNOWN_DRIVERS.includes(driver as KnownDriver)
      ? t(`drivers.${driver}`)
      : driver;

  const chartData = result.drivers.map((d) => ({
    driver: driverLabel(d.driver),
    absDelta: Math.abs(d.delta),
    increase: d.delta > 0,
  }));

  return (
    <div className="mt-4 flex flex-col gap-4">
      {/* Driver breakdown table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-border bg-surface px-3 py-2 text-left font-medium text-text-muted">
                {t("driver")}
              </th>
              <th className="border border-border bg-surface px-3 py-2 text-right font-medium text-text-muted">
                {t("prior")}
              </th>
              <th className="border border-border bg-surface px-3 py-2 text-right font-medium text-text-muted">
                {t("current")}
              </th>
              <th className="border border-border bg-surface px-3 py-2 text-right font-medium text-text-muted">
                {t("delta")}
              </th>
              <th className="border border-border bg-surface px-3 py-2 text-right font-medium text-text-muted">
                {t("deltaPct")}
              </th>
            </tr>
          </thead>
          <tbody>
            {result.drivers.map((d) => (
              <tr key={d.driver}>
                <td className="border border-border px-3 py-2 text-text font-medium">
                  {driverLabel(d.driver)}
                </td>
                <td className="border border-border px-3 py-2 text-right text-text">
                  {fmt(d.priorAmount)}
                </td>
                <td className="border border-border px-3 py-2 text-right text-text">
                  {fmt(d.currentAmount)}
                </td>
                <td
                  className={`border border-border px-3 py-2 text-right font-medium ${deltaClass(d.delta)}`}
                >
                  {d.delta >= 0 ? "+" : ""}
                  {fmt(d.delta)}
                </td>
                <td
                  className={`border border-border px-3 py-2 text-right ${deltaClass(d.deltaPct ?? 0)}`}
                >
                  {fmtPct(d.deltaPct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delta BarChart — absolute values, colored by direction */}
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData}>
          <XAxis dataKey="driver" />
          <YAxis
            tickFormatter={(v: number) =>
              v.toLocaleString("en-US", { maximumFractionDigits: 0 })
            }
          />
          <Tooltip
            formatter={(value, _name, item) => {
              const n = typeof value === "number" ? value : Number(value ?? 0);
              const increase = (item as { payload?: { increase?: boolean } }).payload?.increase;
              return [
                n.toLocaleString("en-US", { maximumFractionDigits: 0 }),
                increase ? "▲ Aumento" : "▼ Reducción",
              ];
            }}
          />
          <Bar dataKey="absDelta">
            {chartData.map((entry, idx) => (
              <Cell
                key={idx}
                fill={entry.increase ? chartColors.negative : chartColors.positive}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* LLM narrative */}
      {result.narrative && (
        <p className="text-sm text-text italic">{result.narrative}</p>
      )}
    </div>
  );
}
