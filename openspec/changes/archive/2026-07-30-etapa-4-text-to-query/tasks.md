# Tasks: etapa-4-text-to-query

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines (PR 4a) | ~350–400 lines |
| Estimated changed lines (PR 4b) | ~350–400 lines |
| 800-line budget risk (combined) | Medium — each PR individually within 400-line budget |
| Chained PRs recommended | Yes |
| Suggested split | PR 4a (logic layer) → PR 4b (route + UI, stacked on 4a) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 4a | Logic layer: types, schemas, parsers, builders, i18n | PR 4a → main | `pnpm test src/lib/text-query/` | N/A — no route yet; pure unit tests | Remove `src/lib/text-query/`, revert `package.json` and `messages/*.json` |
| 4b | Route handler + UI components + dashboard integration | PR 4b → stacked on 4a | `pnpm test src/app/api/text-query/ src/components/query-panel/` | POST `http://localhost:3000/api/text-query` with `{question, mineId}` | Remove `src/app/api/text-query/`, `src/components/query-panel/`, revert `page.tsx` |

---

## PR 4a — Logic Layer

### Phase 1: Foundation — Types and Dependencies

- [x] 1.1 [4a / N/A] Add `zod` to `package.json` dependencies (`pnpm add zod`)
- [x] 1.2 [4a / N/A] Create `src/lib/text-query/types.ts` — export `ChartType`, `Metric`, `ParsedIntent`, `QueryResult`, `TextQueryResponse`, `ParseFailureError`
- [x] 1.3 [4a / N/A] Create `src/lib/text-query/intent-schema.ts` — export Zod `ParsedIntentSchema` (metric union literal, optional mineName/period/groupBy/driver)

### Phase 2: Intent Parser — RED then GREEN

- [x] 2.1 [4a / RED] Create `src/lib/text-query/intent-parser.test.ts` — failing tests: valid LLM JSON → ParsedIntent; Zod mismatch → ParseFailureError; LLM error → re-throws; unsupported metric → ParseFailureError. Use `vi.mock` for LLM chain.
- [x] 2.2 [4a / GREEN] Create `src/lib/text-query/intent-parser.ts` — server-only, calls `createLlmChain`, parses JSON response, validates with `ParsedIntentSchema`, throws `ParseFailureError` on Zod/JSON failure, re-throws `LLMProviderError`.

### Phase 3: Query Builder — RED then GREEN

- [x] 3.1 [4a / RED] Create `src/lib/text-query/query-builder.test.ts` — failing tests: cost_per_tonne aggregation (SUM amount / SUM tonnage per period); tonnage aggregation; cost_by_driver grouping; mine-not-found → 422 error; empty rows → empty array. Mock chainable Supabase client.
- [x] 3.2 [4a / GREEN] Create `src/lib/text-query/query-builder.ts` — three per-metric static functions, in-memory aggregation via Map (mirrors `fetchCostTrend`), uses `createSupabaseServerClient`, returns `{ rows, chartType }`.

### Phase 4: Chart Heuristic — RED then GREEN

- [x] 4.1 [4a / RED] Create `src/lib/text-query/chart-heuristic.test.ts` — failing tests for all 5 deterministic branches: cost_per_tonne+temporal→line; tonnage+temporal→line; cost_by_driver→bar; no-temporal→bar; empty rows→none.
- [x] 4.2 [4a / GREEN] Create `src/lib/text-query/chart-heuristic.ts` — pure function `inferChartType(intent, rows): ChartType`, 4-row lookup table, no external deps.

### Phase 5: Insight Generator — RED then GREEN

- [x] 5.1 [4a / RED] Create `src/lib/text-query/insight-generator.test.ts` — failing tests: happy path → single-sentence string; LLM failure → returns `""` (non-fatal). Mock `createLlmChain`.
- [x] 5.2 [4a / GREEN] Create `src/lib/text-query/insight-generator.ts` — server-only, second `createLlmChain()` call post-query, wraps in try/catch, returns `""` on any error.

### Phase 6: i18n Keys (additive)

- [x] 6.1 [4a / N/A] Add `textQuery.*` keys to `messages/es.json` — keys: `placeholder`, `submit`, `loading`, `emptyState`, `error.parseFailure`, `error.unsupportedMetric`, `error.mineNotFound`, `error.llmUnavailable`, `insight`
- [x] 6.2 [4a / N/A] Add matching `textQuery.*` keys to `messages/en.json` (exact key parity with es.json)
- [x] 6.3 [4a / RED] Create `src/lib/text-query/messages.test.ts` — failing test: es.json and en.json have identical `textQuery.*` key sets (parity enforced)
- [x] 6.4 [4a / GREEN] Verify parity test passes after 6.1 + 6.2 complete

---

## PR 4b — Route + UI (stacked on 4a)

### Phase 7: Route Handler — RED then GREEN

- [x] 7.1 [4b / RED] Create `src/app/api/text-query/route.test.ts` — failing integration tests: valid question+mineId → 200 `{rows, chartType, insightText}`; Zod parse failure → 422 `unparseableIntent`; unsupported metric → 422 `unsupported_metric`; mine not found → 422 `mine_not_found`; LLMProviderError → 500 `llmUnavailable`; missing question body → 400 `invalidQuestion`. Mock `intent-parser`, `query-builder`, `insight-generator` modules.
- [x] 7.2 [4b / GREEN] Create `src/app/api/text-query/route.ts` — `export async function POST(req)`: parse body, call intent-parser, call query-builder (with `mineId` bypass for mine name resolution), call chart-heuristic, call insight-generator, return `TextQueryResponse`. Server-only imports only.

### Phase 8: UI Components — RED then GREEN

- [x] 8.1 [4b / N/A] Create `src/components/query-panel/query-input.tsx` — controlled text input + submit button; `disabled` during loading; uses `textQuery.placeholder` and `textQuery.submit` i18n keys; accepts `onSubmit(question: string)` and `isLoading: boolean` props.
- [x] 8.2 [4b / N/A] Create `src/components/query-panel/query-results.tsx` — renders data table of rows; conditional Recharts `LineChart` or `BarChart` based on `chartType`; `insightText` sentence; empty state via `textQuery.emptyState`; error display via `textQuery.error.*` keys; `chartType='none'` suppresses chart.
- [x] 8.3 [4b / RED] Create `src/components/query-panel/query-panel.test.tsx` — failing tests: renders input; submit triggers fetch to `/api/text-query`; loading state disables button; success renders result table and chart; error renders `textQuery.error.*` message; empty result renders `textQuery.emptyState`. Mock `fetch`.
- [x] 8.4 [4b / GREEN] Create `src/components/query-panel/query-panel.tsx` — Client Component using `useState` + `useTransition`; composes `<QueryInput>` + `<QueryResults>`; `fetch('/api/text-query', {method:'POST', body:JSON.stringify({question, mineId})})`.

### Phase 9: Dashboard Integration

- [x] 9.1 [4b / N/A] Modify `src/app/page.tsx` — add `<QueryPanel />` in a new `<section>` below the charts grid section; no Server Component props flow into QueryPanel for query data; import from `src/components/query-panel/query-panel`.

### Phase 10: Verification

- [x] 10.1 [4b / N/A] Run full test suite: `pnpm test` — all 22 spec scenarios + 10 dashboard delta scenarios green
- [x] 10.2 [4b / N/A] Type-check: `pnpm exec tsc --noEmit` — zero errors
- [x] 10.3 [4b / N/A] Lint: `pnpm lint` — zero warnings on new files
