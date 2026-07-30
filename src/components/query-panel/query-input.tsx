"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

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
        className="flex-1 rounded border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
      />
      <Button
        type="submit"
        variant="primary"
        disabled={disabled || value.trim() === ""}
      >
        {t("submit")}
      </Button>
    </form>
  );
}
