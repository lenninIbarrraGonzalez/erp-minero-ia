"use client";

import type { MineOption } from "@/lib/queries/dashboard";
import { MineSelector } from "@/components/mine-selector";

interface SidebarProps {
  mines: MineOption[];
}

export function Sidebar({ mines }: SidebarProps) {
  return (
    <aside
      className="w-[240px] flex-shrink-0 h-screen bg-white border-r border-border flex flex-col sticky top-0"
    >
      <div className="px-4 py-5 border-b border-border">
        <span className="text-base font-semibold text-text">ERP Minero</span>
      </div>
      <nav className="flex-1 px-2 py-4 flex flex-col gap-1">
        <a
          href="/"
          className="flex items-center gap-2 px-3 py-2 rounded text-sm text-text-muted hover:bg-surface-2"
        >
          <GridIcon />
          Dashboard
        </a>
        <a
          href="/?panel=cost-variance"
          className="flex items-center gap-2 px-3 py-2 rounded text-sm text-text-muted hover:bg-surface-2"
        >
          <ChartBarIcon />
          Cost Variance
        </a>
      </nav>
      <div className="px-4 py-4 border-t border-border">
        <MineSelector mines={mines} />
      </div>
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
