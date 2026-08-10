"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { QueryInput } from "./query-input";
import { QueryResults } from "./query-results";
import { Spinner } from "@/components/ui/spinner";
import type { ChartType, QueryRow } from "@/lib/text-query/types";

interface QueryResultData {
  rows: QueryRow[];
  chartType: ChartType;
  insightText: string;
}

interface ErrorState {
  message: string;
  suggestions?: string[];
  hintKey?: string | null;
}

export function QueryPanel() {
  const t = useTranslations("textQuery");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<QueryResultData | null>(null);
  const [error, setError] = useState<ErrorState | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [submittedQuestion, setSubmittedQuestion] = useState("");

  function handleSubmit(question: string) {
    setError(null);
    setResult(null);
    setSubmittedQuestion(question);

    startTransition(async () => {
      try {
        const res = await fetch("/api/text-query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
        });

        const data = await res.json();

        if (!res.ok) {
          const errorCode = data.error as string;
          const errorKey = mapErrorCode(errorCode);
          setError({
            message: t(errorKey),
            suggestions: data.suggestions as string[] | undefined,
            hintKey: getHintKey(errorCode),
          });
          return;
        }

        setInputValue("");
        setResult({
          rows: data.rows as QueryRow[],
          chartType: data.chartType as ChartType,
          insightText: (data.insightText as string) ?? "",
        });
      } catch {
        setError({ message: t("error.generic"), hintKey: null });
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <QueryInput
        value={inputValue}
        onValueChange={setInputValue}
        onSubmit={handleSubmit}
        disabled={isPending}
      />

      {isPending && (
        <div data-testid="query-loading">
          <Spinner label={t("loading")} />
        </div>
      )}

      {error && (
        <div role="alert" data-testid="query-error" className="text-sm text-red-600">
          <p>{error.message}</p>
          {error.suggestions && error.suggestions.length > 0 && (
            <p className="mt-1 text-xs" data-testid="query-suggestions">
              {t("error.didYouMean")}{" "}
              {error.suggestions.map((s, i) => (
                <span key={s}>
                  {i > 0 && ", "}
                  <button
                    type="button"
                    onClick={() => setInputValue(s)}
                    className="underline"
                  >
                    {s}
                  </button>
                </span>
              ))}?
            </p>
          )}
          {error.hintKey && (
            <p className="mt-1 text-xs text-text-muted" data-testid="query-error-hint">
              {t(error.hintKey)}
            </p>
          )}
        </div>
      )}

      <QueryResults result={result} question={submittedQuestion} />
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
    llm_timeout: "error.llmTimeout",
    llm_rate_limit: "error.llmRateLimit",
    llm_auth_error: "error.llmAuthError",
    db_error: "error.generic",
    db_connection_error: "error.dbConnectionError",
    db_timeout: "error.dbTimeout",
    internal_error: "error.generic",
    // Route returns the full i18n key for Zod validation failures
    "textQuery.error.invalidQuestion": "error.invalidQuestion",
    year_out_of_range: "error.yearOutOfRange",
    ambiguous_query: "error.ambiguousQuery",
    overlapping_period: "error.overlappingPeriod",
  };
  return map[code] ?? "error.generic";
}

function getHintKey(code: string): string | null {
  const map: Record<string, string> = {
    llm_timeout: "error.hint.llmTimeout",
    llm_rate_limit: "error.hint.llmRateLimit",
    llm_auth_error: "error.hint.llmAuthError",
    db_connection_error: "error.hint.dbConnectionError",
    db_timeout: "error.hint.dbTimeout",
    mine_not_found: "error.hint.mineNotFound",
    parse_failure: "error.hint.parseFailure",
    year_out_of_range: "error.hint.yearOutOfRange",
    out_of_scope: "error.hint.outOfScope",
  };
  return map[code] ?? null;
}
