# Proposal: Text-Query Quick-Win Quality Fixes

## Intent

A quality evaluation of the `text-query` LLM pipeline surfaced five surgical defects: duplicated helpers/constants (drift risk), a divide-by-fallback bug that fabricates cost-per-tonne values, an unbounded LLM prompt input, and an unsafe non-null assertion. Each is already diagnosed with exact file:line citations. Fixing them together removes correctness bugs and code-drift risk in one cohesive, low-risk change.

## Scope

### In Scope
- **QW1/QW2** New `src/lib/text-query/errors.ts`: shared `makeError()` + unified `GENERIC_MINE_TERMS` (union of both sets, includes "cada mina"); both callers import it.
- **QW3** `query-builder.ts:290,293` — fallback `?? 1` → `?? 0` with `totalTonnage > 0` division guard (returns 0 when no tonnage).
- **QW4** `intent-parser.ts` — truncate question to 500 chars before `buildPrompt`.
- **QW5** `query-builder.ts:335` — replace `intent.mineNames!` with defensive guard throwing `parse_failure` when fewer than 2 names.

### Out of Scope
- Broader refactors, new metrics, or LLM-prompt redesign.
- Deduplicating other constants/helpers not cited above.
- UI, schema, or Supabase query-shape changes.

## Capabilities

### New Capabilities
None (internal library hardening, no spec-level behavior change).

### Modified Capabilities
None.

## Approach

Extract shared error/constant module first, repoint both imports, then apply the three in-place correctness guards. Strict TDD: add/adjust tests around cost-per-tonne zero-tonnage, oversized input truncation, and multi-mine guard before edits. Verify with `pnpm test`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/text-query/errors.ts` | New | Shared `makeError` + unified `GENERIC_MINE_TERMS` |
| `src/lib/text-query/intent-parser.ts` | Modified | Import shared module; truncate input to 500 chars |
| `src/lib/text-query/query-builder.ts` | Modified | Import shared module; tonnage fallback guard; mineNames guard |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Unified `GENERIC_MINE_TERMS` changes normalization behavior | Low | Union is a superset; add test for "cada mina" |
| `?? 0` guard alters ranking output | Low | Zero-tonnage now yields 0, not inflated value — correct by design; test covers it |
| Import cycle between modules | Low | `errors.ts` has no internal deps |

## Rollback Plan

Revert the single change commit (`git revert`). Delete `errors.ts` and restore local `makeError`/constants and original three lines. No data or migration impact.

## Dependencies

- Existing `TextQueryError` type in `./types`. No new packages.

## Success Criteria

- [ ] `makeError` and `GENERIC_MINE_TERMS` defined once, imported by both files.
- [ ] Unified term set includes "cada mina".
- [ ] Zero-tonnage mine yields `avg_cost_per_tonne: 0`, never an inflated value.
- [ ] Questions over 500 chars are truncated before the LLM prompt.
- [ ] `buildMultiMineQuery` throws `parse_failure` when fewer than 2 mine names.
- [ ] `pnpm test` passes with new/adjusted tests.
