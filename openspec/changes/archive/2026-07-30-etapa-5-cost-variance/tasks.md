# Tasks: Cost Variance Explainer (Etapa 5)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines (PR 5a) | ~270 lines |
| Estimated changed lines (PR 5b) | ~260 lines |
| Estimated changed lines (combined) | ~530 lines |
| 800-line budget risk | Low (per-PR ~270 each, well under 400) |
| Chained PRs recommended | Yes |
| Suggested split | PR 5a (domain + route) → PR 5b (client + integration) |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Domain types + calculator + narrator + API route | PR 5a | `pnpm test src/lib/cost-variance src/app/api/cost-variance` | `curl -X POST /api/cost-variance` with valid body | Delete `src/lib/cost-variance/` and `src/app/api/cost-variance/` |
| 2 | Client panel + i18n + dashboard integration | PR 5b | `pnpm test src/components/cost-variance-panel` | Open dashboard, select mine+month, submit | Delete `src/components/cost-variance-panel/`; revert `page.tsx` and `messages/*.json` |

Feature Branch Chain: PR 5a base = feature/etapa-5-cost-variance; PR 5b base = PR 5a branch. Retarget/rebase until child diff is clean (shows only 5b files).

---

## Wire Format Resolution

`period` and `comparisonPeriod` are ISO date strings `"YYYY-MM-01"` on the wire. The client sends `"YYYY-MM"` from `<input type="month">` and appends `"-01"` before `fetch`. The route accepts `{ mineId: string (UUID), period: string (ISO date "YYYY-MM-01"), comparisonPeriod?: string }`. The design's `{year, month}` object is superseded.

---

## Phase 1 — Foundation (PR 5a)

- [x] 1.1 **[RED]** Create `src/lib/cost-variance/types.test.ts`: failing tests for `DriverDelta` Zod schema — valid delta, prior=0 → deltaPct null, invalid driver enum rejected.
- [x] 1.2 **[RED]** Extend `types.test.ts`: failing tests for `CostVarianceResult` Zod schema — 4 drivers always present, totalDeltaPct null when totalPrior=0.
- [x] 1.3 **[GREEN]** Create `src/lib/cost-variance/types.ts`: export `DRIVERS` const, `DriverDelta` Zod schema + TS type, `CostVarianceResult` Zod schema + TS type, error code literals. Tests must turn green.

## Phase 2 — Core Logic (PR 5a)

- [x] 2.1 **[RED]** Create `src/lib/cost-variance/variance-calculator.test.ts`: failing tests for `computeVariance` — 4 rows always returned; sums match totalCurrent/totalPrior/totalDelta; zero-fill missing driver; prior=0 → deltaPct null; empty prior select → throws `no_prior_period`; fuel spike → largest absolute delta.
- [x] 2.2 **[GREEN]** Create `src/lib/cost-variance/variance-calculator.ts`: `computeVariance(db, mineId, isoPeriod, isoPrior)` — two `.eq` selects, in-memory `Map` aggregation, zero-fill all 4 DRIVERS, delta math, `deltaPct` null guard, `totalDeltaPct` null guard. Returns `CostVarianceResult` with `narrative: ""`. Tests must turn green.
- [x] 2.3 **[RED]** Create `src/lib/cost-variance/variance-narrator.test.ts`: failing tests — success path returns trimmed LLM string; thrown LLM → returns `""` without throwing.
- [x] 2.4 **[GREEN]** Create `src/lib/cost-variance/variance-narrator.ts`: `narrateVariance(result, llm)` — builds analyst prompt with JSON breakdown, calls `llm.complete(prompt, { maxTokens: 150, temperature: 0.3 })`, try/catch → `""`. Tests must turn green.

## Phase 3 — API Route (PR 5a)

- [x] 3.1 **[RED]** Create `src/app/api/cost-variance/route.test.ts`: failing tests — HTTP 200 with valid `CostVarianceResult` shape; mineId reaches `.eq("mine_id")` (assert on mock); missing `comparisonPeriod` defaults to prior month; Zod 422 `invalid_input`; unknown mine 422 `mine_not_found`; no entries for comparisonPeriod → 422 `no_prior_period`; LLM throws → 200 with `narrative: ""`.
- [x] 3.2 **[GREEN]** Create `src/app/api/cost-variance/route.ts`: `import "server-only"`; POST handler; Zod validate `{ mineId: uuid, period: string (YYYY-MM-01), comparisonPeriod?: string }`; derive default prior month (`new Date(period)` subtract 1 month → first-of-month ISO); mine existence check; call `computeVariance`; call `narrateVariance`; return `NextResponse.json`. Tests must turn green.

---

## Phase 4 — Client Components (PR 5b)

- [x] 4.1 Create `src/components/cost-variance-panel/cost-variance-input.tsx`: `"use client"` sub-component; `<select>` for mine (populated from `mines` prop); `<input type="month">` for period; submit button disabled when `isPending`; on submit appends `"-01"` to month value to build ISO date.
- [x] 4.2 Create `src/components/cost-variance-panel/cost-variance-results.tsx`: driver table (4 rows: driver | prior | current | delta | delta%); `deltaPct null` renders `—`; `BarChart` with all 4 drivers grouped; narrative `<p>`.
- [x] 4.3 **[RED]** Create `src/components/cost-variance-panel/cost-variance-panel.test.tsx`: failing tests — loading indicator visible and submit disabled during fetch; driver table + narrative visible after 200 response; error message uses `costVariance.error` key on non-200; `costVariance.noPriorPeriod` displayed when API returns `{ code: "no_prior_period" }`; mines prop populates `<select>` options. (RTL + happy-dom, mocked `fetch`.)
- [x] 4.4 **[GREEN]** Create `src/components/cost-variance-panel/cost-variance-panel.tsx`: `"use client"`; `useState` (result, error, errorCode) + `useTransition` (isPending); submit handler calls `fetch("/api/cost-variance", { method: "POST", body: JSON.stringify({ mineId, period }) })`; renders `<CostVarianceInput>` + conditional `<CostVarianceResults>` / loading / error states. Tests must turn green.

## Phase 5 — i18n and Dashboard Integration (PR 5b)

- [x] 5.1 Add `costVariance.*` keys to `messages/es.json` (13 keys: `title`, `selectMine`, `selectPeriod`, `submit`, `loading`, `error`, `driver`, `prior`, `current`, `delta`, `deltaPct`, `narrative`, `noPriorPeriod`). Non-empty Spanish strings.
- [x] 5.2 Add matching `costVariance.*` keys to `messages/en.json` (same 13 keys). Non-empty English strings.
- [x] 5.3 Verify existing messages parity test passes: `pnpm test` — all 13 `costVariance.*` keys present in both locales with non-empty values.
- [x] 5.4 Modify `src/app/page.tsx`: mount `<CostVariancePanel mines={mines} />`; confirm `fetchMines` result is already available as `mines` prop/variable (no duplicate fetch). Keep existing `QueryPanel`.

---

## Notes

- TDD contract: every GREEN task must follow its RED task. Never skip the failing-test phase.
- `computeVariance` signature uses ISO date strings only — no `{year, month}` objects anywhere.
- All domain files (`types.ts`, `variance-calculator.ts`, `variance-narrator.ts`) are pure TS with zero framework imports.
- Route test mocks via `vi.mock` for calculator, narrator, and Supabase client.
- Component tests use RTL + `happy-dom` + `vi.fn()` for `fetch`.
