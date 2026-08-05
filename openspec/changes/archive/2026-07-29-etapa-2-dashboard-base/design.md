# Design: Etapa 2 — Dashboard Base with Recharts

## Technical Approach

Read-only presentation layer over the seeded schema. `page.tsx` (Server Component) awaits `searchParams`, reads `?mine`, calls four pure query functions in `src/lib/queries/dashboard.ts` (Supabase client injected), and passes serialized POJOs as props to Client Components. KPI cards render as Tailwind-only Server-safe components; Recharts lives strictly in `"use client"` wrappers that receive already-computed data arrays — no window/SSR risk, no client fetching. Mine filter is URL-driven: `MineSelector` (client) writes `?mine=<uuid>` via `useRouter`/`useSearchParams`, which re-runs Server Component queries. Realizes the proposal's Server→POJO→Client flow with zero API routes.

## Architecture Decisions

| Decision | Choice | Alternatives rejected | Rationale |
|----------|--------|----------------------|-----------|
| Data fetching | Server Component calls pure query fns; POJOs as props | Route Handler + client fetch; Server Actions | No mutations; SC fetch is the App Router default and keeps Supabase server-only |
| Query layer shape | Pure async fns taking `SupabaseClient` param, typed returns | Direct Supabase in component; class/repo | DI makes fns mockable for strict TDD; keeps aggregation testable in isolation |
| Chart isolation | Recharts only inside `"use client"` wrappers | Charts in SC; SSR charts | Recharts needs DOM/window; isolating prevents SSR crash (High risk in proposal) |
| Aggregation site | Compute KPIs/series in TS query layer, not SQL | Postgres views/RPC | No schema changes in scope; keeps logic unit-testable with mocked rows |
| Mine filter transport | URL `?mine=<uuid>` read server-side | React state; cookie | Shareable, SSR-correct, drives SC re-render without client fetch |
| Cost per tonne | `SUM(cost_entries.amount) / SUM(production_runs.tonnage)` | Per-run average | Matches approved metric; guards divide-by-zero → 0 |

## Data Flow

    URL ?mine=<uuid>
        │ (searchParams, awaited)
        ▼
    page.tsx (Server Component) ──calls──▶ dashboard.ts query fns ──▶ Supabase (server client)
        │  serialized POJOs                        ▲
        ▼                                          │ (aggregate in TS)
    ┌───────────────┬───────────────┬──────────────┴────────┐
    KPICard (SC)   MineSelector(C)  CostTrendChart(C)  CostByDriverChart(C)
                        │ writes ?mine via useRouter
                        └────────────▶ URL (loop)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/queries/dashboard.ts` | Create | 4 pure typed query/aggregation fns + return types |
| `src/lib/queries/dashboard.test.ts` | Create | Unit tests, Supabase mocked via `vi.mock` |
| `src/components/dashboard/KPICard.tsx` | Create | Tailwind KPI card (Server-safe, no `"use client"`) |
| `src/components/dashboard/MineSelector.tsx` | Create | `"use client"` — reads/writes `?mine` |
| `src/components/dashboard/CostTrendChart.tsx` | Create | `"use client"` — Recharts `LineChart` |
| `src/components/dashboard/CostByDriverChart.tsx` | Create | `"use client"` — Recharts `BarChart` |
| `src/app/page.tsx` | Modify | Replace placeholder; await searchParams, query, render |
| `messages/es.json` | Modify | Add `dashboard.*` keys |
| `messages/en.json` | Modify | Add matching `dashboard.*` keys (parity enforced by test) |
| `package.json` | Modify | Add `recharts` dependency |

## Interfaces / Contracts

```ts
// src/lib/queries/dashboard.ts
type MineFilter = string | undefined; // uuid or undefined = all mines

interface DashboardKpis { totalTonnage: number; avgCostPerTonne: number; activeMines: number; }
interface CostTrendPoint { period: string; costPerTonne: number; }        // 12 points
interface CostByDriverPoint { driver: "fuel"|"supplies"|"equipment"|"labor"; amount: number; }
interface MineOption { id: string; name: string; }

function getDashboardKpis(db: SupabaseClient, mine: MineFilter): Promise<DashboardKpis>;
function getCostTrend(db: SupabaseClient, mine: MineFilter): Promise<CostTrendPoint[]>;
function getCostByDriver(db: SupabaseClient, mine: MineFilter): Promise<CostByDriverPoint[]>;
function getMineOptions(db: SupabaseClient): Promise<MineOption[]>;
```

Empty/partial data returns safe zeros / empty arrays (never throws); components render empty states. Divide-by-zero → `0`.

`page.tsx` signature (Next 16): `export default async function Home({ searchParams }: { searchParams: Promise<{ mine?: string }> })` — must `await searchParams`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `getDashboardKpis` totals + avg cost/tonne + divide-by-zero → 0 | `vi.mock("@supabase/supabase-js")`; assert POJO |
| Unit | `getCostTrend` returns 12 ordered monthly points | Mock rows; assert length/order/values |
| Unit | `getCostByDriver` groups by 4 drivers, sums amounts | Mock rows; assert grouping |
| Unit | `getMineOptions` maps mines to `{id,name}`; `mine` filter applied in each fn | Assert `.eq('mine_id', ...)` only when mine set |
| Contract | es/en key parity | Existing `src/i18n/messages.test.ts` covers automatically |

Mock contract: `vi.mock("@supabase/supabase-js")` returning a chainable builder stub (`from().select().eq()` resolving `{ data, error }`); tests assert the returned POJO shape and that `eq` is invoked only when a mine filter is present. Tests assert contracts, not implementation.

## i18n Key Schema

Add to both `messages/es.json` and `messages/en.json` (parity mandatory):

```
dashboard.title
dashboard.kpi.totalTonnage
dashboard.kpi.avgCostPerTonne
dashboard.kpi.activeMines
dashboard.chart.costTrend
dashboard.chart.costByDriver
dashboard.filter.allMines
dashboard.filter.label
dashboard.empty
```

## Recharts Integration Pattern

Each chart is a leaf `"use client"` component receiving a pre-computed data array prop only (no Supabase, no async). Wrap in `<ResponsiveContainer>`; the Server Component imports and renders them, passing serialized POJOs — the client boundary keeps Recharts DOM-dependent code out of SSR render. No dynamic import needed since data crosses as plain props.

## URL Param Filter Pattern

`MineSelector` (`"use client"`) uses `useSearchParams()` to read current `mine` and `useRouter().push()` to set `?mine=<uuid>` (or clear for all mines) on change. It only reads/writes the URL — it does not fetch. The Server Component `page.tsx` is the single reader of `searchParams` for querying, so navigation re-runs SC queries server-side. SSR-safe because the selector's initial value derives from the URL, not client-only state.

## Threat Matrix

N/A — no routing (framework file-based only), shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. `?mine` is validated as an optional string passed only to Supabase `.eq()` (parameterized), not to any shell or dynamic route.

## Migration / Rollout

No migration required. Additive change; consumes existing schema/seed read-only. Rollback = delete new files, revert `page.tsx`, remove `dashboard.*` keys, drop `recharts`.

## Open Questions

- None blocking. `?mine` uuid-format validation is defensive-only (bad value yields empty result set, safe).
