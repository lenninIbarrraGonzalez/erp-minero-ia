# Proposal: Etapa 2 — Dashboard Base with Recharts

## Intent

Etapa 1 delivered a 7-table Postgres schema and a deterministic 12-month seed, but the app has no UI over that data — only a placeholder home page and `/api/health`. This change adds the missing read-only presentation layer: a KPI dashboard that surfaces the seeded production and cost data (including the 3 embedded variance stories) so the portfolio demo shows something meaningful. No AI/LLM in this etapa.

## Scope

### In Scope
- 3 KPI cards (Tailwind, no Recharts): total tonnage, avg cost/tonne, active mines.
- 2 Recharts charts: cost/tonne trend (line) over 12 months, cost breakdown by driver (bar).
- Mine filter via URL search param (`?mine=<uuid>`) driving Server Component queries.
- Typed, pure query/computation layer in `src/lib/queries/dashboard.ts` (POJOs).
- Strict TDD unit tests (RED→GREEN) for query/computation layer with Supabase mocked.
- i18n keys (es/en) for all dashboard strings.
- Add `recharts` dependency.

### Out of Scope
- Any AI/LLM feature (text-to-query, cost-variance explainer) — later etapa.
- API routes / Route Handlers — Server Components query Supabase directly.
- Auth, roles, multi-tenant.
- Client-side data fetching, mutations, DB schema/seed changes.
- Date-range filtering (only the mine filter this slice).

## Capabilities

### New Capabilities
- `dashboard`: read-only KPI dashboard (cards + Recharts trend/breakdown) with URL-param mine filter, backed by a pure typed query layer over the seeded data.

### Modified Capabilities
- None. `db-schema` and `seed-data` are consumed read-only; no requirement changes.

## Approach

Server Components in `src/app/` call the pure query functions in `src/lib/queries/dashboard.ts` (which use `createSupabaseServerClient()`), compute KPI/aggregate POJOs, and pass serialized data as props to Client Components. Recharts charts are isolated in `"use client"` components (Recharts is client-only — no SSR). The mine filter reads the `?mine=<uuid>` search param on the server; changing it re-runs Server Component queries — no client fetching. Query functions are pure and Supabase-mockable for TDD.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/queries/dashboard.ts` | New | Typed pure query/aggregation POJOs (KPIs, trend, breakdown, mine list). |
| `src/lib/queries/dashboard.test.ts` | New | Unit tests, Supabase mocked (RED→GREEN). |
| `src/components/` | New | KPI cards (Tailwind), chart wrappers (`"use client"`), mine selector. |
| `src/app/page.tsx` | Modified | Replace placeholder with dashboard; read `?mine` param, query, render. |
| `messages/es.json`, `messages/en.json` | Modified | Dashboard i18n keys. |
| `package.json` | Modified | Add `recharts`. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Recharts SSR crash (no `window`) | High | Charts strictly in `"use client"` components; only serialized data crosses the boundary. |
| Supabase env vars differ test vs prod | Med | Query layer pure + Supabase mocked in tests; runtime reads env via existing server client. |
| Empty/partial data for a filtered mine | Med | Query layer returns safe empty POJOs; components render empty states. |

## Rollback Plan

Additive change. To revert: delete `src/lib/queries/`, delete new files under `src/components/`, revert `src/app/page.tsx` to the placeholder, remove dashboard i18n keys, and drop `recharts` from `package.json`. No DB or schema impact.

## Dependencies

- `recharts` (npm) — line/bar charts only.
- Existing: seeded Supabase data (Etapa 1), `createSupabaseServerClient()`, design tokens in `globals.css`, next-intl catalogs.

## Success Criteria

- [ ] `pnpm test` passes (existing 39 + new query/computation tests).
- [ ] `pnpm exec tsc --noEmit` clean (strict).
- [ ] Dashboard renders 3 KPI cards + 2 charts + mine selector.
- [ ] `?mine=<uuid>` filters KPIs and charts server-side; clearing it shows all mines.
- [ ] All dashboard strings resolve via es/en i18n keys.
