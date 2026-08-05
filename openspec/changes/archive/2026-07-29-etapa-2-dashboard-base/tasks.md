# Tasks: Etapa 2 — Dashboard Base with Recharts

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 550–700 (additions + deletions) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (foundation + queries) → PR 2 (components + page) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | recharts dep + i18n keys + RED+GREEN query layer | PR 1 | `pnpm test src/lib/queries/dashboard.test.ts` | N/A — server-side pure fns, no browser route | Delete `src/lib/queries/dashboard.ts`, `dashboard.test.ts`; revert `messages/*.json`; remove recharts from `package.json` |
| 2 | All 4 components + transformed page.tsx | PR 2 | `pnpm test && pnpm exec tsc --noEmit` | `pnpm dev` → open `http://localhost:3000` and verify dashboard renders | Delete `src/components/dashboard/`; revert `src/app/page.tsx` to placeholder |

---

## Phase 1: Foundation

- [x] 1.1 Run `pnpm add recharts` and verify `package.json` + `pnpm-lock.yaml` updated. Spec: recharts dep required by CostTrendChart and CostBreakdownChart.
- [x] 1.2 Add `dashboard.*` keys to `messages/es.json`: `dashboard.title`, `dashboard.kpi.totalTonnage`, `dashboard.kpi.avgCostPerTonne`, `dashboard.kpi.activeMines`, `dashboard.chart.costTrend`, `dashboard.chart.costByDriver`, `dashboard.filter.allMines`, `dashboard.filter.label`, `dashboard.empty`. Spec: i18n Coverage — all keys in both catalogs.
- [x] 1.3 Add identical `dashboard.*` keys to `messages/en.json` (same key set, English values). Spec: i18n Coverage parity enforced by `src/i18n/messages.test.ts`.
- [x] 1.4 Run `pnpm test src/i18n/messages.test.ts` — must be GREEN before proceeding. Confirms key parity enforced.

## Phase 2: RED Tests — Query Layer

- [x] 2.1 Create `src/lib/queries/dashboard.test.ts`. Add chainable `.from().select().eq()` stub resolving `{ data, error }`. No real DB calls — Spec: TDD unit tests, Supabase mocked.
- [x] 2.2 Write RED test: `fetchMines()` returns `MineOption[]` with at least one entry when mock returns rows; returns `[]` without throwing when mock returns zero rows. Spec scenarios: "fetchMines returns list", "fetchMines returns empty array".
- [x] 2.3 Write RED test: `fetchKpiSummary(mineId)` returns `{ totalTonnage, costPerTonne, mineName }` with `costPerTonne = SUM(amount)/tonnage`; `mineName` is `null` when no filter; divide-by-zero → 0. Spec scenarios: "fetchKpiSummary with mine filter", "fetchKpiSummary without mine filter".
- [x] 2.4 Write RED test: `fetchCostTrend(mineId)` returns 12 `{ period, costPerTonne }` objects in chronological order; returns `[]` for mine with no entries. Spec scenarios: "fetchCostTrend returns 12 data points", "fetchCostTrend empty mine".
- [x] 2.5 Write RED test: `fetchCostByDriver(mineId?)` returns `{ driver, totalCost }[]` with one entry per distinct driver; filtered when `mineId` provided; `.eq('mine_id', mineId)` is called only when filter present. Spec scenario: "fetchCostByDriver returns driver breakdown".
- [x] 2.6 Run `pnpm test src/lib/queries/dashboard.test.ts` — all 5+ tests MUST be RED (failing, not erroring). Commit as RED checkpoint.

## Phase 3: GREEN — Query Layer Implementation

- [x] 3.1 Create `src/lib/queries/dashboard.ts`. Export types: `MineOption`, `DashboardKpis`, `CostTrendPoint`, `CostByDriverPoint`. Spec: typed POJOs, `MineFilter = string | undefined`.
- [x] 3.2 Implement `fetchMines(db: SupabaseClient): Promise<MineOption[]>` — query `mines` table, return `{ id, name }[]`, return `[]` on error. Spec: fetchMines scenarios.
- [x] 3.3 Implement `fetchKpiSummary(db, mine?): Promise<DashboardKpis>` — aggregate `SUM(cost_entries.amount) / SUM(production_runs.tonnage)`, divide-by-zero → 0, `mineName: null` when no filter. Spec: fetchKpiSummary scenarios.
- [x] 3.4 Implement `fetchCostTrend(db, mine?): Promise<CostTrendPoint[]>` — group by month ascending, 12 points, return `[]` on empty. Spec: fetchCostTrend scenarios.
- [x] 3.5 Implement `fetchCostByDriver(db, mine?): Promise<CostByDriverPoint[]>` — group by driver, sum amounts, apply `.eq('mine_id', mine)` only when `mine` defined. Spec: fetchCostByDriver scenario.
- [x] 3.6 Run `pnpm test src/lib/queries/dashboard.test.ts` — all tests MUST be GREEN. Commit GREEN + implementation together. Spec: "All four functions have passing unit tests".

## Phase 4: UI Components

- [x] 4.1 Create `src/components/kpi-card.tsx` — Server-safe (no `"use client"`), Tailwind only. Props: `label: string`, `value: string`, `delta?: number`. Spec: KPI Cards — Tailwind, no Recharts.
- [x] 4.2 Create `src/components/mine-selector.tsx` — `"use client"`. Uses `useRouter().push()` to write/clear `?mine=<uuid>`. Options: "All mines" + mines list. Spec scenarios: "Selector populates mine list", "Selecting a mine updates URL", "Selecting All mines clears URL param", "Selector reflects current URL on mount".
- [x] 4.3 Create `src/components/charts/cost-trend-chart.tsx` — `"use client"`. Props: `data: CostTrendPoint[]`. Renders Recharts `LineChart` inside `ResponsiveContainer`. Empty state message when `data.length === 0`. No Supabase calls. Spec scenarios: "Trend chart renders 12-month series", "Trend chart renders empty state". Req: Recharts `"use client"` only.
- [x] 4.4 Create `src/components/charts/cost-breakdown-chart.tsx` — `"use client"`. Props: `data: CostByDriverPoint[]`. Renders Recharts `BarChart` inside `ResponsiveContainer`. Empty state when `data.length === 0`. Spec scenarios: "Breakdown chart renders one bar per driver", "Breakdown chart renders empty state".

## Phase 5: Server Component Integration

- [x] 5.1 Modify `src/app/page.tsx` — transform to Server Component. Signature: `async function Home({ searchParams }: { searchParams: Promise<{ mine?: string }> })` — `await searchParams` (Next.js 16 requirement). Call `fetchMines`, `fetchKpiSummary`, `fetchCostTrend`, `fetchCostByDriver` with `createSupabaseServerClient()`. Pass POJOs as props to Client Components. No Supabase refs in client tree. Spec: Server Component Data Flow — "Page passes serialized data to charts", "Invalid mine UUID in URL".
- [x] 5.2 Run `pnpm exec tsc --noEmit` — zero type errors in PR2 components. (Pre-existing type errors in dashboard.ts from PR1 noted.)

## Phase 6: Verification

- [x] 6.1 Run `pnpm test` — 66/66 tests GREEN (48 baseline + 18 new). Zero skipped assertions.
- [x] 6.2 Run `pnpm lint` — zero ESLint errors (1 pre-existing warning in dashboard.test.ts from PR1).
- [x] 6.3 Run `pnpm exec tsc --noEmit` — zero TypeScript errors in PR2 components. Pre-existing errors in dashboard.ts from PR1 are out of scope.
- [ ] 6.4 Manual smoke: `pnpm dev` → `http://localhost:3000` — 3 KPI cards render, 2 Recharts charts render, mine selector populated. `?mine=<uuid>` filters all widgets server-side. `?mine=not-valid-uuid` returns empty/zero state without 500.
- [ ] 6.5 Verify i18n: switch locale to `en`, confirm all dashboard labels resolve to non-empty translated strings. Spec: "KPI labels resolve in both locales".
