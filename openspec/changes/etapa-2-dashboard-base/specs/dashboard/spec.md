# Dashboard Specification

## Purpose

Read-only KPI dashboard surfacing seeded mine production and cost data. Provides three KPI cards, a cost/tonne trend line chart, a cost breakdown bar chart, and a URL-driven mine selector. Data flows Server Component → serialized props → Client Components; no API routes, no client-side fetching.

## Requirements

### Requirement: Query Layer

The system MUST expose four pure async functions in `src/lib/queries/dashboard.ts`:
`fetchMines()`, `fetchKpiSummary(mineId?)`, `fetchCostTrend(mineId?)`, `fetchCostByDriver(mineId?)`.
Each function MUST return a typed POJO and MUST be unit-testable with a mocked Supabase client.
`cost_per_tonne` MUST be computed as `SUM(cost_entries.amount) / production_runs.tonnage` per mine per period.

#### Scenario: fetchMines returns list

- GIVEN the database contains seeded mine rows
- WHEN `fetchMines()` is called
- THEN it returns an array of `{ id: string; name: string }` with at least one entry
- AND the array includes an entry for every active mine in the seed

#### Scenario: fetchMines returns empty array on no data

- GIVEN the Supabase mock returns zero rows
- WHEN `fetchMines()` is called
- THEN it returns an empty array without throwing

#### Scenario: fetchKpiSummary with mine filter

- GIVEN a valid mine UUID `mineId`
- WHEN `fetchKpiSummary(mineId)` is called
- THEN it returns `{ totalTonnage: number; costPerTonne: number; mineName: string }`
- AND `costPerTonne` equals `SUM(amount) / tonnage` for that mine across available periods

#### Scenario: fetchKpiSummary without mine filter

- GIVEN no `mineId` argument
- WHEN `fetchKpiSummary()` is called
- THEN `mineName` is `null` (caller renders "All mines")
- AND `totalTonnage` and `costPerTonne` aggregate across all mines

#### Scenario: fetchCostTrend returns 12 data points

- GIVEN seeded data covering 12 months for a mine
- WHEN `fetchCostTrend(mineId)` is called
- THEN it returns an array of exactly 12 `{ month: string; costPerTonne: number }` objects in ascending chronological order

#### Scenario: fetchCostTrend empty mine

- GIVEN a `mineId` with no cost_entries rows
- WHEN `fetchCostTrend(mineId)` is called
- THEN it returns an empty array without throwing

#### Scenario: fetchCostByDriver returns driver breakdown

- GIVEN cost_entries rows with drivers: fuel, supplies, equipment, labor
- WHEN `fetchCostByDriver(mineId?)` is called
- THEN it returns an array of `{ driver: string; totalCost: number }` with one entry per distinct driver
- AND entries are filtered to `mineId` when provided, or aggregated across all mines otherwise

---

### Requirement: KPI Cards

The system MUST render three KPI cards using Tailwind CSS only (no Recharts). The cards MUST display:
- Total tonnage for the selected mine or all mines
- Average cost per tonne for the selected mine or all mines
- Selected mine name, or the i18n key resolving to "All mines" when no filter is active

All card labels MUST use next-intl translation keys present in both `messages/es.json` and `messages/en.json`.

#### Scenario: Cards render with mine filter

- GIVEN `?mine=<uuid>` is present in the URL
- WHEN the dashboard Server Component fetches data and renders
- THEN each KPI card displays values scoped to that mine
- AND the mine name card shows the mine's name string

#### Scenario: Cards render without mine filter

- GIVEN no `?mine` param in the URL
- WHEN the dashboard Server Component fetches data and renders
- THEN KPI values aggregate across all mines
- AND the mine name card displays the translated "All mines" label

#### Scenario: KPI labels resolve in both locales

- GIVEN the active locale is `es` or `en`
- WHEN the dashboard page renders
- THEN every KPI card label resolves to a non-empty translated string

---

### Requirement: Mine Selector

The system MUST render a mine selector as a Client Component (`"use client"`) that lists all mines plus an "All mines" option. Selecting an option MUST update the URL search param `?mine=<uuid>` (or clear it for "All mines"), triggering a Server Component re-render. The selector MUST read its initial value from the current URL param.

#### Scenario: Selector populates mine list

- GIVEN `fetchMines()` returns 5 mines
- WHEN the mine selector renders
- THEN the dropdown contains 6 options: "All mines" + 5 mine names

#### Scenario: Selecting a mine updates URL

- GIVEN the mine selector is rendered with no active filter
- WHEN the user selects a mine from the dropdown
- THEN the URL updates to `?mine=<selected-uuid>` without a full page reload navigation stack push (SHOULD use `router.replace`)

#### Scenario: Selecting "All mines" clears URL param

- GIVEN `?mine=<uuid>` is the current URL
- WHEN the user selects "All mines"
- THEN the `?mine` param is removed from the URL

#### Scenario: Selector reflects current URL on mount

- GIVEN `?mine=<uuid>` is already in the URL
- WHEN the mine selector mounts
- THEN the dropdown shows the matching mine as the selected option

---

### Requirement: Cost Trend Chart

The system MUST render a Recharts `LineChart` displaying `cost_per_tonne` over 12 months for the selected mine (or all mines). The chart component MUST be a Client Component (`"use client"`). It MUST NOT be rendered server-side (SSR). Chart axis and tooltip labels MUST use next-intl translation keys.

#### Scenario: Trend chart renders 12-month series

- GIVEN serialized trend data with 12 monthly points is passed as props
- WHEN the `CostTrendChart` Client Component renders
- THEN a `LineChart` with 12 data points is present in the DOM

#### Scenario: Trend chart renders empty state

- GIVEN an empty trend data array is passed as props
- WHEN the `CostTrendChart` renders
- THEN no chart error is thrown and an empty-state message is displayed

#### Scenario: Trend chart is client-only

- GIVEN the component file begins with `"use client"`
- WHEN TypeScript compilation runs
- THEN no RSC boundary violation is reported

---

### Requirement: Cost Breakdown Chart

The system MUST render a Recharts `BarChart` displaying total cost by driver (fuel, supplies, equipment, labor) for the selected mine or latest available period across all mines. The chart component MUST be a Client Component (`"use client"`). Bar labels MUST use next-intl translation keys.

#### Scenario: Breakdown chart renders one bar per driver

- GIVEN serialized breakdown data with 4 driver entries
- WHEN the `CostBreakdownChart` Client Component renders
- THEN the chart contains exactly 4 bars

#### Scenario: Breakdown chart renders empty state

- GIVEN an empty breakdown array is passed as props
- WHEN the `CostBreakdownChart` renders
- THEN no error is thrown and an empty-state indicator is visible

---

### Requirement: i18n Coverage

All user-visible strings on the dashboard MUST be referenced via next-intl translation keys. Both `messages/es.json` and `messages/en.json` MUST include every dashboard key. No hardcoded English strings in JSX.

#### Scenario: All keys present in both catalogs

- GIVEN the list of dashboard i18n keys used in components
- WHEN `messages/es.json` and `messages/en.json` are inspected
- THEN every key exists in both files with a non-empty value

#### Scenario: Missing key falls back gracefully

- GIVEN a key is present in `en.json` but absent in `es.json`
- WHEN the page renders in the `es` locale
- THEN next-intl falls back to the key string rather than throwing

---

### Requirement: Server Component Data Flow

The dashboard page (`src/app/page.tsx`) MUST be a Server Component. It MUST read `?mine` from `searchParams`, call the query layer, and pass serialized POJOs as props to Client Components. No Supabase calls MUST occur inside Client Components.

#### Scenario: Page passes serialized data to charts

- GIVEN the Server Component fetches trend and breakdown data
- WHEN it renders `CostTrendChart` and `CostBreakdownChart`
- THEN data is passed as plain serializable props (no promises, no Supabase client references)

#### Scenario: Invalid mine UUID in URL

- GIVEN `?mine=not-a-valid-uuid` is in the URL
- WHEN the Server Component calls the query layer
- THEN the query returns an empty/zero POJO and the page renders without a 500 error

---

### Requirement: TDD — Unit Tests for Query Layer

The system MUST have unit tests for `fetchMines()`, `fetchKpiSummary()`, `fetchCostTrend()`, and `fetchCostByDriver()` in `src/lib/queries/dashboard.test.ts`. Tests MUST mock the Supabase client. Tests MUST follow RED → GREEN discipline (failing test committed before implementation).

#### Scenario: All four functions have passing unit tests

- GIVEN the query layer implementation is complete
- WHEN `pnpm test` runs
- THEN all tests in `dashboard.test.ts` pass with zero skipped assertions

#### Scenario: Supabase is mocked — no real DB calls in tests

- GIVEN the test file uses a Supabase mock
- WHEN tests run in CI (no Supabase env vars)
- THEN no test fails due to missing environment variables or network errors
