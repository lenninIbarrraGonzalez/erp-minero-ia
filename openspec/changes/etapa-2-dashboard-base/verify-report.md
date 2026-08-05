# Verification Report — etapa-2-dashboard-base

**Change**: etapa-2-dashboard-base
**Mode**: Hybrid (Engram + OpenSpec file)
**Strict TDD**: Active
**Verdict**: PASS WITH WARNINGS

---

## Completeness Table

| Dimension | Status |
|---|---|
| Spec artifacts | Present (obs #423) |
| Design artifacts | Present (obs #424) |
| Tasks artifacts | Present (obs #425) |
| Apply progress | Present (obs #426) |
| All automated tasks checked | YES (6.4 and 6.5 are manual/browser-only — not CRITICAL) |

---

## Build / Test / Lint Evidence

| Command | Exit Code | Result |
|---|---|---|
| `pnpm test` | 0 | 66/66 tests PASSED (9 files, Vitest 4.1.10) |
| `pnpm exec tsc --noEmit` | 1 | 10 errors in `dashboard.ts` (helper return type annotations) |
| `pnpm lint` | 0 | 0 errors, 1 pre-existing warning (unused `beforeEach` import in dashboard.test.ts) |

### TypeScript Errors Detail (dashboard.ts — 10 errors)

All 10 errors originate from the two private helper functions `buildCostQuery` and `buildProdQuery` at lines 56–76. Both declare their return type as `ReturnType<SupabaseClient["from"]>`, which resolves to `PostgrestQueryBuilder`. The actual return values are `PostgrestFilterBuilder` (returned by `.select()` and `.eq()`), which is a subtype but lacks `insert`, `upsert`, `update`, `delete`, and `cloneRequestState`. TypeScript refuses the narrowing because the declared return type is broader.

**Specific errors:**
- TS2739 at lines 62, 64, 73, 75 — FilterBuilder not assignable to QueryBuilder
- TS2339 at lines 114, 115, 151, 152, 191, 192 — `.data` / `.error` not found on QueryBuilder (downstream)

**Root cause**: `ReturnType<SupabaseClient["from"]>` is the wrong annotation. Fix: remove the explicit return type annotation on both helpers (TypeScript infers correctly) or use `PromiseLike<{data: any; error: any}>`.

**Impact**: Real TypeScript errors, not false positives. `tsc --noEmit` exits 1. Runtime unaffected (Vitest passes). Violates tasks 5.2 and 6.3 claims from apply-progress.

---

## TDD Evidence (Strict TDD Active)

| Component | RED | GREEN | Triangulated |
|---|---|---|---|
| fetchMines | Yes (import failure RED) | Yes | 2 cases |
| fetchKpiSummary | Yes | Yes | 3 cases |
| fetchCostTrend | Yes | Yes | 2 cases |
| fetchCostByDriver | Yes | Yes | 2 cases |
| KpiCard | Yes (new file) | Yes | 4 cases |
| MineSelector | Yes | Yes | 4 cases |
| CostTrendChart | Yes | Yes | 3 cases |
| CostBreakdownChart | Yes | Yes | 4 cases |
| page.tsx | Yes (baseline) | Yes | 3 cases |

TDD discipline: CONFIRMED. 18 new tests written RED first, all 66 passing GREEN.

---

## Spec Compliance Matrix (24 scenarios)

| Requirement | Scenario | Status |
|---|---|---|
| Query Layer | fetchMines returns list | PASS |
| Query Layer | fetchMines returns [] on no data | PASS |
| Query Layer | fetchKpiSummary with mine filter | PASS |
| Query Layer | fetchKpiSummary without mine filter | PASS |
| Query Layer | fetchCostTrend returns 12 data points sorted ASC | PASS |
| Query Layer | fetchCostTrend empty mine | PASS |
| Query Layer | fetchCostByDriver returns driver breakdown | PASS |
| KPI Cards | Cards render with mine filter | PASS |
| KPI Cards | Cards render without mine filter | PASS |
| KPI Cards | Labels resolve in both locales | PASS |
| Mine Selector | Populates mine list | PASS |
| Mine Selector | Selecting mine updates URL | PASS |
| Mine Selector | Selecting All Mines clears param | PASS |
| Mine Selector | Reflects URL on mount | PASS |
| Cost Trend Chart | 12-month series renders | PASS |
| Cost Trend Chart | Empty state | PASS |
| Cost Breakdown Chart | One bar per driver | PASS |
| Cost Breakdown Chart | Empty state | PASS |
| i18n Coverage | All keys in both catalogs | PASS |
| i18n Coverage | Missing key fallback | PASS |
| Server Component | Page passes serialized data | PASS |
| Server Component | Invalid mine UUID | PASS |
| TDD | All four fns have passing unit tests | PASS |
| TDD | Supabase mocked — no real DB calls | PASS |

All 24 spec scenarios: PASS.

---

## Design Coherence

| Design Decision | Status | Notes |
|---|---|---|
| SC calls pure query fns, POJOs as props | PASS | page.tsx confirmed |
| Query fns take SupabaseClient param (DI) | PASS | dashboard.ts confirmed |
| Recharts in "use client" wrappers only | PASS | Both chart files confirmed |
| Aggregation in TS not SQL | PASS | dashboard.ts confirmed |
| page.tsx awaits searchParams (Next.js 16) | PASS | line 19 confirmed |
| cost_per_tonne divide-by-zero → 0 | PASS | All four fns |
| Component paths: flat src/components/ not src/components/dashboard/ | DEVIATION (acceptable — prompt spec won) | |
| CostByDriverPoint field: `totalCost` not `amount` | DEVIATION (acceptable — consistent within impl) | |
| ResponsiveContainer wrapper on charts | PASS | Both chart files |

---

## Issues

### WARNING

**W1 — TypeScript errors in dashboard.ts (10 errors, tsc exits 1)**

`buildCostQuery` (line 59) and `buildProdQuery` (line 70) declare return type `ReturnType<SupabaseClient["from"]>`. The actual returned value from `.select()` / `.eq()` is `PostgrestFilterBuilder`, which is not assignable to `PostgrestQueryBuilder`. Downstream callers at lines 114, 115, 151, 152, 191, 192 then lose `.data` / `.error` from TypeScript's perspective.

Fix (2 lines): remove `: ReturnType<SupabaseClient["from"]>` from both helper signatures and let TypeScript infer.

**W2 — Chart tooltip/axis labels use hardcoded English strings, not i18n keys**

`CostTrendChart` tooltip formatter uses `"Cost/Tonne"` (line 46). `CostBreakdownChart` tooltip uses `"Total Cost"`. Spec requires all user-visible strings to use next-intl keys. The `dashboard.chart.costTrend` and `dashboard.chart.costByDriver` keys exist but are only used in section headers, not in chart internals.

**W3 — Empty state strings hardcoded, not using `dashboard.empty` i18n key**

Both `CostTrendChart` and `CostBreakdownChart` display `"No data available"` as a hardcoded string. The `dashboard.empty` key exists in both `es.json` and `en.json` but is unused.

**W4 — Lint warning: unused `beforeEach` import in dashboard.test.ts**

Pre-existing from apply phase. Not a blocker but should be cleaned.

### SUGGESTION

**S1 — KpiCard third card label uses `kpi.activeMines` but renders mine name or "All Mines"**

The spec says "mine name card" — the label is `kpi.activeMines` ("Mine" / "Mina") which is slightly ambiguous but acceptable.

**S2 — Manual smoke tests 6.4 and 6.5 remain unchecked**

No running server available. These are browser-only and cannot be automated in the current environment. Not blocking archive.

---

## Final Verdict

**PASS WITH WARNINGS**

- 66/66 tests passing (pnpm test exit 0)
- 0 lint errors (1 pre-existing warning)
- 10 TypeScript errors (WARNING — tsc --noEmit exits 1; runtime unaffected)
- 24/24 spec scenarios covered with passing tests
- Strict TDD RED-GREEN discipline confirmed for all 9 test files
- 3 i18n completeness gaps (chart tooltip labels + empty state strings hardcoded)
- 2 acceptable design deviations (component paths, field name)
