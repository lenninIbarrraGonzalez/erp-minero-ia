# Delta for Dashboard

## ADDED Requirements

### Requirement: Query Panel — UI Composition

The dashboard page (`src/app/page.tsx`) MUST render a `<QueryPanel>` Client Component in a new `<section>` below the charts grid. The `QueryPanel` MUST NOT receive mine data as props from the Server Component; it MUST independently fetch via `POST /api/text-query`. The dashboard Server Component layout MUST NOT change in any way other than appending this section.

#### Scenario: QueryPanel renders below charts grid

- GIVEN the dashboard page renders with the full layout
- WHEN the page HTML is inspected
- THEN a `<section>` containing the QueryPanel follows the charts grid section in document order

#### Scenario: Dashboard renders without QueryPanel interaction errors

- GIVEN the dashboard Server Component completes its data fetches
- WHEN the page renders with no question submitted
- THEN the QueryPanel displays its idle state (input + submit button) without errors

---

### Requirement: Query Panel — Input and Submission

The `QueryPanel` MUST contain a text input and a submit button. Submitting the form MUST POST `{ question }` to `/api/text-query` via `fetch`. While the request is in-flight, the panel MUST display a loading indicator. The submit button MUST be disabled during loading. The input MUST use the i18n key `textQuery.placeholder` for its placeholder text. The button MUST use `textQuery.submit`.

#### Scenario: User submits a question

- GIVEN the QueryPanel is in idle state
- WHEN the user types a question and clicks submit
- THEN a POST request is sent to `/api/text-query` with `{ question: "<typed text>" }`
- AND the loading indicator is shown while the request is in-flight

#### Scenario: Submit disabled during loading

- GIVEN a request is in-flight
- WHEN the submit button is inspected
- THEN it has the `disabled` attribute

#### Scenario: Empty question is not submitted

- GIVEN the text input is empty
- WHEN the user clicks submit
- THEN no POST request is sent

---

### Requirement: Query Panel — Results Display

After a successful response, the `QueryPanel` MUST render a data table with `rows`, an optional Recharts chart (when `chartType` is `'line'` or `'bar'`), and the `insightText` sentence. When `rows` is empty, it MUST display the i18n key `textQuery.emptyState`. When the API returns an error, it MUST display the appropriate `textQuery.error.*` message. The chart MUST be a Client Component. When `chartType` is `'none'`, no chart is rendered.

#### Scenario: Results table renders rows

- GIVEN the API returns `{ rows: [{ mine: "X", cost_per_tonne: 42 }], chartType: 'line', insightText: "..." }`
- WHEN the QueryPanel processes the response
- THEN a table with one data row is visible

#### Scenario: Line chart renders for line chartType

- GIVEN the API returns `chartType: 'line'`
- WHEN the results panel renders
- THEN a Recharts `LineChart` is present in the DOM

#### Scenario: Bar chart renders for bar chartType

- GIVEN the API returns `chartType: 'bar'`
- WHEN the results panel renders
- THEN a Recharts `BarChart` is present in the DOM

#### Scenario: No chart renders for none chartType

- GIVEN the API returns `chartType: 'none'`
- WHEN the results panel renders
- THEN no Recharts chart element is present

#### Scenario: Empty result shows empty state message

- GIVEN the API returns `{ rows: [], chartType: 'none', insightText: "" }`
- WHEN the results panel renders
- THEN the translated `textQuery.emptyState` string is visible

#### Scenario: Error response shows error message

- GIVEN the API returns `{ error: "mine_not_found" }` with HTTP 422
- WHEN the QueryPanel processes the response
- THEN the translated `textQuery.error.mineNotFound` string is visible
