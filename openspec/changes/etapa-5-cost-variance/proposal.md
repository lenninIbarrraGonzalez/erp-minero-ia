# Proposal: Cost Variance Explainer (Etapa 5)

## Intent

Operators can see costs on the dashboard but cannot explain *why* costs moved month over month. When fuel spikes or a stoppage hits tonnage, the cost/tonne shifts with no visible cause. This change decomposes the month-over-month cost delta by driver (deterministic math) and adds a short LLM-narrated explanation, so a user picks a mine + month and immediately understands what drove the change.

## Scope

### In Scope
- Deterministic period-over-period (month N vs N-1) cost delta decomposition by the 4 fixed drivers.
- Server-side query layer aggregating `cost_entries` by driver for two adjacent periods.
- LLM-narrated summary sentence with graceful degradation (reuse Etapa 4 insight pattern).
- `POST /api/cost-variance` route: body `{ mineId: string; period: { year; month } }`.
- Client panel (input/results) reusing query-panel component structure.
- i18n keys (`costVariance.*`) with es/en parity enforced by messages test.
- Unit + route integration tests (Supabase + LLM mocked), Strict TDD.

### Out of Scope
- Plan-vs-actual / budget variance (no budget column exists).
- Multi-month or cumulative trend variance (single N vs N-1 only).
- Cross-mine comparison in one call.
- Streaming or multi-turn narration.
- New DB migrations or schema changes.

## Capabilities

### New Capabilities
- `cost-variance`: month-over-month cost delta decomposition by driver plus LLM narration, exposed via route + client panel.

### Modified Capabilities
- None. (Reuses `llm-provider`, `text-query` patterns without changing their requirements.)

## Approach

Deterministic core first: fetch `SUM(amount)` grouped by driver for period N and N-1 for one mine; compute per-driver delta and percent contribution to total delta; always emit exactly 4 driver rows (zero-fill missing). Then pass the structured breakdown to the LLM chain for a one-sentence narration, degrading to empty string on failure. Route validates `mineId` + period, returns `{ breakdown, totalDelta, narration }`. Client panel mirrors `query-panel` composition. `mineId` is consumed end-to-end (fixes Etapa 4 W2 warning) — no injection without use.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/cost-variance/decompose.ts` | New | Deterministic delta-by-driver math |
| `src/lib/cost-variance/variance-query.ts` | New | Supabase two-period aggregation |
| `src/lib/cost-variance/narrator.ts` | New | LLM narration + degradation |
| `src/app/api/cost-variance/route.ts` | New | Route handler + validation |
| `src/components/variance-panel/` | New | Client input/results panel |
| `messages/{es,en}.json` | Modified | `costVariance.*` keys |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Month N-1 missing (first month) | Med | Return 422 `no_prior_period`; test covers it |
| Percent share divide-by-zero (delta=0) | Med | Guard: report absolute deltas, 0% share |
| Next.js 16 route API drift | Med | Read `node_modules/next/dist/docs/` before coding |
| mineId injected but unused | Low | Route consumes it in query; asserted in test |

## Rollback Plan

Delete `src/lib/cost-variance/`, `src/app/api/cost-variance/`, `src/components/variance-panel/`, and remove `costVariance.*` keys. No schema/migration changes, so rollback is file-deletion only; dashboard and text-query are untouched.

## Dependencies

- Etapa 3 `src/lib/llm/` chain (narration).
- Etapa 4 query-panel + insight-generator patterns (reuse).
- Seeded `cost_entries` with driver enum + injected anomalies (test fixtures).

## Success Criteria

- [ ] Selecting a mine + month returns 4 driver-delta rows summing to totalDelta.
- [ ] Injected fuel shock (Cerro Rojo/Loma Grande, month 8) surfaces fuel as top driver.
- [ ] Narration degrades to `""` on LLM failure; breakdown still returned.
- [ ] First-month request returns 422 `no_prior_period`.
- [ ] es/en key parity test passes; all cost-variance unit + route tests green.

## Proposal question round

Execution mode is `auto` (non-interactive), so these assumptions were made without user confirmation. Flag any to correct before spec/design:
- **Variance basis**: month N vs N-1 only (per Key Constraint 1). No cumulative/YTD variance.
- **First-month behavior**: 422 `no_prior_period` rather than comparing against zero.
- **Driver rows**: always 4, zero-filled — never collapse absent drivers.
- **UI placement**: standalone `variance-panel`, not merged into existing query-panel.
- **Input**: explicit mine + month pickers (not free-text NL parsing like text-query).
