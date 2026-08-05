# Proposal: Etapa 4 — Text-to-Query

## Intent

Mine operators cannot self-serve ad-hoc questions about production and cost data — they depend on the fixed KPI/chart dashboard or someone who can write SQL. Etapa 4 lets a user type a plain-language question (es/en) into a panel on the dashboard and get back a data table, an auto-selected chart, and a short natural-language insight. It reuses the Etapa 3 LLM chain to translate intent into a safe, structured query over existing tables.

## Scope

### In Scope
- **4a (logic layer)**: Zod intent schema, LLM intent parser, intent→Supabase query builder, chart heuristic, shared types, unit tests. Adds `zod` dependency.
- **4b (route + UI)**: `POST /api/text-query` Route Handler; `QueryPanel` client components (input, results table+chart+insight); dashboard integration; `textQuery.*` i18n keys (es/en).
- Metrics: `cost_per_tonne`, `tonnage`, `cost_by_driver`. Filters: mine name (exact LLM extraction → mine_id), period/date range, driver.

### Out of Scope
- Multi-turn conversation / query history
- Authentication or per-user access control
- Fuzzy/typo-tolerant mine-name matching beyond exact LLM extraction
- Streaming responses
- New DB tables, columns, or migrations
- Cost-variance explainer (Etapa 5)

## Capabilities

### New Capabilities
- `text-query`: natural-language question → validated intent → tabular result + chart type + insight, exposed via a Route Handler and a dashboard panel.

### Modified Capabilities
- `dashboard`: adds a QueryPanel section below the charts grid (UI composition only; existing KPI/chart requirements unchanged).

## Approach

Route Handler + Client Component fetch (mirrors Etapa 3). `POST /api/text-query` receives `{question, mineId?}`, runs the intent parser (LLM chain → JSON → Zod validation), the query builder (intent → chainable Supabase queries), and the chart heuristic, returning `{rows, chartType, insightText}`. The client `QueryPanel` posts via fetch and renders result state. Server-only boundaries (`createLlmChain`, `createSupabaseServerClient`) stay inside the route.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/text-query/*` | New | types, intent-schema (Zod), intent-parser, query-builder, chart-heuristic + tests |
| `src/app/api/text-query/route.ts` | New | POST handler + test |
| `src/components/query-panel/*` | New | query-input, query-results, query-panel + tests |
| `src/app/page.tsx` | Modified | add QueryPanel section below charts |
| `messages/es.json`, `messages/en.json` | Modified | add `textQuery.*` (parity enforced) |
| `package.json` | Modified | add `zod` (with 4a) |

## Delivery

`delivery_strategy=auto-chain`. Two stacked PR slices: **4a** logic layer (~6 files + `zod`), **4b** route + UI (~7 files + dashboard/i18n). Split respects the 400-line budget; 4b targets the 4a branch.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| LLM returns malformed JSON | Med | Explicit JSON-schema prompt; Zod validation; graceful error path returning user-facing failure |
| Date parsing ("marzo", "March 2024") | Med | Constrain intent to ISO date strings; LLM converts; validate range in builder |
| Mine name → UUID resolution | Med | Reuse `fetchMines`; exact match on extracted name; no-match returns clear error |
| `zod` dependency addition | Low | Standard, widely-used; installed with 4a |

## Rollback Plan

Both slices are additive. Revert the 4b PR to remove route + panel (dashboard returns to charts-only). Revert the 4a PR to remove the logic layer and `zod`. No schema or data migrations to unwind.

## Dependencies

- Etapa 3 LLM infrastructure (done): `createLlmChain()`, LLM port.
- Etapa 2 dashboard (done): `src/app/page.tsx`, `fetchMines`.
- Adds `zod` package.

## Success Criteria

- [ ] `POST /api/text-query` returns `{rows, chartType, insightText}` for a valid question
- [ ] Intent parser validates LLM output against Zod schema; malformed output fails gracefully
- [ ] Query builder resolves mine name, period range, and metric into correct Supabase queries
- [ ] Chart heuristic returns `line | bar | none` per metric
- [ ] QueryPanel renders on the dashboard below charts; es/en keys in parity
- [ ] All new unit/integration/component tests pass under `pnpm test`
