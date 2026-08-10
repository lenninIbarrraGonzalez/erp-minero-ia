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

const KNOWN_DRIVERS = ["fuel", "supplies", "equipment", "labor"] as const;
type KnownDriver = (typeof KNOWN_DRIVERS)[number];

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
  question?: string;
}

export function QueryResults({ result, question }: QueryResultsProps) {
  const t = useTranslations("textQuery");
  const tVariance = useTranslations("costVariance");
  const chartColors = useChartColors();

  function translateDriver(key: string): string {
    if ((KNOWN_DRIVERS as readonly string[]).includes(key)) {
      return tVariance(`drivers.${key as KnownDriver}`);
    }
    return key;
  }

  function translateColumn(key: string): string {
    const known = ["driver", "amount", "period", "mine", "costPerTonne", "tonnage"] as const;
    if ((known as readonly string[]).includes(key)) {
      return t(`columns.${key as (typeof known)[number]}`);
    }
    return key;
  }

  function formatCellValue(col: string, value: string | number): string {
    if (typeof value === "number") return numFmt.format(value);
    if (col === "driver") return translateDriver(value);
    return value;
  }

  if (!result) return null;

  const { rows, chartType, insightText } = result;

  if (rows.length === 0) {
    return (
      <p data-testid="query-empty" className="text-sm text-text-muted mt-4">{t("emptyResult")}</p>
    );
  }

  const columns = Object.keys(rows[0]);

  // Numeric key for chart Y-axis — must be the first column that holds a number value
  const numericKey =
    columns.find((c) => typeof rows[0][c] === "number") ?? columns[columns.length - 1];

  return (
    <div data-testid="query-results" className="mt-4 flex flex-col gap-4">
      {/* Question header */}
      {question && (
        <p className="text-sm font-semibold text-primary border-l-4 border-primary pl-3 py-1">
          {question}
        </p>
      )}
      {/* Table */}
      <div className="overflow-x-auto">
        <table data-testid="query-table" className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="border border-border bg-surface px-3 py-2 text-left font-medium text-text-muted"
                >
                  {translateColumn(col)}
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
                    {formatCellValue(col, row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Chart */}
      {chartType === "line" && (
        <div data-testid="query-chart-line">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={rows}>
            <XAxis dataKey="period" />
            <YAxis
              width={80}
              tickFormatter={(v: number) =>
                v.toLocaleString("en-US", { maximumFractionDigits: 2 })
              }
            />
            <Tooltip
              formatter={(value) => [
                Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 }),
                numericKey,
              ]}
            />
            <Line
              type="monotone"
              dataKey={numericKey}
              stroke={chartColors.primary}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
        </div>
      )}

      {chartType === "bar" && (
        <div data-testid="query-chart-bar">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={rows}>
            <XAxis dataKey={columns[0]} tickFormatter={(v: string) => columns[0] === "driver" ? translateDriver(v) : v} />
            <YAxis
              width={90}
              tickFormatter={(v: number) =>
                v.toLocaleString("en-US", { maximumFractionDigits: 0 })
              }
            />
            <Tooltip
              formatter={(value) => [
                Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 }),
                numericKey,
              ]}
            />
            <Bar dataKey={numericKey} fill={chartColors.primary} />
          </BarChart>
        </ResponsiveContainer>
        </div>
      )}

      {/* Insight */}
      {insightText && (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-primary uppercase tracking-wide">
            {t("insight.label")}
          </span>
          <p data-testid="query-insight" className="text-sm text-text italic">{insightText}</p>
        </div>
      )}
    </div>
  );
}
