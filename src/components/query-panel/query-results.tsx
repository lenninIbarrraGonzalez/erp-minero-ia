"use client";

import { useTranslations } from "next-intl";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ChartType, QueryRow } from "@/lib/text-query/types";
import { useChartColors } from "@/hooks/use-chart-colors";

const numFmt = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

function formatCell(value: string | number): string {
  if (typeof value === "number") return numFmt.format(value);
  return value;
}

interface QueryResultsData {
  rows: QueryRow[];
  chartType: ChartType;
  insightText: string;
}

interface QueryResultsProps {
  result: QueryResultsData | null;
}

export function QueryResults({ result }: QueryResultsProps) {
  const t = useTranslations("textQuery");
  const chartColors = useChartColors();

  if (!result) return null;

  const { rows, chartType, insightText } = result;

  if (rows.length === 0) {
    return (
      <p className="text-sm text-text-muted mt-4">{t("emptyResult")}</p>
    );
  }

  const columns = Object.keys(rows[0]);

  // Numeric key for chart Y-axis — must be the first column that holds a number value
  const numericKey =
    columns.find((c) => typeof rows[0][c] === "number") ?? columns[columns.length - 1];

  return (
    <div className="mt-4 flex flex-col gap-4">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="border border-border bg-surface px-3 py-2 text-left font-medium text-text-muted"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td
                    key={col}
                    className="border border-border px-3 py-2 text-text"
                  >
                    {formatCell(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Chart */}
      {chartType === "line" && (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={rows}>
            <XAxis dataKey="period" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey={numericKey}
              stroke={chartColors.primary}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      {chartType === "bar" && (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={rows}>
            <XAxis dataKey={columns[0]} />
            <YAxis />
            <Tooltip />
            <Bar dataKey={numericKey} fill={chartColors.primary} />
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Insight */}
      {insightText && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
            {t("insight.label")}
          </span>
          <p className="text-sm text-text italic">{insightText}</p>
        </div>
      )}
    </div>
  );
}
