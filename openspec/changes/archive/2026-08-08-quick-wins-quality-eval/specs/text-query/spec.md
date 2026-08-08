# Delta for Text-Query

## ADDED Requirements

### Requirement: Shared Error and Constants Module

The system MUST define `src/lib/text-query/errors.ts` exporting exactly one `makeError()` factory and one `GENERIC_MINE_TERMS` constant array. Both `intent-parser.ts` and `query-builder.ts` MUST import from this module. No local copies of `makeError` or `GENERIC_MINE_TERMS` SHALL remain in either caller file. `GENERIC_MINE_TERMS` MUST include "cada mina" and be the union superset of all terms previously held in both callers.

#### Scenario: Single source of truth for makeError

- GIVEN `errors.ts` exports `makeError`
- WHEN `intent-parser.ts` and `query-builder.ts` are inspected at import level
- THEN neither file defines a local `makeError` — both import from `../errors` or `./errors`

#### Scenario: Unified term set includes "cada mina"

- GIVEN `GENERIC_MINE_TERMS` is imported in query-builder
- WHEN the array is evaluated
- THEN it contains "cada mina" and every term that previously existed in either caller

#### Scenario: No import cycle

- GIVEN `errors.ts` has no imports from `intent-parser.ts` or `query-builder.ts`
- WHEN the module graph is resolved
- THEN no circular dependency error is thrown at build or test time

---

### Requirement: LLM Prompt Input Truncation

The system MUST truncate the user question to a maximum of 500 characters before passing it to `buildPrompt` in `intent-parser.ts`. Questions of 500 characters or fewer MUST be passed unchanged. The truncation MUST occur before any LLM call is made.

#### Scenario: Oversized question is truncated

- GIVEN a question string of 501 or more characters
- WHEN `parseIntent(question)` is called
- THEN the prompt received by the LLM chain contains at most 500 characters from the question

#### Scenario: Question within limit is unchanged

- GIVEN a question string of exactly 500 characters
- WHEN `parseIntent(question)` is called
- THEN the prompt contains the full question without any character loss

#### Scenario: Empty question is not truncated

- GIVEN an empty string question
- WHEN `parseIntent(question)` is called
- THEN truncation is a no-op and the empty string is forwarded to the prompt

---

## MODIFIED Requirements

### Requirement: Query Builder

The system MUST implement a query builder that maps a validated `ParsedIntent` to Supabase query calls against `production_runs` and `cost_entries`. The builder MUST support the three metric types:
- `cost_per_tonne`: `SUM(cost_entries.amount) / SUM(production_runs.tonnage)` per period/mine, where the result MUST be `0` when `totalTonnage` is `0` or absent (never divide by zero or fabricate a value)
- `tonnage`: `SUM(production_runs.tonnage)` per period/mine
- `cost_by_driver`: `SUM(cost_entries.amount)` grouped by `driver`

The tonnage fallback value in the accumulator MUST be `0`, not `1`. Division MUST be guarded: `totalTonnage > 0 ? totalCost / totalTonnage : 0`.

`buildMultiMineQuery` MUST validate that `intent.mineNames` contains at least 2 elements before proceeding; if the array has fewer than 2 elements, it MUST throw a `TextQueryError` with `code: 'parse_failure'`. The non-null assertion `intent.mineNames!` MUST NOT appear in the codebase.

Period filtering MUST use the `period` date column with year/month precision. The builder MUST return `QueryResult` typed as `{ rows: Array<Record<string, string | number>>; chartType: ChartType }`.

(Previously: tonnage fallback used `?? 1` allowing division by 1 when no tonnage existed, fabricating `avg_cost_per_tonne`; `intent.mineNames!` was a non-null assertion with no runtime guard.)

#### Scenario: cost_per_tonne query with period filter

- GIVEN `ParsedIntent` has `metric: 'cost_per_tonne'` and `period: { year: 2024, month: 3 }`
- WHEN the query builder executes
- THEN it returns rows scoped to March 2024 with `cost_per_tonne` computed from the correct tables

#### Scenario: cost_by_driver query

- GIVEN `ParsedIntent` has `metric: 'cost_by_driver'` with no period
- WHEN the query builder executes
- THEN rows contain one entry per distinct driver with aggregated totals

#### Scenario: Query returns zero rows

- GIVEN the intent is valid but no rows match the filters
- WHEN the query builder executes
- THEN it returns `{ rows: [], chartType: 'none' }` without throwing

#### Scenario: Zero-tonnage mine yields zero cost-per-tonne

- GIVEN a mine has `SUM(production_runs.tonnage) = 0` for the queried period
- WHEN the query builder computes `cost_per_tonne`
- THEN `avg_cost_per_tonne` for that mine is `0`, not an inflated or fabricated value

#### Scenario: Multi-mine query with valid names list

- GIVEN `intent.mineNames` contains 2 or more mine name strings
- WHEN `buildMultiMineQuery` is called
- THEN it proceeds to build and execute the Supabase query without throwing

#### Scenario: Multi-mine query with fewer than 2 names throws parse_failure

- GIVEN `intent.mineNames` is an empty array or a single-element array
- WHEN `buildMultiMineQuery` is called
- THEN it throws a `TextQueryError` with `code: 'parse_failure'`
