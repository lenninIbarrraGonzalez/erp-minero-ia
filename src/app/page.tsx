import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchMines,
  fetchKpiSummary,
  fetchCostTrend,
  fetchCostByDriver,
} from "@/lib/queries/dashboard";
import { KpiCard } from "@/components/kpi-card";
import { MineSelector } from "@/components/mine-selector";
import { CostTrendChart } from "@/components/charts/cost-trend-chart";
import { CostBreakdownChart } from "@/components/charts/cost-breakdown-chart";
import { QueryPanel } from "@/components/query-panel/query-panel";

interface HomeProps {
  searchParams: Promise<{ mine?: string }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const { mine: mineId } = await searchParams;
  const db = createSupabaseServerClient();
  const t = await getTranslations("dashboard");

  const [mines, kpis, trendData, breakdownData] = await Promise.all([
    fetchMines(db),
    fetchKpiSummary(db, mineId),
    fetchCostTrend(db, mineId),
    fetchCostByDriver(db, mineId),
  ]);

  return (
    <main className="flex flex-col gap-6 p-6 bg-bg min-h-full">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text">{t("title")}</h1>
        <MineSelector mines={mines} selectedId={mineId} />
      </header>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label={t("kpi.totalTonnage")}
          value={kpis.totalTonnage.toLocaleString("en-US", {
            maximumFractionDigits: 0,
          })}
        />
        <KpiCard
          label={t("kpi.avgCostPerTonne")}
          value={`$${kpis.costPerTonne.toLocaleString("en-US", { maximumFractionDigits: 2 })}`}
        />
        <KpiCard
          label={t("kpi.activeMines")}
          value={kpis.mineName ?? t("filter.allMines")}
        />
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface border border-border p-4 rounded-[var(--radius)]">
          <h2 className="text-sm font-medium text-text-muted mb-3">
            {t("chart.costTrend")}
          </h2>
          <CostTrendChart data={trendData} />
        </div>
        <div className="bg-surface border border-border p-4 rounded-[var(--radius)]">
          <h2 className="text-sm font-medium text-text-muted mb-3">
            {t("chart.costByDriver")}
          </h2>
          <CostBreakdownChart data={breakdownData} />
        </div>
      </section>

      {/* Text-to-Query Panel */}
      <section className="bg-surface border border-border p-4 rounded-[var(--radius)]">
        <QueryPanel />
      </section>
    </main>
  );
}
