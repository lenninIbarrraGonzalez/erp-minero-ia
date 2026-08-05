# e2e-smoke Specification

## Purpose

Install Playwright and provide a minimal smoke suite that asserts the app boots,
the dashboard loads, and core UI regions are present. Does NOT assert visual
correctness or data accuracy.

## Requirements

### Requirement: Playwright Installation and Configuration

The project MUST include `@playwright/test` as a dev dependency. A
`playwright.config.ts` MUST exist at the project root, configured with a
`webServer` block targeting `localhost:3000` so CI can start the dev server
before tests run.

#### Scenario: playwright.config.ts is present and valid

- GIVEN the repository root is inspected
- WHEN `playwright.config.ts` is read
- THEN it exports a valid Playwright config with `webServer.url` pointing to `http://localhost:3000`

#### Scenario: test:e2e script exists in package.json

- GIVEN `package.json` is read
- WHEN the `scripts` object is inspected
- THEN a `test:e2e` key is present with a value that invokes `playwright test`

---

### Requirement: Dashboard Smoke Test

A smoke spec at `e2e/smoke.spec.ts` MUST assert that the dashboard page loads
and the following elements are present: at least one KPI card, the mine
selector control, and the AI panel regions (text-query and cost-variance).
The spec MUST NOT assert on specific data values or visual appearance.

#### Scenario: Dashboard loads without error

- GIVEN a running Next.js dev server on port 3000
- WHEN Playwright navigates to `/`
- THEN the page title or heading is visible
- AND no unhandled console errors of type `error` are emitted during load

#### Scenario: KPI cards are present

- GIVEN the dashboard page has loaded
- WHEN Playwright queries for KPI card elements (by role, test-id, or aria-label)
- THEN at least one KPI card element is found in the DOM

#### Scenario: Mine selector is present

- GIVEN the dashboard page has loaded
- WHEN Playwright queries for the mine selector control
- THEN exactly one mine selector element is found

#### Scenario: AI panel regions are present

- GIVEN the dashboard page has loaded
- WHEN Playwright queries for the text-query panel and cost-variance panel
- THEN both panel regions are present in the DOM

---

### Requirement: i18n Key Audit Before Deletion

Before any i18n key is deleted from catalog files, the system MUST verify that
no `*.tsx` or `*.ts` file under `src/` references that key. This MUST be
confirmed via a grep/search pass covering both catalog files and all source
files simultaneously.

#### Scenario: home.subtitle deletion is safe

- GIVEN a search is run across `src/**/*.{ts,tsx}` for the string `home.subtitle`
- WHEN the search completes
- THEN zero matches are found, confirming the key is unused before deletion

#### Scenario: Catalog parity after key changes

- GIVEN both `messages/es.json` and `messages/en.json` are modified
- WHEN the set of top-level keys in each file is compared
- THEN both files have identical key sets (no key present in one catalog but absent in the other)
