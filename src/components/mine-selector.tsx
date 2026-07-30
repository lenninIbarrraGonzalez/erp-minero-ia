"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { MineOption } from "@/lib/queries/dashboard";

interface MineSelectorProps {
  mines: MineOption[];
  selectedId?: string;
}

export function MineSelector({ mines, selectedId }: MineSelectorProps) {
  const router = useRouter();
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
    <div className="flex items-center gap-2">
      <label htmlFor="mine-select" className="text-sm text-text-muted">
        {t("filter.label")}
      </label>
      <select
        id="mine-select"
        value={selectedId ?? ""}
        onChange={handleChange}
        className="bg-surface border border-border text-text text-sm px-3 py-1.5"
        style={{ borderRadius: "var(--radius)" }}
      >
        <option value="">{t("filter.allMines")}</option>
        {mines.map((mine) => (
          <option key={mine.id} value={mine.id}>
            {mine.name}
          </option>
        ))}
      </select>
    </div>
  );
}
