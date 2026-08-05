"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { QueryInput } from "./query-input";
import { QueryResults } from "./query-results";
import type { ChartType, QueryRow } from "@/lib/text-query/types";

interface QueryResultData {
  rows: QueryRow[];
  chartType: ChartType;
  insightText: string;
}

export function QueryPanel() {
  const t = useTranslations("textQuery");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<QueryResultData | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(question: string) {
    setError(null);
    setResult(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/text-query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
        });

        const data = await res.json();

        if (!res.ok) {
          // Map error code to i18n key where possible
          const errorKey = mapErrorCode(data.error as string);
          setError(t(errorKey));
          return;
        }

        setResult({
          rows: data.rows as QueryRow[],
          chartType: data.chartType as ChartType,
          insightText: (data.insightText as string) ?? "",
        });
      } catch {
        setError(t("error.generic"));
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <QueryInput onSubmit={handleSubmit} disabled={isPending} />

      {isPending && (
        <p className="text-sm text-text-muted">{t("loading")}</p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <QueryResults result={result} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Map API error code strings to i18n key suffixes
// ---------------------------------------------------------------------------

function mapErrorCode(code: string): string {
  const map: Record<string, string> = {
    parse_failure: "error.parseFailure",
    unsupported_metric: "error.unsupportedMetric",
    mine_not_found: "error.mineNotFound",
    out_of_scope: "error.outOfScope",
    llm_error: "error.generic",
    db_error: "error.generic",
    internal_error: "error.generic",
  };
  return map[code] ?? "error.generic";
}
