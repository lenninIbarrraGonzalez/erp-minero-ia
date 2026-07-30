import type { HTMLAttributes } from "react";

type CardElement = "div" | "section" | "article";

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: CardElement;
  className?: string;
}

const BASE_CLASSES = "bg-surface shadow-sm border border-border rounded";

export function Card({ as: Tag = "div", className, children, ...rest }: CardProps) {
  const classes = [BASE_CLASSES, className].filter(Boolean).join(" ");
  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}
