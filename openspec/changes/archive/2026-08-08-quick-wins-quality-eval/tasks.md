# Tasks: Text-Query Quick-Win Quality Fixes

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~120–160 (1 new file ≈ 15 lines; 2 modified files ≈ 60 deletions + 30 insertions; tests ≈ 50 lines) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | N/A |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | All five quick-win fixes + tests | PR 1 | `pnpm test src/lib/text-query/` | N/A — pure library logic, no server needed | `git revert` deletes `errors.ts`, restores two local blocks + three lines |

---

## Phase 1: Foundation — Create shared errors.ts

- [x] 1.1 **RED** Write failing test in `src/lib/text-query/__tests__/errors.test.ts`: assert `makeError('parse_failure', 'msg')` returns object with `.code === 'parse_failure'` and is instanceof Error. Assert `GENERIC_MINE_TERMS.has('cada mina') === true`. Confirm test fails (module does not exist yet).
- [x] 1.2 **GREEN** Create `src/lib/text-query/errors.ts` exporting `makeError()` factory and `GENERIC_MINE_TERMS` Set (union superset per design). Run `pnpm test src/lib/text-query/__tests__/errors.test.ts` — must pass.
- [x] 1.3 **VERIFY** Confirm `errors.ts` imports only from `./types` (no import from `intent-parser` or `query-builder`). No import cycle.

## Phase 2: Core Implementation — Repoint callers (QW1 + QW2)

- [x] 2.1 **RED** Write failing test asserting `intent-parser.ts` exports no local `makeError` symbol and `GENERIC_MINE_TERMS` is not redefined in that file (static analysis via import check or TypeScript compilation). If pre-existing test suite already covers parser, confirm it passes before editing.
- [x] 2.2 **GREEN** Modify `src/lib/text-query/intent-parser.ts`: add `import { makeError, GENERIC_MINE_TERMS } from "./errors";` after line 5; delete local `makeError` block (lines 47–55) and local `GENERIC_TERMS` block (lines 114–117); replace `GENERIC_TERMS.has(...)` at lines 131 and 146 with `GENERIC_MINE_TERMS.has(...)`. Run `pnpm test src/lib/text-query/` — all tests pass.
- [x] 2.3 **GREEN** Modify `src/lib/text-query/query-builder.ts`: add `import { makeError, GENERIC_MINE_TERMS } from "./errors";` after line 2; delete local `makeError` block (lines 30–38) and local `GENERIC_MINE_TERMS` block (lines 95–98); remaining refs resolve to import. Run `pnpm test src/lib/text-query/` — all tests pass.

## Phase 3: Core Implementation — In-place guards (QW3, QW4, QW5)

- [x] 3.1 **RED** Write test in `src/lib/text-query/__tests__/query-builder.test.ts`: mock Supabase returning cost rows but zero production_runs tonnage for a mine; assert `avg_cost_per_tonne` is `0` (not a fabricated value). Confirm test fails on current code.
- [x] 3.2 **GREEN** In `src/lib/text-query/query-builder.ts` at `queryCostPerTonneByMine` (~L289–294): change `?? 1` to `?? 0`; replace bare division with `totalTonnage > 0 ? parseFloat((totalCost / totalTonnage).toFixed(2)) : 0`. Run failing test — must pass.
- [x] 3.3 **RED** Write test in `src/lib/text-query/__tests__/intent-parser.test.ts`: spy on `buildPrompt`; call `parseIntent` with a 501-character string; assert the captured prompt argument contains ≤ 500 characters from the question. Also assert a 500-char question is passed unchanged. Confirm test fails on current code.
- [x] 3.4 **GREEN** In `src/lib/text-query/intent-parser.ts` — before `let text: string;` (~L61): add `const MAX_QUESTION_LENGTH = 500; if (question.length > MAX_QUESTION_LENGTH) question = question.slice(0, MAX_QUESTION_LENGTH);`. Run failing test — must pass.
- [x] 3.5 **RED** Write test for `buildMultiMineQuery`: assert it throws `TextQueryError` with `code: 'parse_failure'` when `intent.mineNames` is `[]` and when it is `['only-one']`. Assert no throw when `mineNames` has 2+ entries. Confirm throw cases fail on current code.
- [x] 3.6 **GREEN** In `src/lib/text-query/query-builder.ts` at `buildMultiMineQuery` (~L335): replace `intent.mineNames!` access with `const names = intent.mineNames; if (!names || names.length < 2) throw makeError('parse_failure', 'Multi-mine comparison requires at least 2 mine names');`. Use `names` hereafter. Run failing tests — must pass.

## Phase 4: Full Verification

- [x] 4.1 Run `pnpm test src/lib/text-query/` — zero failures. Confirm all RED tests written in Phases 1–3 are now GREEN. Result: 41/41 tests passing.
- [x] 4.2 Run `pnpm tsc --noEmit` — pre-existing TS error in query-builder.test.ts:263 (was present before this change, not introduced by this work). All modified source files are type-clean.
- [x] 4.3 Grep confirmed: no local `makeError` or `GENERIC_TERMS`/`GENERIC_MINE_TERMS` definitions in either caller file.
- [x] 4.4 Grep confirmed: `?? 1` not present in `queryCostPerTonneByMine`.
- [x] 4.5 Grep confirmed: `mineNames!` not present anywhere in `query-builder.ts`.
