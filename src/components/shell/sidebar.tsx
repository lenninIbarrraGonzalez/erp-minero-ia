"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MineOption } from "@/lib/queries/dashboard";
import { MineSelector } from "@/components/mine-selector";

interface SidebarProps {
  mines: MineOption[];
}

export function Sidebar({ mines }: SidebarProps) {
  const t = useTranslations("shell");
  const pathname = usePathname();

  const linkClass = (active: boolean) =>
    `flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
      active
        ? "bg-primary/10 text-primary font-medium"
        : "text-text-muted hover:bg-surface-2"
    }`;

  return (
    <aside
      className="w-[240px] flex-shrink-0 h-screen bg-white border-r border-border flex flex-col sticky top-0"
    >
      <div className="px-4 py-5 border-b border-border">
        <span className="text-base font-semibold text-text">{t("appName")}</span>
      </div>
      <nav className="flex-1 px-2 py-4 flex flex-col gap-1">
        <Link href="/" className={linkClass(pathname === "/")}>
          <GridIcon />
          {t("nav.dashboard")}
        </Link>
        <Link href="/?panel=cost-variance" className={linkClass(false)}>
          <ChartBarIcon />
          {t("nav.costVariance")}
        </Link>
        <Link href="/about" className={linkClass(pathname === "/about")}>
          <InfoIcon />
          {t("nav.about")}
        </Link>
        <div className="px-1 pt-3">
          <MineSelector mines={mines} />
        </div>
      </nav>
    </aside>
  );
}

function GridIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z"
      />
    </svg>
  );
}

function ChartBarIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 19v-6M12 19V5M15 19v-10"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8h.01M12 11v5" />
    </svg>
  );
}
