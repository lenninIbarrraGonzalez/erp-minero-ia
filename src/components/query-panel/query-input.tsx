"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface QueryInputProps {
  onSubmit: (question: string) => void;
  disabled?: boolean;
}

export function QueryInput({ onSubmit, disabled = false }: QueryInputProps) {
  const t = useTranslations("textQuery");
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) {
      onSubmit(trimmed);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("placeholder")}
        disabled={disabled}
        className="flex-1 rounded border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled || value.trim() === ""}
        className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {t("submit")}
      </button>
    </form>
  );
}
