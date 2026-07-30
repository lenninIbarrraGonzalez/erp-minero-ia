import { Badge } from "@/components/ui/badge";
import type { BadgeVariant } from "@/components/ui/badge";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: number;
}

function getDeltaVariant(delta: number): BadgeVariant {
  if (delta > 0) return "positive";
  if (delta < 0) return "negative";
  return "neutral";
}

export function KpiCard({ label, value, delta }: KpiCardProps) {
  const hasDelta = delta !== undefined;

  const deltaText = hasDelta
    ? `${delta > 0 ? "+" : ""}${delta}%`
    : null;

  return (
    <div
      className="bg-surface border border-border p-4 flex flex-col gap-1"
      style={{ borderRadius: "var(--radius)" }}
    >
      <span className="text-sm text-text-muted">{label}</span>
      <span className="text-2xl font-semibold text-text">{value}</span>
      {hasDelta && deltaText && (
        <Badge variant={getDeltaVariant(delta as number)}>
          {deltaText}
        </Badge>
      )}
    </div>
  );
}
