"use client";

import { useTranslations } from "next-intl";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { CostVarianceResult } from "@/lib/cost-variance/types";

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

  if (!result) return null;

  const chartData = result.drivers.map((d) => ({
    driver: d.driver,
    delta: d.delta,
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
                  {d.driver}
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

      {/* Delta BarChart */}
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData}>
          <XAxis dataKey="driver" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="delta" fill="#d97706" />
        </BarChart>
      </ResponsiveContainer>

      {/* LLM narrative */}
      {result.narrative && (
        <p className="text-sm text-text italic">{result.narrative}</p>
      )}
    </div>
  );
}
