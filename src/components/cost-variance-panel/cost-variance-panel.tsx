"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { CostVarianceInput } from "./cost-variance-input";
import { CostVarianceResults } from "./cost-variance-results";
import type { CostVarianceResult } from "@/lib/cost-variance/types";
import type { PeriodRange } from "@/lib/queries/dashboard";

interface Mine {
  id: string;
  name: string;
}

interface CostVariancePanelProps {
  mines: Mine[];
  periodRange: PeriodRange | null;
}

export function CostVariancePanel({ mines, periodRange }: CostVariancePanelProps) {
  const t = useTranslations("costVariance");
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<CostVarianceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(mineId: string, period: string) {
    setError(null);
    setResult(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/cost-variance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mineId, period, locale }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(t(mapErrorCode(data.error as string)));
          return;
        }

        setResult(data as CostVarianceResult);
      } catch {
        setError(t("error.generic"));
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-medium text-text-muted">{t("title")}</h2>

      <CostVarianceInput
        mines={mines}
        onSubmit={handleSubmit}
        disabled={isPending}
        minPeriod={periodRange?.min}
        maxPeriod={periodRange?.max}
      />

      {isPending && (
        <p className="text-sm text-text-muted">{t("loading")}</p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <CostVarianceResults result={result} />
    </div>
  );
}

function mapErrorCode(code: string): string {
  const map: Record<string, string> = {
    mine_not_found: "error.mineNotFound",
    no_prior_period: "error.noPriorPeriod",
    no_data_in_period: "error.noDataInPeriod",
    invalid_input: "error.generic",
    internal_error: "error.generic",
  };
  return map[code] ?? "error.generic";
}
