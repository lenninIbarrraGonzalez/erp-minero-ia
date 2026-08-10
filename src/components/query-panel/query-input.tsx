"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const WARN_AT = 400;
const MAX_LEN = 500;

interface QueryInputProps {
  onSubmit: (question: string) => void;
  disabled?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
}

export function QueryInput({ onSubmit, disabled = false, value: externalValue, onValueChange }: QueryInputProps) {
  const t = useTranslations("textQuery");
  const [internalValue, setInternalValue] = useState("");

  const value = externalValue !== undefined ? externalValue : internalValue;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (onValueChange !== undefined) {
      onValueChange(e.target.value);
    } else {
      setInternalValue(e.target.value);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) {
      onSubmit(trimmed);
    }
  }

  const examples = t.raw("examples") as string[];

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          placeholder={t("placeholder")}
          disabled={disabled}
          maxLength={MAX_LEN}
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
      {value.length > WARN_AT && (
        <p
          data-testid="char-counter"
          className={value.length >= MAX_LEN ? "text-red-600 text-xs" : "text-yellow-600 text-xs"}
        >
          {value.length}/{MAX_LEN}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-xs text-text-muted">{t("examplesLabel")}:</span>
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              if (onValueChange !== undefined) {
                onValueChange(example);
              } else {
                setInternalValue(example);
              }
            }}
            className="rounded-full border border-border px-3 py-0.5 text-xs text-text-muted transition-colors hover:border-primary hover:text-primary"
          >
            {example} ↗
          </button>
        ))}
      </div>
    </div>
  );
}
