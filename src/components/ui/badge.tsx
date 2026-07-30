import type { HTMLAttributes } from "react";

export type BadgeVariant = "positive" | "negative" | "neutral";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant: BadgeVariant;
  className?: string;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  positive: "bg-[#E6F4EF] text-positive",
  negative: "bg-[#FDECEA] text-negative",
  neutral: "bg-surface-2 text-text-muted",
};

const BASE_CLASSES = "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium";

export function Badge({ variant, className, children, ...rest }: BadgeProps) {
  const classes = [BASE_CLASSES, VARIANT_CLASSES[variant], className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}
