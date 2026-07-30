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
import { CostVariancePanel } from "@/components/cost-variance-panel/cost-variance-panel";
import { Card } from "@/components/ui/card";

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
        <Card className="p-4">
          <h2 className="text-sm font-medium text-text-muted mb-3">
            {t("chart.costTrend")}
          </h2>
          <CostTrendChart data={trendData} />
        </Card>
        <Card className="p-4">
          <h2 className="text-sm font-medium text-text-muted mb-3">
            {t("chart.costByDriver")}
          </h2>
          <CostBreakdownChart data={breakdownData} />
        </Card>
      </section>

      {/* Text-to-Query Panel */}
      <section>
        <Card className="p-4">
          <QueryPanel />
        </Card>
      </section>

      {/* Cost Variance Explainer */}
      <section>
        <Card className="p-4">
          <CostVariancePanel mines={mines} />
        </Card>
      </section>

      {/* Mine Selector — visible on mobile when sidebar is hidden */}
      <div className="sr-only">
        <MineSelector mines={mines} selectedId={mineId} />
      </div>
    </main>
  );
}
