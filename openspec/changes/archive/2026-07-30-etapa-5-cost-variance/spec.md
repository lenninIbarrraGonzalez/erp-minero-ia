# cost-variance Specification

## Purpose

Expose month-over-month cost delta decomposed by the 4 fixed drivers (fuel, supplies, equipment, labor) for a single mine, plus an LLM-narrated one-sentence explanation. Operators select mine + month and receive deterministic driver-level deltas and a narrative.

---

## Requirements

### Requirement: DriverDelta Schema

The system MUST represent each driver delta as an object conforming to `DriverDelta`:

| Field | Type | Constraint |
|---|---|---|
| `driver` | `'fuel' \| 'supplies' \| 'equipment' \| 'labor'` | one of 4 values |
| `currentAmount` | `number` | >= 0 |
| `priorAmount` | `number` | >= 0 |
| `delta` | `number` | `currentAmount - priorAmount` |
| `deltaPct` | `number \| null` | null when `priorAmount === 0` |

A Zod schema MUST enforce all constraints at runtime.

#### Scenario: valid driver delta

- GIVEN a driver entry with priorAmount > 0
- WHEN the delta is computed
- THEN `delta === currentAmount - priorAmount` AND `deltaPct === (delta / priorAmount) * 100`

#### Scenario: prior amount is zero

- GIVEN a driver entry with `priorAmount === 0`
- WHEN the delta is computed
- THEN `deltaPct` MUST be `null` and `delta === currentAmount`

---

### Requirement: CostVarianceResult Schema

The system MUST produce a result conforming to `CostVarianceResult`:

| Field | Type |
|---|---|
| `mineId` | `string` (UUID) |
| `mineName` | `string` |
| `period` | `string` (ISO date, first of month) |
| `comparisonPeriod` | `string` (ISO date, first of month) |
| `drivers` | `DriverDelta[]` — exactly 4 entries |
| `totalCurrent` | `number` |
| `totalPrior` | `number` |
| `totalDelta` | `number` |
| `totalDeltaPct` | `number \| null` |
| `narrative` | `string` |

A Zod schema MUST enforce all constraints at runtime.

#### Scenario: four drivers always present

- GIVEN a mine with entries for only 2 drivers in the requested period
- WHEN the result is built
- THEN all 4 drivers MUST appear with `currentAmount: 0` or `priorAmount: 0` for the missing ones

#### Scenario: total delta pct when prior total is zero

- GIVEN `totalPrior === 0`
- WHEN totalDeltaPct is computed
- THEN `totalDeltaPct` MUST be `null`

---

### Requirement: Variance Calculator (Deterministic)

The system MUST provide a pure, deterministic function that fetches `cost_entries` for `period` and `comparisonPeriod` for a given `mineId`, groups by driver, computes delta and deltaPct per driver, zero-fills missing drivers, and returns a partial `CostVarianceResult` (without `narrative`).

#### Scenario: normal two-period comparison

- GIVEN valid `mineId`, `period`, and `comparisonPeriod` with entries in both periods
- WHEN the calculator runs
- THEN it returns exactly 4 `DriverDelta` entries and correct `totalCurrent`, `totalPrior`, `totalDelta`

#### Scenario: injected anomaly surfaces as top driver

- GIVEN a mine with a fuel spike in the current period (significantly higher than prior)
- WHEN the calculator runs
- THEN the fuel `DriverDelta` shows the largest absolute `delta` among all drivers

#### Scenario: driver absent in one period

- GIVEN a driver with no entries in the prior period but entries in the current period
- WHEN the calculator runs
- THEN `priorAmount === 0` and `deltaPct === null` for that driver

---

### Requirement: Variance Narrator (LLM, Server-Only)

The system MUST provide a server-only narrator that receives `CostVarianceResult` (without `narrative`), constructs a prompt, calls `llm.complete()` with max 150 tokens and temperature 0.3, and returns the resulting string as `narrative`.

The narrator MUST degrade gracefully: on any LLM error it MUST return `""` without throwing.

#### Scenario: successful narration

- GIVEN a valid `CostVarianceResult` (without narrative)
- WHEN the narrator calls `llm.complete()` and receives a response
- THEN it returns the response string as `narrative`

#### Scenario: LLM failure degrades to empty string

- GIVEN `llm.complete()` throws or rejects
- WHEN the narrator handles the error
- THEN it MUST return `""` and MUST NOT propagate the error

---

### Requirement: POST /api/cost-variance Route

The system MUST expose `POST /api/cost-variance` accepting:

```
{ mineId: string (UUID), period: string (ISO date), comparisonPeriod?: string (ISO date) }
```

`comparisonPeriod` defaults to the calendar month prior to `period` when omitted.

The route MUST return `CostVarianceResult` on success (HTTP 200).

The route MUST return the following errors with HTTP 422 or 500:

| Code | HTTP | Condition |
|---|---|---|
| `invalid_input` | 422 | Zod validation fails |
| `mine_not_found` | 422 | `mineId` not in `mines` table |
| `no_prior_period` | 422 | no `cost_entries` rows exist for `comparisonPeriod` |
| `llm_error` | 500 | narrator throws uncaught (MUST NOT happen; narrator degrades) |

Narrative failure alone MUST NOT produce a 500; `narrative: ""` is the degraded success response.

#### Scenario: valid request returns result

- GIVEN a valid `mineId` and `period` with entries in both the current and prior periods
- WHEN `POST /api/cost-variance` is called
- THEN the response is HTTP 200 with a valid `CostVarianceResult`

#### Scenario: missing comparisonPeriod defaults to prior month

- GIVEN a valid request body with no `comparisonPeriod`
- WHEN the route processes the request
- THEN `comparisonPeriod` is set to the first day of the calendar month before `period`

#### Scenario: invalid input returns 422

- GIVEN a request body with `mineId` not matching UUID format
- WHEN the route validates input
- THEN HTTP 422 with `{ code: "invalid_input" }` is returned

#### Scenario: unknown mine returns 422

- GIVEN a valid UUID `mineId` that does not exist in the `mines` table
- WHEN the route processes the request
- THEN HTTP 422 with `{ code: "mine_not_found" }` is returned

#### Scenario: first month returns 422

- GIVEN a `mineId` and `period` where no entries exist for `comparisonPeriod`
- WHEN the route processes the request
- THEN HTTP 422 with `{ code: "no_prior_period" }` is returned

#### Scenario: LLM error does not produce 500

- GIVEN `llm.complete()` throws during narration
- WHEN the route completes
- THEN HTTP 200 is returned with `narrative: ""` and complete driver breakdown

---

### Requirement: CostVariancePanel Client Component

The system MUST provide a `"use client"` React component `CostVariancePanel` that:

- Uses `useState` and `useTransition` for state management.
- Calls `fetch("/api/cost-variance")` on submit.
- Renders loading, error, and empty states.
- Composes three sub-components: `CostVarianceInput`, `CostVarianceResults`, and the panel orchestrator.

`CostVarianceInput` MUST render a mine selector (`<select>`) and a month picker (`<input type="month">`) plus a submit button.

`CostVarianceResults` MUST render:
- A 4-row driver table with columns: driver | prior | current | delta | delta%.
- A grouped `BarChart` visualizing all drivers.
- A narrative paragraph.

#### Scenario: submit triggers fetch and shows results

- GIVEN the user selects a mine and a month then clicks submit
- WHEN the fetch resolves with a valid `CostVarianceResult`
- THEN the driver table, chart, and narrative are displayed

#### Scenario: loading state is shown during fetch

- GIVEN the user has submitted
- WHEN the fetch is in-flight
- THEN a loading indicator is visible and the submit button is disabled

#### Scenario: error state is shown on fetch failure

- GIVEN the fetch returns a non-200 response
- WHEN the component processes the response
- THEN an error message is displayed using the `costVariance.error` i18n key

#### Scenario: no_prior_period error is user-friendly

- GIVEN the API returns `{ code: "no_prior_period" }`
- WHEN the component processes the error
- THEN the `costVariance.noPriorPeriod` i18n key is displayed (not a generic error)

---

### Requirement: i18n Key Parity

The system MUST add the following keys to BOTH `messages/es.json` and `messages/en.json` in parity:

`costVariance.title`, `costVariance.selectMine`, `costVariance.selectPeriod`, `costVariance.submit`, `costVariance.loading`, `costVariance.error`, `costVariance.driver`, `costVariance.prior`, `costVariance.current`, `costVariance.delta`, `costVariance.deltaPct`, `costVariance.narrative`, `costVariance.noPriorPeriod`

An existing automated messages parity test MUST cover these keys and remain green.

#### Scenario: all keys present in both locales

- GIVEN `messages/es.json` and `messages/en.json` are loaded
- WHEN the parity test runs
- THEN all 13 `costVariance.*` keys exist in both files with non-empty string values
