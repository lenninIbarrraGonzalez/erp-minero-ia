interface KpiCardProps {
  label: string;
  value: string;
  delta?: number;
}

export function KpiCard({ label, value, delta }: KpiCardProps) {
  const hasDelta = delta !== undefined;
  const isPositive = hasDelta && delta > 0;
  const isNegative = hasDelta && delta < 0;

  const deltaText = hasDelta
    ? `${isPositive ? "+" : ""}${delta}%`
    : null;

  return (
    <div
      className="bg-surface border border-border p-4 flex flex-col gap-1"
      style={{ borderRadius: "var(--radius)" }}
    >
      <span className="text-sm text-text-muted">{label}</span>
      <span className="text-2xl font-semibold text-text">{value}</span>
      {hasDelta && deltaText && (
        <span
          className={
            isPositive
              ? "text-sm text-positive"
              : isNegative
                ? "text-sm text-negative"
                : "text-sm text-text-muted"
          }
        >
          {deltaText}
        </span>
      )}
    </div>
  );
}
