"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { MineOption } from "@/lib/queries/dashboard";

interface MineSelectorProps {
  mines: MineOption[];
}

export function MineSelector({ mines }: MineSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("mine") ?? "";
  const t = useTranslations("dashboard");

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    if (value) {
      router.push(`/?mine=${value}`);
    } else {
      router.push("/");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="mine-select" className="text-xs text-text-muted font-medium">
        {t("filter.label")}
      </label>
      <select
        id="mine-select"
        value={selectedId}
        onChange={handleChange}
        className="bg-surface border border-border text-text text-sm px-3 py-1.5"
        style={{ borderRadius: "var(--radius)" }}
      >
        <option value="">{t("filter.allMines")}</option>
        {mines.map((mine) => (
          <option key={mine.id} value={mine.id}>
            {mine.name} ({mine.mineral_type})
          </option>
        ))}
      </select>
    </div>
  );
}
