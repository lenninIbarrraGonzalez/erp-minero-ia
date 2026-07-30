"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface Mine {
  id: string;
  name: string;
}

interface CostVarianceInputProps {
  mines: Mine[];
  onSubmit: (mineId: string, period: string) => void;
  disabled?: boolean;
}

export function CostVarianceInput({
  mines,
  onSubmit,
  disabled = false,
}: CostVarianceInputProps) {
  const t = useTranslations("costVariance");
  const [mineId, setMineId] = useState(mines[0]?.id ?? "");
  const [month, setMonth] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mineId || !month) return;
    // Convert "YYYY-MM" → "YYYY-MM-01" for the API
    onSubmit(mineId, `${month}-01`);
  }

  const canSubmit = mineId !== "" && month !== "" && !disabled;

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="cv-mine"
          className="text-xs font-medium text-text-muted"
        >
          {t("selectMine")}
        </label>
        <select
          id="cv-mine"
          value={mineId}
          onChange={(e) => setMineId(e.target.value)}
          disabled={disabled}
          className="rounded border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        >
          {mines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="cv-period"
          className="text-xs font-medium text-text-muted"
        >
          {t("selectPeriod")}
        </label>
        <input
          id="cv-period"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          disabled={disabled}
          aria-label={t("selectPeriod")}
          className="rounded border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        />
      </div>

      <Button type="submit" variant="primary" disabled={!canSubmit}>
        {t("submit")}
      </Button>
    </form>
  );
}
