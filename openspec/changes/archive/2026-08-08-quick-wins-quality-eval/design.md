# Design: Text-Query Quick-Win Quality Fixes

## Technical Approach

Extract the duplicated `makeError` helper and mine-term constant into one shared
module `src/lib/text-query/errors.ts`, then repoint both callers. Apply three
in-place correctness guards in `query-builder.ts` and one input-truncation guard
in `intent-parser.ts`. No spec-level behavior change; internal library hardening
only. Strict TDD: RED tests precede each edit; verify with `pnpm test`.

## Architecture Decisions

### Decision: Single shared module vs. two-file dedup

| Option | Tradeoff | Decision |
|--------|----------|----------|
| New `errors.ts` exporting `makeError` + `GENERIC_MINE_TERMS` | One import per caller; both symbols co-located; zero internal deps → no cycle | **Chosen** |
| Move helpers into existing `types.ts` | `types.ts` is a pure type file; adding runtime code breaks its role | Rejected |
| Keep duplicates, add a lint rule | Drift persists; does not fix root cause | Rejected |

**Rationale**: `errors.ts` depends only on the `TextQueryError` type from `./types`,
so there is no import cycle. Co-locating the error factory and the generic-term set
keeps both dedup targets in one file.

### Decision: Unified GENERIC_MINE_TERMS as a superset

**Choice**: Union of both sets — `intent-parser` set already had `"cada mina"`;
`query-builder` set did not. Unified set includes it.
**Alternatives considered**: Keep the smaller `query-builder` set (breaks parser
normalization for `"cada mina"`); keep two sets (drift risk).
**Rationale**: Superset is safe — it only broadens what counts as "no specific
mine", the correct behavior. Tested via `"cada mina"`.

### Decision: Zero-tonnage cost-per-tonne guard

**Choice**: Replace fallback `?? 1` with `?? 0` and guard the division so a mine
with no tonnage yields `avg_cost_per_tonne: 0` instead of a fabricated value
(cost / 1 = full cost mislabeled as per-tonne).
**Alternatives considered**: Skip the mine (drops it from ranking — hides data);
return `null` (breaks `QueryRow` numeric contract).
**Rationale**: `0` is honest and matches the existing `queryCostPerTonne`
per-period guard (`tonnage > 0 ? amount / tonnage : 0`).

## Data Flow

    question ──► parseIntent (truncate ≤500) ──► buildPrompt ──► LLM
                       │                                          │
                       └── GENERIC_MINE_TERMS (shared) ◄──────────┘
                                                                  ▼
    ParsedIntent ──► buildAndExecuteQuery ──► queryCostPerTonneByMine (?? 0 guard)
                          │                       buildMultiMineQuery (mineNames guard)
                          └── makeError (shared) ─────────────► TextQueryError

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/text-query/errors.ts` | Create | Shared `makeError` + `GENERIC_MINE_TERMS` |
| `src/lib/text-query/intent-parser.ts` | Modify | Import shared module; drop local `makeError` + `GENERIC_TERMS`; truncate question ≤500 |
| `src/lib/text-query/query-builder.ts` | Modify | Import shared module; drop local `makeError` + `GENERIC_MINE_TERMS`; `?? 0` + division guard; `mineNames` guard |

## Interfaces / Contracts

New `src/lib/text-query/errors.ts` exact content:

```ts
import type { TextQueryError } from "./types";

// ---------------------------------------------------------------------------
// Shared error factory + generic mine-term set for the text-query pipeline.
// No internal deps beyond the TextQueryError type — safe to import anywhere.
// ---------------------------------------------------------------------------

export function makeError(
  code: TextQueryError["code"],
  message: string
): TextQueryError & Error {
  const err = new Error(message) as Error & TextQueryError;
  err.code = code;
  err.message = message;
  return err;
}

// Terms that mean "no specific mine" (union of both former call-site sets).
export const GENERIC_MINE_TERMS = new Set([
  "all", "todas", "todas las minas", "all mines", "minas", "mines",
  "every mine", "each mine", "cualquier mina", "cada mina",
]);
```

### QW1/QW2 — import repointing

`intent-parser.ts`: add after line 5 import block:
`import { makeError, GENERIC_MINE_TERMS } from "./errors";`
Then delete local `makeError` (lines 47–55) and the local `const GENERIC_TERMS =
new Set([...])` (lines 114–117); replace its two usages (`GENERIC_TERMS.has(...)`
on lines 131 and 146) with `GENERIC_MINE_TERMS.has(...)`.

`query-builder.ts`: add after line 2 import:
`import { makeError, GENERIC_MINE_TERMS } from "./errors";`
Then delete local `makeError` (lines 30–38) and local `GENERIC_MINE_TERMS`
(lines 95–98). Remaining `makeError`/`GENERIC_MINE_TERMS` references resolve to
the import unchanged.

### QW3 — zero-tonnage guard (`queryCostPerTonneByMine`, lines 289–294)

```ts
const totalTonnage = tonnageByMineId.get(m.id) ?? 0;   // was ?? 1
return {
  mine: m.name,
  avg_cost_per_tonne:
    totalTonnage > 0
      ? parseFloat((totalCost / totalTonnage).toFixed(2))
      : 0,                                              // was totalCost / totalTonnage
};
```

### QW4 — input truncation (`parseIntent`, top of function body, before line 62)

Insert as the first statement inside `parseIntent`, before `let text: string;`:

```ts
const MAX_QUESTION_LENGTH = 500;
if (question.length > MAX_QUESTION_LENGTH) {
  question = question.slice(0, MAX_QUESTION_LENGTH);
}
```

Change the `question` parameter usage so it is reassignable: rename the param to
`rawQuestion` and set `let question = rawQuestion;` OR keep the name and reassign
(param reassignment is allowed). The truncated `question` then flows into
`buildPrompt(question)` unchanged and is reused for the downstream trigger checks.

### QW5 — mineNames guard (`buildMultiMineQuery`, line 335)

Replace the non-null assertion:

```ts
const names = intent.mineNames;
if (!names || names.length < 2) {
  throw makeError(
    "parse_failure",
    "Multi-mine comparison requires at least 2 mine names"
  );
}
```

`names` is then a definite `string[]`; the rest of the function is unchanged.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `GENERIC_MINE_TERMS` includes `"cada mina"` | Assert `.has("cada mina")` on shared set |
| Unit | Zero-tonnage mine → `avg_cost_per_tonne: 0` | Mock Supabase: cost rows, no matching prod rows; assert `0` |
| Unit | Question >500 chars truncated before `buildPrompt` | Spy on `llm.complete`; assert prompt length bound |
| Unit | `buildMultiMineQuery` throws `parse_failure` when `<2` names | Call with `mineNames` of length 0/1; assert code |
| Unit | `makeError`/`GENERIC_MINE_TERMS` imported (no local dupes) | Grep-free: import from `./errors` compiles, single definition |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file
classification, or process-integration boundary. All changes are pure in-process
library logic.

## Migration / Rollout

No migration required. Revert is a single `git revert` of the change commit:
delete `errors.ts`, restore the two local `makeError`/constant blocks and the
three edited lines. No data or schema impact.

## Open Questions

- None. Proposal referenced `?? 1` at "L290"; confirmed in code at line 290
  (`tonnageByMineId.get(m.id) ?? 1`) with the division at line 293 — both
  addressed by the QW3 block above.
