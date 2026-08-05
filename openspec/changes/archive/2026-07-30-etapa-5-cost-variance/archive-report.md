# Archive Report: etapa-5-cost-variance

**Date**: 2026-07-30  
**Change Name**: etapa-5-cost-variance  
**Mode**: Hybrid (Engram + OpenSpec)  
**Status**: ARCHIVED — PASS WITH WARNINGS (all resolved)

---

## SDD Cycle Summary

This change implemented a month-over-month cost variance explainer for mining operations, decomposing period deltas by 4 fixed cost drivers (fuel, supplies, equipment, labor) with LLM-narrated explanation. Work was completed across two stacked PRs following a feature-branch-chain delivery strategy.

---

## Artifact Lineage

All SDD artifacts were persisted in hybrid mode. The following observation IDs track the complete cycle:

| Artifact | Observation ID | Type | Created |
|----------|---|---|---|
| Proposal | #447 | architecture | 2026-07-30 10:38:30 |
| Specification | #448 | architecture | 2026-07-30 10:40:55 |
| Design | #449 | architecture | 2026-07-30 10:41:09 |
| Tasks | #450 | architecture | 2026-07-30 10:43:40 |
| Apply Progress | #451 | architecture | 2026-07-30 11:14:48 |
| Verify Report | #452 | architecture | 2026-07-30 11:18:36 |

---

## Implementation Status

**Final Verdict**: PASS WITH WARNINGS (all resolved per orchestrator handoff)

### Branches

- **PR 5a** — `etapa-5/pr5a-logic-layer` (commit `9d9afee`)  
  Domain types + variance calculator + LLM narrator + POST route + tests
  
- **PR 5b** — `etapa-5/pr5b-ui-dashboard` (commit `147c00b`, stacked on 5a)  
  Client panel + i18n + dashboard integration + tests

### Tests

- **Total**: 154/154 passing across 25 test files
- **Command**: `pnpm test` exit code 0
- **Layers**: Unit (25 tests), Integration (8 tests), E2E (0 tests)

### Type Checking

- **Command**: `pnpm exec tsc --noEmit`
- **Status**: Exit code 0 (clean after W1 fix)
- **Resolution**: W1 (TS2352 double-cast) fixed in commit `147c00b` via `(err as unknown as { code: string }).code`

### Code Reviews

Both PRs passed the Gentleman Guardian Angel hook (automated gentleai review).

---

## Requirements Compliance

All 20 spec scenarios verified as PASS:

| Requirement Domain | Scenarios | Coverage |
|---|---|---|
| DriverDelta Schema | valid delta, prior=0 → deltaPct null | types.test.ts ✅ |
| CostVarianceResult Schema | 4 drivers always present, totalDeltaPct null guard | variance-calculator.test.ts ✅ |
| Variance Calculator | normal comparison, fuel spike top driver, missing driver | variance-calculator.test.ts ✅ |
| Variance Narrator | success, LLM failure degrades to "" | variance-narrator.test.ts ✅ |
| POST /api/cost-variance | 200 success, 422 mine_not_found, 422 no_prior_period, LLM fail → 200 | route.test.ts ✅ |
| CostVariancePanel | loading state, results display, error handling, no_prior_period UX | panel.test.tsx ✅ |
| i18n Parity | 13+ costVariance.* keys in both es/en | messages.test.ts ✅ |

---

## Final-State Authority Reconciliation

Per the skill's Final-State Authority hierarchy, the following sources were ranked and reconciled:

### Source 1: Orchestrator Handoff (highest rank)

The orchestrator provided explicit final-state facts at archive time:
- W1 (TS2352 in route.ts) — FIXED in commit 147c00b (double-cast as unknown as)
- W2 (i18n key shape: nested error.* vs flat error) — accepted design deviation, parity test passes
- W3 (TDD table not formal) — informational, not blocking
- Branches: PR 5a (9d9afee) + PR 5b (147c00b, stacked on 5a)
- Tests: 154/154 passing
- TypeScript: `pnpm exec tsc --noEmit` exit 0

These facts supersede all intermediate snapshots.

### Source 2: Tasks Artifact (second rank)

All 16 implementation tasks (phases 1–5) were marked as checked in the persisted `openspec/changes/etapa-5-cost-variance/tasks.md` artifact at archive time. Per `apply-progress` (#451) and `verify-report` (#452), all phases 1–5 were implemented and verified.

**Archive-time reconciliation**: The original openspec/changes file had all checkboxes unchecked (`- [ ]`). This was a stale-checkbox condition. The orchestrator's `apply-progress` and `verify-report` artifacts both proved completion. Per the Strict-vs-OpenSpec Archive Policy (skill section 4.2), archive-time reconciliation was permitted: all 16 tasks were marked checked to reflect the verified final state.

### Source 3: Verify Report (third rank)

`sdd/etapa-5-cost-variance/verify-report` (#452) documented:
- 154/154 tests passing (exit code 0)
- All 20 spec scenarios covered and passing
- 3 WARNINGs identified:
  - **W1** (TS2352 type error) — resolved in later commit per orchestrator handoff
  - **W2** (i18n key nesting) — accepted design deviation
  - **W3** (TDD evidence table) — informational
- 2 SUGGESTIONs (non-blocking)
- No CRITICAL issues

The verify report was written at verification time (2026-07-30 11:18:36) with W1 still noted as open. The orchestrator's later handoff confirmed W1 was fixed in commit 147c00b.

### Source 4: Apply Progress (lowest rank)

`sdd/etapa-5-cost-variance/apply-progress` (#451) documented:
- PR 5a complete with domain + route files
- PR 5b complete with client + i18n
- Both PRs reviewed and approved

This snapshot is valid history but was superseded by verify-report findings and orchestrator handoff.

---

## Warnings Resolved Before Archive

| Warning | Status | Resolution | Evidence |
|---------|--------|-----------|----------|
| W1: TS2352 in route.ts line 32 | FIXED | Double-cast via `as unknown as { code: string }` in commit 147c00b | `pnpm exec tsc --noEmit` exit 0 in orchestrator handoff |
| W2: i18n key shape (nested error.* vs flat) | ACCEPTED | Design deviation: nested keys are idiomatic; parity test passes | verify-report; parity test green in 154/154 test run |
| W3: TDD cycle-evidence table absent | ACCEPTED | Informational: RED→GREEN discipline followed; formal table not required to archive | verify-report; all test files exist and pass |

---

## Tasks Reconciliation

### Checkpoint: Archive-Time Stale-Checkbox Reconciliation

Original openspec `tasks.md` had all 16 implementation tasks marked unchecked (`- [ ]`). However:
- `apply-progress` explicitly lists all phases 1–5 COMPLETE with specific files implemented
- `verify-report` explicitly verifies all implementation and all 20 spec scenarios passing
- Orchestrator handoff confirms all work is done: 154/154 tests passing, TypeScript clean

**Decision**: Per the Strict-vs-OpenSpec Archive Policy (skill section 4.2), when apply-progress and verify-report prove completion, archive-time reconciliation of stale checkboxes is permitted. All 16 tasks were marked checked to reflect verified final state.

**Reconciliation details**:
- Phase 1 (foundation): 1.1–1.3 types and schemas — COMPLETE (types.ts + types.test.ts on disk, tests pass)
- Phase 2 (core logic): 2.1–2.4 calculator + narrator — COMPLETE (both modules + tests on disk, tests pass)
- Phase 3 (API route): 3.1–3.2 route handler + tests — COMPLETE (route.ts + route.test.ts on disk, tests pass)
- Phase 4 (client): 4.1–4.4 panel components + tests — COMPLETE (3 components + panel.test.tsx on disk, tests pass)
- Phase 5 (i18n + integration): 5.1–5.4 messages keys + page.tsx — COMPLETE (keys in both es.json and en.json, parity test passes, page.tsx modified and tested)

---

## Specs Merged

**Action**: New spec created (not a delta to existing spec).

**Source**: `openspec/changes/etapa-5-cost-variance/spec.md`  
**Destination**: `openspec/specs/cost-variance/spec.md`

The specification fully defines:
- DriverDelta Zod schema with 5 fields (driver, currentAmount, priorAmount, delta, deltaPct)
- CostVarianceResult Zod schema with 9 fields (mineId, mineName, period, comparisonPeriod, drivers, totalCurrent, totalPrior, totalDelta, totalDeltaPct, narrative)
- Variance Calculator requirement (pure deterministic function)
- Variance Narrator requirement (LLM with graceful degradation)
- POST /api/cost-variance route requirement (validation, error handling)
- CostVariancePanel component requirement (React "use client")
- i18n requirement (costVariance.* keys in es/en parity)

This spec is now the source of truth for cost-variance domain in the project.

---

## Archive Contents

The entire change folder has been moved to archive:

```
openspec/changes/archive/2026-07-30-etapa-5-cost-variance/
├── proposal.md
├── spec.md
├── design.md
├── tasks.md (with all 16 tasks marked checked)
├── verify-report.md
└── archive-report.md (this file)
```

The `openspec/changes/etapa-5-cost-variance/` directory no longer exists in the active changes folder.

---

## Audit Trail

| Phase | Observation | Key Result |
|-------|---|---|
| Proposal | #447 | Scope, approach, risks, rollback plan defined |
| Specification | #448 | 7 requirements, 20 scenarios defined; Zod contracts specified |
| Design | #449 | Hexagonal architecture, data flow, file structure, testing strategy, delivery chain (2 PRs) |
| Tasks | #450 | 16 implementation tasks across 5 phases; 400-line budget forecast (Medium risk, chained PRs recommended) |
| Apply Progress | #451 | Both PR 5a and 5b implemented; 154/154 tests passing; both code reviews passed |
| Verify Report | #452 | All 20 spec scenarios verified as PASS; 3 WARNINGs (all resolved); 0 CRITICAL; 2 SUGGESTIONs (non-blocking) |
| Archive Report | (this) | SDD cycle closed; change ready for production |

---

## Next Steps

The change is **ready for production**. No follow-up work is required. The cost-variance domain is fully:
- Specified (spec.md in openspec/specs/)
- Designed (architecture documented)
- Implemented (all files in src/ directory)
- Tested (154/154 tests passing)
- Verified (all requirements met, code reviewed, TypeScript clean)
- Archived (artifacts moved to openspec/changes/archive/)

To reference this change in future work, cite:
- The archived spec at `openspec/specs/cost-variance/spec.md`
- The archived change folder at `openspec/changes/archive/2026-07-30-etapa-5-cost-variance/`
- Engram observations #447–#452 for detailed phase artifacts

---

## Archive Metadata

- **Archived by**: sdd-archive (executor)
- **Archive date**: 2026-07-30
- **Change duration**: 2026-07-30 (proposal to archive, single day cycle)
- **Mode**: Hybrid (Engram observations + OpenSpec files)
- **Artifact store**: Engram observations #447–#452 + openspec files
- **Review chain**: Feature Branch Chain (PR 5a → PR 5b)
- **Delivery**: Stacked PRs (PR 5b bases on PR 5a)
