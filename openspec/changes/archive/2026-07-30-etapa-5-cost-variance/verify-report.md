# Verification Report: etapa-5-cost-variance

## Change
- **Name**: etapa-5-cost-variance
- **Mode**: Hybrid (Engram + OpenSpec file)
- **TDD Mode**: Strict TDD active
- **Branches**: `etapa-5/pr5a-logic-layer` (9d9afee), `etapa-5/pr5b-ui-dashboard` (74b7ae8)
- **Current branch**: `etapa-5/pr5b-ui-dashboard`

---

## Test Execution

| Command | Exit Code | Result |
|---------|-----------|--------|
| `pnpm test` | 0 | 154/154 tests passed, 25 test files |

**Test output hash**: 154 passed, 0 failed, 0 skipped.

---

## Completeness Table (Tasks)

All tasks in phases 1–5 were verified as implemented in the codebase.

| Task | Description | Status |
|------|-------------|--------|
| 1.1–1.3 | DriverDelta + CostVarianceResult Zod schemas, DRIVERS const | COMPLETE |
| 2.1–2.4 | computeVariance + computeVariance tests + narrateVariance + tests | COMPLETE |
| 3.1–3.2 | POST /api/cost-variance route + tests | COMPLETE |
| 4.1–4.4 | CostVarianceInput, CostVarianceResults, CostVariancePanel + panel test | COMPLETE |
| 5.1–5.4 | es.json + en.json keys, parity test green, page.tsx integration | COMPLETE |

---

## Spec Compliance Matrix

| Requirement | Scenario | Test Covering | Status |
|-------------|----------|---------------|--------|
| DriverDelta Schema | valid driver delta | types.test.ts: "validates a correct driver delta with prior > 0" | PASS |
| DriverDelta Schema | prior amount is zero → deltaPct null | types.test.ts: "validates deltaPct as null when priorAmount is 0" | PASS |
| CostVarianceResult Schema | four drivers always present | variance-calculator.test.ts: "returns exactly 4 driver entries" | PASS |
| CostVarianceResult Schema | totalDeltaPct null when totalPrior=0 | types.test.ts: "validates totalDeltaPct as null when totalPrior is 0" | PASS |
| Variance Calculator | normal two-period comparison | variance-calculator.test.ts: "sums amounts correctly" | PASS |
| Variance Calculator | injected anomaly surfaces as top driver | variance-calculator.test.ts: "identifies fuel spike as driver with largest absolute delta" | PASS |
| Variance Calculator | driver absent in one period | variance-calculator.test.ts: "returns deltaPct null when priorAmount is 0" | PASS |
| Variance Narrator | successful narration | variance-narrator.test.ts: "returns trimmed LLM response string on success" | PASS |
| Variance Narrator | LLM failure degrades to empty string | variance-narrator.test.ts: "returns empty string when LLM throws" | PASS |
| POST /api/cost-variance | valid request returns result | route.test.ts: "returns 200 with CostVarianceResult on valid input" | PASS |
| POST /api/cost-variance | missing comparisonPeriod defaults to prior month | route.test.ts: "defaults comparisonPeriod to prior calendar month" | PASS |
| POST /api/cost-variance | invalid input returns 422 | route.test.ts: "returns 422 invalid_input when mineId is missing" | PASS |
| POST /api/cost-variance | unknown mine returns 422 | route.test.ts: "returns 422 mine_not_found" | PASS |
| POST /api/cost-variance | first month returns 422 | route.test.ts: "returns 422 no_prior_period" | PASS |
| POST /api/cost-variance | LLM error does not produce 500 | route.test.ts: "returns 200 with empty narrative when narrator degrades" | PASS |
| CostVariancePanel | submit triggers fetch and shows results | panel.test.tsx: "renders driver breakdown table after successful fetch" | PASS |
| CostVariancePanel | loading state shown during fetch | panel.test.tsx: "shows loading state while fetching" | PASS |
| CostVariancePanel | error state on fetch failure | panel.test.tsx: "renders error message on mine_not_found" | PASS |
| CostVariancePanel | no_prior_period user-friendly | panel.test.tsx: "renders no_prior_period error message" | PASS |
| i18n Key Parity | all keys present in both locales | messages.test.ts: "es and en expose the exact same key set" | PASS |

---

## Key Decision Verification

| Decision | Verification Result |
|----------|--------|
| Wire format: `period: string "YYYY-MM-01"` | CONFIRMED — route.ts uses `z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/)`, input appends "-01" |
| Field names: `drivers` (not breakdown) | CONFIRMED — types.ts uses `drivers: z.array(DriverDeltaSchema)` |
| Field name: `narrative` (not narration) | CONFIRMED — types.ts uses `narrative: z.string()` |
| mineId consumed in `.eq("mine_id", mineId)` | CONFIRMED — variance-calculator.ts lines 60 and 67 |
| LLM narration degrades to `""` (try/catch) | CONFIRMED — variance-narrator.ts lines 31-33 |
| CostVariancePanel standalone (not merged) | CONFIRMED — separate component file |
| comparisonPeriod defaults to prior calendar month | CONFIRMED — priorMonth() function in route.ts |
| i18n parity (both locales) | CONFIRMED — 14 flat costVariance.* keys in both es.json and en.json |
| page.tsx passes `mines` prop | CONFIRMED — page.tsx line 81: `<CostVariancePanel mines={mines} />` |
| `"use client"` on all 3 components | CONFIRMED — all 3 files start with `"use client"` |
| `import "server-only"` on narrator and route | CONFIRMED — both files line 1 |

---

## TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | Partial | apply-progress confirms RED→GREEN mode but no formal cycle-evidence table |
| All tasks have test files | Yes | 4 test files for domain logic + 1 for panel (5 test files for this change) |
| RED confirmed (test files exist) | Yes | All 5 test files present on disk |
| GREEN confirmed (tests pass) | Yes | 154/154 pass — pnpm test exit 0 |
| Triangulation adequate | Yes | All spec scenarios have 1+ covering tests |
| Safety net for modified files | N/A | page.tsx modification covered by page.test.tsx (pre-existing, updated) |

**TDD Compliance**: 5/6 checks passed (apply-progress lacks formal cycle-evidence table — informational only)

---

## Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | ~25 | 4 | vitest |
| Integration | ~8 | 1 | RTL + happy-dom + vitest |
| E2E | 0 | 0 | not installed |
| **Total (this change)** | ~33 | 5 | |

---

## Issues

### WARNING

**W1 — TypeScript type error in route.ts (line 32)**
`(err as { code: string }).code` produces TS2352: "Conversion of type 'Error' to type '{ code: string }' may be a mistake." The runtime behavior is correct (the cast is inside a type guard that already verified `instanceof Error`), but `tsc --noEmit` exits with code 1. This is a type-system inconsistency, not a runtime bug.

**W2 — i18n key structure deviates from spec**
The spec lists 13 flat keys including `costVariance.error` and `costVariance.noPriorPeriod`. The implementation uses nested structure: `costVariance.error.generic`, `costVariance.error.mineNotFound`, `costVariance.error.noPriorPeriod`. All 14 flat-resolved keys are in parity across both locales and are functionally correct. The spec's key `costVariance.error` (the string) is not present — instead `costVariance.error.*` sub-keys are. Behavior is correct but the exact key enumeration in the spec is not matched literally.

**W3 — apply-progress lacks formal TDD cycle-evidence table**
The strict TDD verify protocol expects a TDD Cycle Evidence table in the apply-progress artifact (RED/GREEN/TRIANGULATE/SAFETY NET/REFACTOR columns per task). The apply-progress uses narrative prose instead. RED→GREEN discipline was followed (test files confirmed on disk, all tests pass), but the formal evidence table is absent.

### SUGGESTION

**S1 — narrative paragraph conditionally hidden when empty**
`cost-variance-results.tsx` only renders the `<p>` when `result.narrative` is truthy. The spec says "a narrative paragraph" without specifying it must be visible when empty. This is acceptable but could be made explicit (e.g., render with a placeholder when empty).

**S2 — CostVarianceResult schema does not enforce exactly 4 drivers at runtime**
The schema uses `z.array(DriverDeltaSchema)` without `.length(4)` constraint. The calculator always produces 4, but the schema does not enforce this via Zod. The spec says "A Zod schema MUST enforce all constraints at runtime."

---

## Verdict

**PASS WITH WARNINGS**

- 0 CRITICAL issues
- 3 WARNINGs (1 TS type error, 1 i18n key shape deviation, 1 missing TDD table)
- 2 SUGGESTIONs

All spec scenarios are covered by passing tests. All implementation files are present. All key resolved decisions are verified. The TypeScript error (W1) is non-blocking at runtime but should be fixed before merge to main.
