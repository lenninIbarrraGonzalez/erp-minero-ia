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
