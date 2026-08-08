# Text-Query Specification

## Purpose

Accepts a plain-language question (es or en) from the user, extracts a structured intent via the LLM fallback chain, executes the corresponding Supabase query, and returns a tabular result with an auto-selected chart type and a one-sentence LLM-generated insight. All server-side work runs inside a Route Handler.

## Requirements

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

### Requirement: ParsedIntent Schema

The system MUST define a `ParsedIntent` Zod schema constrained to exactly three supported metrics: `cost_per_tonne`, `tonnage`, and `cost_by_driver`. The schema MUST include optional fields: `mineName?: string`, `period?: { year: number; month?: 1 | 2 | … | 12 }`, and `groupBy?: 'mine' | 'driver' | 'month'`. Any LLM output that does not conform to this schema MUST be treated as a parse failure.

#### Scenario: Valid intent parsed

- GIVEN the LLM returns well-formed JSON matching the Zod schema
- WHEN the intent parser validates the response
- THEN a typed `ParsedIntent` object is returned without error

#### Scenario: Malformed LLM JSON

- GIVEN the LLM returns non-JSON or JSON that does not match the Zod schema
- WHEN the intent parser validates the response
- THEN it throws a `ParseFailureError` with a message the caller can surface to the user

#### Scenario: Unsupported metric in LLM output

- GIVEN the LLM extracts a metric not in the allowed set (e.g., `ore_grade`)
- WHEN Zod validates the intent
- THEN a `ParseFailureError` is thrown and the route returns HTTP 422 with `{ error: "unsupported_metric" }`

---

### Requirement: Intent Parser

The system MUST call the LLM fallback chain with a prompt that instructs the model to return only valid JSON conforming to the `ParsedIntent` schema. The intent parser MUST be a server-only module. The parser MUST wrap the LLM call in a try/catch for `LLMProviderError`; such failures MUST surface as HTTP 500.

#### Scenario: Happy path — LLM returns valid intent

- GIVEN the LLM chain is available and returns valid JSON
- WHEN `parseIntent(question)` is called
- THEN a `ParsedIntent` object is returned

#### Scenario: LLM chain failure

- GIVEN all LLM providers in the chain are unavailable
- WHEN `parseIntent(question)` is called
- THEN it throws an error that the route maps to HTTP 500 with `{ error: "llm_unavailable" }`

---

### Requirement: Mine Name Resolution

The system MUST resolve `mineName` from `ParsedIntent` to a `mine_id` UUID via an exact, case-insensitive match against the `mines` table. If `mineName` is provided but no row matches, the system MUST return HTTP 422 with `{ error: "mine_not_found" }`. If `mineName` is absent, the query MUST run across all mines.

#### Scenario: Mine name resolves to UUID

- GIVEN `ParsedIntent.mineName` is "El Teniente" and that name exists in the `mines` table
- WHEN the query builder resolves the mine
- THEN it uses the matching `mine_id` UUID for subsequent Supabase queries

#### Scenario: Mine name not found

- GIVEN `ParsedIntent.mineName` is "Nonexistent Mine" and no row matches
- WHEN the query builder attempts resolution
- THEN the route returns HTTP 422 with `{ error: "mine_not_found" }`

#### Scenario: No mine name — all-mine query

- GIVEN `ParsedIntent.mineName` is absent
- WHEN the query builder runs
- THEN no mine filter is applied and data aggregates across all mines

---

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

---

### Requirement: Chart Heuristic

The system MUST derive `ChartType` from the `ParsedIntent` according to these rules (evaluated in order):

| Condition | ChartType |
|-----------|-----------|
| `cost_per_tonne` with a temporal dimension (`groupBy: 'month'` or period present) | `line` |
| `tonnage` with a temporal dimension | `line` |
| `cost_by_driver` | `bar` |
| `cost_per_tonne` or `tonnage` without temporal dimension (e.g. cross-mine) | `bar` |
| Rows is empty | `none` |

#### Scenario: Line chart for cost trend over time

- GIVEN `metric: 'cost_per_tonne'` and `groupBy: 'month'`
- WHEN the chart heuristic runs
- THEN `chartType` is `'line'`

#### Scenario: Bar chart for cost by driver

- GIVEN `metric: 'cost_by_driver'`
- WHEN the chart heuristic runs
- THEN `chartType` is `'bar'`

#### Scenario: No chart for empty result

- GIVEN the query returned zero rows
- WHEN the chart heuristic runs
- THEN `chartType` is `'none'`

---

### Requirement: Insight Generation

The system MUST call the LLM fallback chain a second time to generate a single-sentence `insightText` summarising the query result. The prompt MUST include the rows data. If this LLM call fails, the route MUST still return the rows and chartType with `insightText` set to an empty string (non-fatal degradation).

#### Scenario: Insight generated successfully

- GIVEN the LLM returns a non-empty sentence
- WHEN the route assembles the response
- THEN `insightText` equals the LLM sentence

#### Scenario: Insight LLM failure — graceful degradation

- GIVEN the LLM call for insight generation fails
- WHEN the route assembles the response
- THEN `rows` and `chartType` are still returned and `insightText` is `""`

---

### Requirement: Route Handler Contract

The system MUST expose `POST /api/text-query` as a Next.js Route Handler. The request body MUST conform to `{ question: string; mineId?: string }`. Success response MUST be `{ rows, chartType, insightText }` (HTTP 200). Error responses MUST be `{ error: string }` with HTTP 422 for validation/semantic errors and HTTP 500 for LLM/DB infrastructure failures.

#### Scenario: Valid request returns full result

- GIVEN a POST body `{ question: "¿Cuántas toneladas produjo El Teniente en marzo 2024?" }`
- WHEN `POST /api/text-query` is called
- THEN HTTP 200 is returned with `{ rows: [...], chartType: 'line'|'bar'|'none', insightText: "..." }`

#### Scenario: Missing question field returns 422

- GIVEN a POST body `{}` with no `question` field
- WHEN `POST /api/text-query` is called
- THEN HTTP 422 is returned with `{ error: "invalid_request" }`

#### Scenario: LLM infrastructure failure returns 500

- GIVEN all LLM providers are unavailable
- WHEN `POST /api/text-query` is called with a valid body
- THEN HTTP 500 is returned with `{ error: "llm_unavailable" }`

---

### Requirement: i18n — textQuery Keys

The system MUST add all user-facing text-query strings under the `textQuery.*` namespace in both `messages/es.json` and `messages/en.json`. Required keys at minimum: `textQuery.placeholder`, `textQuery.submit`, `textQuery.loading`, `textQuery.emptyState`, `textQuery.error.parseFailure`, `textQuery.error.unsupportedMetric`, `textQuery.error.mineNotFound`, `textQuery.error.llmUnavailable`, `textQuery.insight`. Key parity MUST be enforced by `src/i18n/messages.test.ts`.

#### Scenario: All keys present in both catalogs

- GIVEN the list of `textQuery.*` keys used in QueryPanel components
- WHEN `messages/es.json` and `messages/en.json` are inspected
- THEN every key exists in both files with a non-empty string value

#### Scenario: Parity test catches missing key

- GIVEN a `textQuery.*` key is added to `es.json` but omitted from `en.json`
- WHEN `pnpm test` runs the parity test in `src/i18n/messages.test.ts`
- THEN the test fails with a descriptive error naming the missing key

---

### Requirement: TDD — Unit and Integration Tests

The system MUST have unit tests for `intent-schema.ts`, `intent-parser.ts`, `query-builder.ts`, and `chart-heuristic.ts`, and a route integration test for `route.ts`. All tests MUST mock the Supabase client and LLM chain. Tests MUST follow RED → GREEN discipline under Strict TDD mode.

#### Scenario: Unit tests pass for all logic-layer modules

- GIVEN the logic layer implementation is complete
- WHEN `pnpm test` runs
- THEN all tests in `src/lib/text-query/*.test.ts` pass with zero skipped assertions

#### Scenario: Route integration test covers error paths

- GIVEN the route handler test mocks both LLM and Supabase
- WHEN `pnpm test` runs
- THEN tests for parse failure, mine-not-found, and LLM failure paths all pass

#### Scenario: No real network calls in tests

- GIVEN test files mock `createLlmChain` and `createSupabaseServerClient`
- WHEN tests run without environment variables set
- THEN no test fails due to missing env vars or network errors

---

### Non-Goals

- Multi-turn conversation or chat history
- Streaming LLM responses
- Fuzzy or approximate mine name matching
- Natural-language relative date parsing ("last quarter", "this year")
- Authentication or authorization
- New database schema migrations
