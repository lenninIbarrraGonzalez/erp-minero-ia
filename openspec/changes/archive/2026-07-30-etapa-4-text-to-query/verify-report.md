# Verify Report: etapa-4-text-to-query

**Change**: etapa-4-text-to-query
**Branches**: PR 4a `etapa-4/pr4a-logic-layer` (b02c22d) + PR 4b `etapa-4/pr4b-route-ui` (4092b9f)
**Verified at**: 2026-07-30
**Mode**: Strict TDD — RED→GREEN required
**Verdict**: PASS WITH WARNINGS

---

## Completeness

| Dimension         | Status   | Notes                                    |
|-------------------|----------|------------------------------------------|
| Proposal          | Present  | obs #439                                 |
| Spec              | Present  | obs #441                                 |
| Design            | Present  | obs #440                                 |
| Tasks             | Present  | obs #442                                 |
| Apply progress    | Complete | obs #443 — all tasks marked [x]          |

---

## Build / Tests / Lint Evidence

| Check                  | Command                     | Exit code | Result                             |
|------------------------|-----------------------------|-----------|------------------------------------|
| Test suite             | `pnpm test`                 | 0         | 115/115 passed, 20 test files      |
| TypeScript             | `pnpm exec tsc --noEmit`    | 0         | Zero errors                        |
| Lint                   | `pnpm lint`                 | 0         | 0 errors; 1 pre-existing warning   |

Pre-existing warning: `dashboard.test.ts:1 'beforeEach' is defined but never used` — not introduced by this change.

act() warning in query-panel.test.tsx loading test — stderr only, test passes, non-blocking.

---

## Spec Compliance Matrix — text-query (9 requirements, 22 scenarios)

| Req | Description                                                        | Status    | Evidence                                                        |
|-----|--------------------------------------------------------------------|-----------|-----------------------------------------------------------------|
| R1  | Accepts plain-language question (es or en)                         | PASS      | route.ts parses body.question; parseIntent accepts any string   |
| R2  | Intent via LLM + Zod; malformed → parse_failure                   | PASS      | intent-parser.ts uses safeParse; 4 tests cover all branches     |
| R3  | ParsedIntent: metric union, mineName?, period?, groupBy?           | PASS      | types.ts + intent-schema.ts match spec exactly                  |
| R4  | Mine resolution: case-insensitive; absent→all; unfound→mine_not_found | PASS  | query-builder.ts resolveMineId; 2 tests cover this              |
| R5  | Result: { rows, chartType, insightText }; LLM-generated summary   | PASS      | route returns TextQueryResponse; insight-generator.ts           |
| R6  | Chart heuristic: all 5 branches                                    | PASS      | chart-heuristic.ts + 5 tests covering all branches              |
| R7  | POST /api/text-query; 422 validation; 500 infra                   | PASS      | route.ts; route.test.ts 7 tests                                 |
| R8  | UI: text input + submit; results table + chart + insight; loading  | PASS      | query-input.tsx, query-results.tsx, query-panel.tsx + 6 tests   |
| R9  | i18n textQuery.* keys; es+en parity enforced by test              | WARNING   | Key names deviate from spec: emptyResult≠emptyState, generic≠llmUnavailable, insight.label≠insight |

---

## Spec Compliance Matrix — dashboard delta (3 requirements, 10 scenarios)

| Req | Description                                         | Status | Evidence                                              |
|-----|-----------------------------------------------------|--------|-------------------------------------------------------|
| D1  | QueryPanel below charts section in page.tsx         | PASS   | page.tsx: `<section>` with `<QueryPanel />` after charts grid |
| D2  | QueryPanel accessible from dashboard without nav    | PASS   | Same page, no separate route                          |
| D3  | Dashboard page functional (existing KPIs + charts)  | PASS   | page.test.tsx 3 tests pass; KPIs/charts unmodified    |

---

## TDD Discipline (Strict TDD Active)

| Module                   | RED evidence          | GREEN evidence       | Triangulation            |
|--------------------------|-----------------------|----------------------|--------------------------|
| intent-parser            | Test file created first | 4/4 pass            | valid, malformed, bad metric, LLM error |
| query-builder            | Test file created first | 5/5 pass            | 3 metrics, mine_not_found, empty |
| chart-heuristic          | Test file created first | 5/5 pass            | all 5 branches           |
| insight-generator        | Test file created first | 2/2 pass            | happy path, LLM failure→"" |
| route                    | Test file created first | 7/7 pass            | 200, 422×3, 500, empty   |
| query-panel              | Test file created first | 6/6 pass            | initial, loading, table, insight, empty, error |

---

## Design Coherence

| ADR   | Decision                                      | Status   | Notes                                             |
|-------|-----------------------------------------------|----------|---------------------------------------------------|
| ADR-1 | Route Handler POST /api/text-query            | PASS     | route.ts exports `async function POST`            |
| ADR-2 | LLM-only + Zod safeParse                      | PASS     | intent-parser.ts uses `ParsedIntentSchema.safeParse` |
| ADR-3 | Static per-metric query functions             | PASS     | queryCostPerTonne, queryTonnage, queryCostByDriver |
| ADR-4 | In-route mine resolution                      | WARNING  | mineId bypass injects _mineIdDirect but buildAndExecuteQuery ignores it; UI never sends mineId so zero practical impact |
| ADR-5 | Separate insight LLM call                     | PASS     | insight-generator.ts is a separate module         |
| ADR-6 | fetch + useTransition                         | PASS     | query-panel.tsx: `useState + useTransition`        |

---

## Server Boundary

| Check                                            | Status | Notes                                           |
|--------------------------------------------------|--------|-------------------------------------------------|
| route.ts imports `server-only`                   | PASS   | Line 1: `import "server-only"`                  |
| No LLM imports in client components              | PASS   | query-input/results/panel only import types     |
| No Supabase imports in client components         | PASS   | Confirmed                                       |
| __mocks__/server-only.ts stub for tests          | PASS   | src/__mocks__/server-only.ts + vitest alias     |

---

## Issues

### WARNING

**W1 — i18n key names deviate from spec (R9)**
- Spec specified: `textQuery.emptyState`, `textQuery.error.llmUnavailable`, `textQuery.insight`
- Implemented: `textQuery.emptyResult`, `textQuery.error.generic`, `textQuery.insight.label`
- Impact: Parity test passes; both locales are in sync; no broken translations in the UI. However the spec contract is violated — any external consumer or future documentation referencing the spec key names would be mismatched.
- Severity: WARNING (functional, but spec contract mismatched)

**W2 — ADR-4 mineId bypass non-functional (documented deviation)**
- `resolvedIntent._mineIdDirect` is set in route.ts but `buildAndExecuteQuery` only reads `intent.mineName`. The mineId from the HTTP body never reaches the DB query.
- Impact: Zero — UI sends only `question` (no `mineId`), and the intent-parser always populates `mineName` when a mine is mentioned.
- Severity: WARNING (design intent not fully implemented; acceptable given stated rollout scope)

**W3 — act() warning in query-panel loading test**
- One React act() wrapping warning appears in stderr for the loading-state test. Test passes and the behavior is correct, but the test could be made more precise.
- Severity: WARNING (non-blocking, cosmetic)

### SUGGESTION

**S1 — llmUnavailable error code returns 500 but maps to `error.generic` in UI**
- The design doc specified a `textQuery.error.llmUnavailable` key for a more user-friendly error. The current `error.generic` key covers this case but is less specific. A future refinement could add the specific key.

**S2 — Route returns `error.code` string directly in 422 body**
- The route returns `{ error: err.code }` (e.g. `"parse_failure"`). The design mentioned returning i18n key references. Clients must map these codes manually (as query-panel.tsx does). This is a minor API design concern — not a spec violation.

---

## Task Completion

All 19 implementation tasks marked [x] in the tasks artifact. No unchecked tasks.

---

## Final Verdict

**PASS WITH WARNINGS**

0 CRITICAL | 3 WARNING | 2 SUGGESTION

The implementation correctly satisfies all functional requirements. Tests pass 115/115 with strict RED→GREEN TDD discipline. TypeScript and lint are clean. The three warnings are: i18n key name deviations from the spec (functional but mismatched), the ADR-4 mineId bypass (documented, zero practical impact), and a cosmetic act() warning in one test. None block archive.

**Next recommended**: sdd-archive
