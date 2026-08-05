# Spec: Etapa 6 — Design System, App Shell & Smoke E2E

<!-- Three new capability specs: design-system (PR 6a), app-shell (PR 6b), e2e-smoke (PR 6c) -->

---

# design-system Specification

## Purpose

Establish a single Odoo-light design token layer and reusable UI primitives
(Card, Button, Badge) so all components draw from one palette source of truth.
Chart colors MUST also resolve through tokens, not hardcoded literals.

## Requirements

### Requirement: Design Token Layer

The system MUST define all color and radius values as CSS custom properties in
`src/app/globals.css` using the approved Odoo light palette. No component or
stylesheet outside `globals.css` SHALL declare these values directly.

Required tokens (exact values):

| Token | Value |
|-------|-------|
| `--color-bg` | `#F8F8F8` |
| `--color-surface` | `#FFFFFF` |
| `--color-surface-2` | `#F0F0F0` |
| `--color-border` | `#E2E8F0` |
| `--color-text` | `#212B36` |
| `--color-text-muted` | `#6B7280` |
| `--color-primary` | `#714B67` |
| `--color-primary-hover` | `#5C3D54` |
| `--color-primary-contrast` | `#FFFFFF` |
| `--color-positive` | `#00875A` |
| `--color-negative` | `#DE350B` |
| `--color-warning` | `#FF8B00` |
| `--radius` | `0.5rem` |

#### Scenario: Token file defines all required variables

- GIVEN the app CSS is loaded
- WHEN `getComputedStyle(document.documentElement).getPropertyValue('--color-primary')` is called
- THEN the resolved value MUST equal `#714B67` (trimmed)

#### Scenario: No hardcoded color class remains in refactored components

- GIVEN a static analysis pass over refactored component files
- WHEN searching for `bg-amber-600`, `text-red-600`, `#d97706`, or similar Tailwind color utilities not mapped to a token
- THEN zero matches are found in any file under `src/components/` or `src/app/`

---

### Requirement: Card Primitive

The system MUST provide a `Card` component at `src/components/ui/card.tsx` that
renders a surface container using `--color-surface`, `--color-border`, and
`--radius` tokens. It MUST accept `children` and an optional `className` prop.

#### Scenario: Card renders with token-based styles

- GIVEN the Card component is mounted in a test
- WHEN rendered with no extra props
- THEN the root element carries classes or inline styles that resolve to `background: var(--color-surface)` and `border-radius: var(--radius)`

#### Scenario: Card accepts and forwards className

- GIVEN the Card component is mounted with `className="mt-4"`
- WHEN the DOM is queried
- THEN the root element includes both the base token class and `mt-4`

---

### Requirement: Button Primitive

The system MUST provide a `Button` component at `src/components/ui/button.tsx`
with three visual variants: `primary`, `secondary`, and `ghost`. The `primary`
variant MUST use `--color-primary` as background and `--color-primary-contrast`
as text. The component MUST be keyboard-accessible and forward `onClick` and
`disabled` props.

#### Scenario: Primary variant renders with primary token colors

- GIVEN a Button with `variant="primary"` is mounted
- WHEN rendered
- THEN it carries a class/style that maps to `background: var(--color-primary)` and `color: var(--color-primary-contrast)`

#### Scenario: Disabled button is not interactive

- GIVEN a Button with `disabled={true}` is mounted
- WHEN a click event is dispatched
- THEN the `onClick` handler is NOT called
- AND the element has `aria-disabled` or the native `disabled` attribute

#### Scenario: Ghost variant has no background fill

- GIVEN a Button with `variant="ghost"` is mounted
- WHEN rendered
- THEN it does not carry the primary background class/style

---

### Requirement: Badge Primitive

The system MUST provide a `Badge` component at `src/components/ui/badge.tsx`
that renders an inline label. It MUST support at least `positive`, `negative`,
and `warning` color intents mapped to the corresponding design tokens.

#### Scenario: Positive badge uses positive token

- GIVEN a Badge with `intent="positive"` is mounted
- WHEN rendered
- THEN its computed color resolves to `var(--color-positive)` or `#00875A`

#### Scenario: Negative badge uses negative token

- GIVEN a Badge with `intent="negative"` is mounted
- WHEN rendered
- THEN its computed color resolves to `var(--color-negative)` or `#DE350B`

---

### Requirement: Token-Driven Chart Colors

Chart color props MUST resolve through the design token layer at runtime. No
component SHALL pass a hardcoded hex string as a Recharts color prop. A helper
MUST read `getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim()`
(or the relevant token) client-side and pass the resolved value to Recharts.

#### Scenario: Chart renders with resolved token color

- GIVEN the dashboard chart component is mounted with the DOM providing token values
- WHEN the chart helper resolves `--color-primary`
- THEN the value passed to the Recharts `fill` or `stroke` prop equals the resolved CSS variable value, not a hardcoded literal

#### Scenario: Token change propagates to chart color

- GIVEN `--color-primary` is overridden to `#FF0000` in the test DOM
- WHEN the chart helper is called
- THEN it returns `#FF0000`, not the default `#714B67`

---

# app-shell Specification

## Purpose

Provide a persistent Odoo-style left sidebar (`AppShell`) wired into the root
layout, hosting the app logo, static nav items, and the mine selector. The
sidebar eliminates the inline `MineSelector` duplication in `page.tsx`.

## Requirements

### Requirement: AppShell Component

The system MUST provide an `AppShell` component at
`src/components/shell/app-shell.tsx` that renders a left sidebar containing:
the app name/logo, static nav links (Dashboard, Cost Variance), and the
`MineSelector`. It MUST accept `children` and render them as the main content
area alongside the sidebar.

#### Scenario: Sidebar renders app name and nav links

- GIVEN AppShell is mounted
- WHEN queried by accessible role
- THEN a `navigation` landmark is present
- AND it contains links with text matching the app-name and nav-item i18n keys

#### Scenario: Main content area renders children

- GIVEN AppShell is mounted with `<p>content</p>` as children
- WHEN the DOM is queried
- THEN the text "content" is visible in the main content region

#### Scenario: MineSelector appears once in the shell

- GIVEN AppShell is mounted
- WHEN the DOM is queried for MineSelector
- THEN exactly one MineSelector instance is rendered

---

### Requirement: Root Layout Adopts AppShell

The root `src/app/layout.tsx` MUST wrap all page content in `AppShell`.
`src/app/page.tsx` MUST NOT render a standalone `MineSelector` after this
change — the shell owns it.

#### Scenario: Page tree has no duplicate MineSelector

- GIVEN the app renders the dashboard page via layout + page
- WHEN the rendered output is scanned for MineSelector
- THEN exactly one instance appears (inside AppShell)

#### Scenario: Page content renders within shell main area

- GIVEN the dashboard page route is rendered
- WHEN the DOM is inspected
- THEN KPI cards and chart panels appear inside the main content region provided by AppShell

---

### Requirement: Component Refactor to Primitives

`query-input` and `cost-variance-input` MUST use the `Button` primitive.
`cost-variance-results` MUST use `text-positive` / `text-negative` token
classes instead of hardcoded Tailwind color utilities.

#### Scenario: query-input submit uses Button primitive

- GIVEN query-input is mounted
- WHEN the DOM is queried for the submit control
- THEN it is rendered via the `Button` component (carries Button's base class or test-id)

#### Scenario: cost-variance-results applies token classes for positive value

- GIVEN cost-variance-results displays a positive variance
- WHEN the DOM is inspected
- THEN the value element carries a class that resolves to `var(--color-positive)`, not `text-green-*` or a raw hex

---

### Requirement: Shell i18n Keys

The system MUST add translation keys for the app name and nav items to both
`messages/es.json` and `messages/en.json`. The orphaned `home.subtitle` key
MUST be removed from both catalogs after verifying zero JSX/TSX usages. The
`textQuery.insight.label` key MUST be consumed by its corresponding component.

#### Scenario: Shell nav keys present in both catalogs

- GIVEN `messages/es.json` and `messages/en.json` are read
- WHEN searching for the shell app-name key (e.g. `shell.appName`)
- THEN the key exists in both files with non-empty values

#### Scenario: Orphaned home.subtitle key is absent

- GIVEN both catalog files are read
- WHEN searching for `home.subtitle`
- THEN zero matches are found in `messages/es.json` and `messages/en.json`
- AND zero matches are found in any `*.tsx` / `*.ts` file under `src/`

#### Scenario: textQuery.insight.label is consumed

- GIVEN the text-query panel component is rendered
- WHEN the component displays an insight
- THEN it uses the `textQuery.insight.label` translation key, not a hardcoded string

---

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
