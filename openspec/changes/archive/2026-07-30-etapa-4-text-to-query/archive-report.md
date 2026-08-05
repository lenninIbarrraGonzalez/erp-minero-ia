# Archive Report: Etapa 4 — Text-to-Query

**Change**: etapa-4-text-to-query
**Archived**: 2026-07-30
**Status**: COMPLETE — PASS WITH WARNINGS
**Archive Path**: `openspec/changes/archive/2026-07-30-etapa-4-text-to-query/`

---

## Executive Summary

Etapa 4 (Text-to-Query) is complete and archived. The feature enables mine operators to ask plain-language questions about production and cost data and receive a data table, auto-selected chart, and LLM-generated insight. All 30 implementation tasks (19 in PR 4a, 11 in PR 4b) are complete. Verification passed with no CRITICAL issues. Two stacked, independent PRs deliver the feature within the 400-line budget: PR 4a (logic layer, 6 modules + tests) and PR 4b (route + UI, 3 route/component + tests, dashboard integration).

---

## Change Artifacts & Observation IDs

### Engram Artifacts (persisted with observation IDs for traceability)

| Artifact | Type | ID | Topic Key |
|----------|------|----|-----------| 
| Proposal | architecture | #439 | `sdd/etapa-4-text-to-query/proposal` |
| Spec | architecture | #441 | `sdd/etapa-4-text-to-query/spec` |
| Design | architecture | #440 | `sdd/etapa-4-text-to-query/design` |
| Tasks | architecture | #442 | `sdd/etapa-4-text-to-query/tasks` |
| Apply Progress | architecture | #443 | `sdd/etapa-4-text-to-query/apply-progress` |
| Verify Report | architecture | #444 | `sdd/etapa-4-text-to-query/verify-report` |
| Archive Report | architecture | (this document) | `sdd/etapa-4-text-to-query/archive-report` |

---

## Completion Status

### Task Completion Gate

**Result: PASS**

All 30 implementation tasks (19 + 11 across both PRs) are marked complete [x] in the persisted tasks artifact at `/openspec/changes/archive/2026-07-30-etapa-4-text-to-query/tasks.md`. No unchecked implementation tasks remain. Task checkbox reconciliation was performed at archive time per skill section 96–97, backed by apply-progress observation #443 and verify-report observation #444 attesting completion.

---

## Verification Evidence

### Verification Verdict: PASS WITH WARNINGS

**Source**: Verify Report (obs #444), dated 2026-07-30

### Build Status
- **Test Suite**: 115/115 tests passed, 20 test files
- **TypeScript**: `tsc --noEmit` — 0 errors
- **Lint**: `pnpm lint` — 0 errors (1 pre-existing warning in dashboard.test.ts not introduced by this change)

### TDD Discipline (Strict Mode)
All 6 logic modules submitted to Strict TDD (RED → GREEN):
- intent-parser: 4 tests (valid JSON, malformed, unsupported metric, LLM error) — GREEN
- query-builder: 5 tests (3 metrics, mine_not_found, empty) — GREEN
- chart-heuristic: 5 tests (all 5 branches: cost_per_tonne+temporal, tonnage+temporal, cost_by_driver, no-temporal, empty) — GREEN
- insight-generator: 2 tests (happy path, LLM failure → "") — GREEN
- route handler: 7 tests (200 happy, 422 variants, 500 infra, empty) — GREEN
- query-panel component: 6 tests (render, loading, table, insight, empty, error) — GREEN

### Spec Compliance
- **text-query domain**: 9 requirements, 22 scenarios — all PASS except R9 key name deviations (WARNING W1, functional but mismatched)
- **dashboard delta**: 3 added requirements, 10 scenarios — all PASS

### Issues at Close

#### WARNINGS (3)
1. **W1 — i18n key name deviations from spec (R9)**
   - Implemented: `textQuery.emptyResult`, `textQuery.error.generic`, `textQuery.insight.label`
   - Spec: `textQuery.emptyState`, `textQuery.error.llmUnavailable`, `textQuery.insight`
   - Impact: Functional parity test passes; both locales in sync. Spec contract mismatched — not a runtime error.
   - Severity: WARNING (no CRITICAL gate block)

2. **W2 — ADR-4 mineId bypass design intent not fully implemented**
   - Status: `resolvedIntent._mineIdDirect` injected in route but `buildAndExecuteQuery` ignores it.
   - Impact: Zero practical impact — UI never sends `mineId` in requests; intent-parser always populates `mineName`.
   - Severity: WARNING (acceptable per scope)

3. **W3 — act() wrapping warning in query-panel loading test**
   - Status: Non-blocking stderr warning; test passes.
   - Severity: WARNING (cosmetic)

#### SUGGESTIONS (2)
- S1: `error.generic` could be refined to `error.llmUnavailable` in future
- S2: Route returns error code strings directly; clients manually map to i18n keys

#### CRITICAL ISSUES: 0

Verification gates (obs #444) confirm: **PASS WITH WARNINGS — no CRITICAL issues. Archive unblocked.**

---

## Design Decisions

### Architecture Decision Records (ADRs)

| ADR | Decision | Status | Rationale |
|-----|----------|--------|-----------|
| ADR-1 | Route Handler `POST /api/text-query` (not Server Action) | PASS | Mirrors Etapa 3; clean JSON contract; testable |
| ADR-2 | LLM-only + Zod safeParse validation (not regex fallback) | PASS | Single validation gate; schema-in-prompt |
| ADR-3 | Static per-metric functions (not dynamic SQL) | PASS | 3 metrics, type-safe, no injection surface |
| ADR-4 | fetchMines + exact case-insensitive match in route (not DB ILIKE) | WARNING | 5-row table; mineId bypass inert but zero practical impact |
| ADR-5 | Separate insight LLM call, graceful degrade to "" | PASS | Separates structured parse from narration |
| ADR-6 | `<QueryPanel>` fetch + useState + useTransition (not React Query/SWR) | PASS | Single non-cached query; no new dependency |

---

## Specs Merged to Source of Truth

### New Spec Created
- **Domain**: text-query (NEW)
- **Path**: `openspec/specs/text-query/spec.md` (created from delta)
- **Requirements**: 9 (ParsedIntent schema, intent parser, mine resolution, query builder, chart heuristic, insight generation, route contract, i18n keys, TDD)
- **Scenarios**: 22

### Existing Spec Updated (Merged)
- **Domain**: dashboard (MODIFIED)
- **Path**: `openspec/specs/dashboard/spec.md` (merged delta requirements)
- **Added Requirements**: 3 (QueryPanel UI composition, input/submission, results display)
- **Added Scenarios**: 10
- **Original Requirements**: preserved (no removal, no modification to existing requirements)
- **Merge Method**: Appended ADDED section after existing TDD requirement; all original dashboard requirements intact

---

## Files Created in Implementation

### Logic Layer (PR 4a)
- `src/lib/text-query/types.ts` — ChartType, Metric, ParsedIntent, QueryResult, TextQueryResponse types
- `src/lib/text-query/intent-schema.ts` — Zod ParsedIntentSchema
- `src/lib/text-query/intent-parser.ts` + `.test.ts` — LLM→JSON→Zod intent parsing
- `src/lib/text-query/query-builder.ts` + `.test.ts` — intent→Supabase→aggregated rows
- `src/lib/text-query/chart-heuristic.ts` + `.test.ts` — intent→ChartType heuristic
- `src/lib/text-query/insight-generator.ts` + `.test.ts` — 2nd LLM call for insight text
- `src/__mocks__/server-only.ts` — Vitest stub for server-only directive

### Route + UI (PR 4b)
- `src/app/api/text-query/route.ts` + `.test.ts` — POST handler orchestrating full pipeline
- `src/components/query-panel/query-input.tsx` — text input + submit button
- `src/components/query-panel/query-results.tsx` — results table + chart + insight
- `src/components/query-panel/query-panel.tsx` + `.test.ts` — orchestrating component

### Modified Files
- `src/app/page.tsx` — added `<QueryPanel />` section below charts grid
- `messages/es.json` — added 9 `textQuery.*` keys
- `messages/en.json` — added 9 `textQuery.*` keys (parity enforced)
- `package.json` — added zod v4.4.3
- `vitest.config.ts` — added server-only alias for testing

**Total Files Created**: 15 new
**Total Files Modified**: 5

---

## Deliverables

### PR 4a: Logic Layer (branch: `etapa-4/pr4a-logic-layer`, commit: b02c22d)
- Intent schema, parser, query builder, chart heuristic, insight generator
- Unit tests for all 6 logic modules (25 tests)
- i18n keys (es + en) with parity test
- zod dependency added
- ~350–400 changed lines

### PR 4b: Route + UI (branch: `etapa-4/pr4b-route-ui`, commit: 4092b9f, stacked on 4a)
- Route Handler POST /api/text-query
- QueryPanel component (input, results, main orchestrator)
- Route integration test (7 tests)
- Component tests (6 tests)
- Dashboard integration (page.tsx + i18n)
- ~350–400 changed lines

Both PRs respect the 400-line individual budget; combined within safe review envelope for delivery strategy auto-chain.

---

## Rollback Capability

**Both slices are fully reversible**:
- Revert PR 4b → dashboard charts-only (no QueryPanel)
- Revert PR 4a → remove logic layer + zod dependency
- Zero schema/data migrations to unwind
- All new files can be deleted; modified files have isolated additions (no destructive changes)

---

## Downstream Impact & Dependencies

### Etapa 5 Readiness
Etapa 5 (cost-variance explainer) can now consume:
- **New exports from logic layer**: `ParsedIntent`, `buildAndExecuteQuery`, `getChartType`, all Zod types — reusable for variance module's query dispatch
- **Route Handler**: `POST /api/text-query` baseline for Etapa 5 cost-breakdown API
- **LLM infra**: `createLlmChain` patterns in route.ts; Etapa 5 can follow same orchestration style

### No Breaking Changes
- Etapa 2 (dashboard) unmodified except for QueryPanel addition (backward-compatible)
- Etapa 3 (LLM infra) not modified; only reused
- Database schema unchanged

---

## Spec Contract Compliance

### Original Proposal (obs #439) Success Criteria
- [x] `POST /api/text-query` returns `{rows, chartType, insightText}`
- [x] Intent parser validates LLM output vs Zod schema; malformed fails gracefully
- [x] Query builder resolves mine name, period, metric into Supabase queries
- [x] Chart heuristic returns line|bar|none per metric
- [x] QueryPanel renders on dashboard; es/en parity (enforced by test, not by key names — see W1)
- [x] All new tests pass (115/115)

**Result**: All criteria met. W1 is a key-name deviation, not a criteria violation.

---

## Stale Snapshot Resolution

Per Final-State Authority hierarchy (section 56–66 of skill):

### apply-progress (obs #443) vs. Final State
- **Snapshot claimed**: "All 19 + 11 tasks complete"
- **Final state fact**: Tasks remain complete (no un-completing work)
- **Authority rank**: Snapshot rank 4 (intermediate); rank 3 facts (launch prompt) and rank 1 (native review) take precedence if contradictory
- **Finding**: Snapshot claim confirmed at archive time; no contradiction

### verify-report (obs #444) vs. Final State
- **Snapshot claimed**: "PASS WITH WARNINGS, 0 CRITICAL"
- **Final state fact**: Verification was completed 2026-07-30 and has not been re-run
- **Authority rank**: Snapshot rank 4; rank 1/3 absent (no native review gate requested, no explicit override in launch prompt)
- **Finding**: Snapshot is the authoritative verification state at close; claim reported as-is

---

## Archive Checklist

- [x] **Native Review Receipt Gate**: Not requested in this change; reviewGate.delivery: unmanaged (gentle-ai review mode disabled per global context)
- [x] **Task Completion Gate**: All 30/30 tasks marked [x] in persisted artifact
- [x] **Spec Sync**: Delta specs merged into main specs (text-query created, dashboard merged)
- [x] **Archive Move**: Change folder moved to `openspec/changes/archive/2026-07-30-etapa-4-text-to-query/`
- [x] **Archive Verification**: All artifacts present (proposal, specs, design, tasks, verify-report)
- [x] **Archive Report**: Written with all observation IDs for traceability
- [x] **Engram Persistence**: Archive report saved with topic_key for upsert capability

---

## Final Authority Statement

This archive report reflects the **state of the change at close** (2026-07-30), per the Final-State Authority hierarchy in the skill. The change is complete, verified, and ready for next cycle work (Etapa 5). No further work is required on etapa-4-text-to-query.

**Archived by**: SDD Archive Phase (sdd-archive executor)
**Lifecycle Status**: CLOSED — cycle complete
**Next Recommended**: Etapa 5 (cost-variance explainer)
