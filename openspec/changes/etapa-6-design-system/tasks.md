# Tasks: Etapa 6 — Design System, App Shell & Smoke E2E

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~650 (6a ~200, 6b ~250, 6c ~200) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 6a → PR 6b → PR 6c |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 6a | Design tokens + UI primitives | PR 6a | `pnpm test` (RTL: card, button, badge, useChartColors) | `pnpm dev` → visual inspect palette + charts | Revert `globals.css`, delete `src/components/ui/`, `src/lib/`, restore chart hardcodes |
| 6b | App shell + component refactor | PR 6b | `pnpm test` (RTL: app-shell, sidebar, query-input, cost-variance-input, cost-variance-results) | `pnpm dev` → confirm sidebar + page renders | Revert `layout.tsx`, `page.tsx`, delete `src/components/shell/`, restore button/class usages |
| 6c | i18n polish + Playwright E2E | PR 6c | `pnpm test:e2e` (Playwright smoke suite) | `pnpm dev` then `pnpm test:e2e` | Delete `e2e/`, `playwright.config.ts`, revert `messages/*.json`, restore `package.json` scripts |

---

## PR 6a — Design Tokens + UI Primitives

### Phase 6a-1: Foundation

- [x] 6a-1.1 Create `src/lib/cn.ts` — export `cn(...classes: string[]) => string` using clsx (or hand-rolled join if clsx absent) [NOTE: cn.ts not needed; manual join used in primitives]
- [x] 6a-1.2 Rewrite `:root` block in `src/app/globals.css` with all 13 fixed Odoo-light token values (--color-bg through --radius); keep existing `@theme inline` block intact
- [x] 6a-1.3 Add Tailwind utility classes `text-positive`, `text-negative`, `text-warning`, `bg-surface`, `text-muted` referencing the new tokens to `globals.css` (or verify @theme inline already maps them)

### Phase 6a-2: RED Tests — UI Primitives

- [x] 6a-2.1 **RED** Create `src/components/ui/card.test.tsx` — failing tests: renders children, applies base token class, merges extra `className`
- [x] 6a-2.2 **RED** Create `src/components/ui/button.test.tsx` — failing tests: primary variant carries primary-token class, ghost has no primary bg, disabled prevents onClick, aria-disabled present when disabled
- [x] 6a-2.3 **RED** Create `src/components/ui/badge.test.tsx` — failing tests: `intent="positive"` carries positive-token class, `intent="negative"` carries negative-token class, `intent="warning"` carries warning-token class
- [x] 6a-2.4 **RED** Create `src/hooks/use-chart-colors.test.ts` — failing tests: returns non-empty `primary`, `positive`, `negative` strings; returns overridden value when `getComputedStyle` stub returns custom value

### Phase 6a-3: GREEN — Implement UI Primitives

- [x] 6a-3.1 **GREEN** Create `src/components/ui/card.tsx` — `div` wrapper using manual join, accepts `children` + optional `className`; base class uses `bg-surface border border-border rounded`
- [x] 6a-3.2 **GREEN** Create `src/components/ui/button.tsx` — `ButtonProps = ButtonHTMLAttributes<button> & { variant?: 'primary'|'secondary'|'ghost'; size?: 'sm'|'md' }`; primary: primary-token bg + contrast text; ghost: transparent bg; forwards `onClick`, `disabled`, `aria-disabled`
- [x] 6a-3.3 **GREEN** Create `src/components/ui/badge.tsx` — `BadgeProps = { variant: 'positive'|'negative'|'neutral'; children }`; maps variant to corresponding token text + bg classes
- [x] 6a-3.4 **GREEN** Create `src/hooks/use-chart-colors.ts` — client hook (`'use client'`); reads `getComputedStyle(document.documentElement)` for `--color-primary`, `--color-positive`, `--color-negative`; returns `{ primary, positive, negative }` with SSR fallbacks

### Phase 6a-4: Chart Integration

- [x] 6a-4.1 **RED** Update `src/components/charts/cost-trend-chart.test.tsx` — add failing test: chart receives resolved string colors from mocked `useChartColors`, not hardcoded `#d97706`
- [x] 6a-4.2 **RED** Update `src/components/charts/cost-breakdown-chart.test.tsx` — same failing assertion pattern as 6a-4.1
- [x] 6a-4.3 **GREEN** Update `src/components/charts/cost-trend-chart.tsx` — import `useChartColors`, replace hardcoded hex props with hook values
- [x] 6a-4.4 **GREEN** Update `src/components/charts/cost-breakdown-chart.tsx` — same as 6a-4.3

### Phase 6a-5: KpiCard Badge Integration

- [x] 6a-5.1 **RED** Update existing `kpi-card.test.tsx` — add failing test: KpiCard renders `Badge` component for its status indicator instead of raw span with hardcoded color class
- [x] 6a-5.2 **GREEN** Update `src/components/kpi-card.tsx` — replace inline status-color span with `<Badge variant={...}>` using the new Badge primitive

---

## PR 6b — App Shell + Component Cleanup

> Base: feature/etapa-6-design-system (tracker). PR 6b branch targets PR 6a branch so diff shows only shell/refactor work.

### Phase 6b-1: RED Tests — Shell Components

- [x] 6b-1.1 **RED** Create `src/components/shell/app-shell.test.tsx` — failing tests: renders `navigation` landmark, contains app-name text, contains nav link texts (Dashboard, Cost Variance), renders children in main region, renders exactly one MineSelector
- [x] 6b-1.2 **RED** Create `src/components/shell/sidebar.test.tsx` — failing tests: renders logo/app name, renders nav links with correct hrefs, renders MineSelector slot

### Phase 6b-2: GREEN — Shell Components

- [x] 6b-2.1 **GREEN** Create `src/components/shell/sidebar.tsx` — Client Component (`"use client"`); renders app name "ERP Minero", nav links (Dashboard, Cost Variance), and `<MineSelector />` in the footer area
- [x] 6b-2.2 **GREEN** Create `src/components/shell/app-shell.tsx` — async Server Component; renders `<Sidebar />` + `<main>{children}</main>` in a flex row layout using `bg-bg` token

### Phase 6b-3: Layout Wiring

- [x] 6b-3.1 Update `src/app/layout.tsx` — import `AppShell`; fetch mines with `fetchMines`; wrap `{children}` in `<AppShell mines={mines}>`
- [x] 6b-3.2 Update `src/app/page.tsx` — remove inline `<header>` with title+MineSelector; wrap chart/panel sections with `<Card>` primitive; keep KPI/chart panels intact

### Phase 6b-4: Component Primitive Refactor

- [x] 6b-4.1 **RED** Create `src/components/query-panel/query-input.test.tsx` — failing test: submit button has no amber class, has bg-primary class
- [x] 6b-4.2 **RED** Create `src/components/cost-variance-panel/cost-variance-input.test.tsx` — same failing assertion as 6b-4.1
- [x] 6b-4.3 **RED** Create `src/components/cost-variance-panel/cost-variance-results.test.tsx` — failing test: positive delta carries `text-negative`, negative delta carries `text-positive`; no text-red/green-600
- [x] 6b-4.4 **GREEN** Update `src/components/query-panel/query-input.tsx` — replace native `<button>` with `<Button variant="primary">`
- [x] 6b-4.5 **GREEN** Update `src/components/cost-variance-panel/cost-variance-input.tsx` — replace native `<button>` with `<Button variant="primary">`
- [x] 6b-4.6 **GREEN** Update `src/components/cost-variance-panel/cost-variance-results.tsx` — replace `text-green-600` → `text-positive`, `text-red-600` → `text-negative`; extract `deltaClass()` pure function

---

## PR 6c — i18n Polish + Playwright E2E

> Base: PR 6b branch. PR 6c branch targets PR 6b branch so diff shows only i18n + E2E work.

### Phase 6c-1: i18n Audit

- [x] 6c-1.1 Grep `src/**/*.{ts,tsx}` for `home.subtitle` — confirm zero matches before deletion (document result)
- [x] 6c-1.2 Remove `home.subtitle` key from `messages/es.json` and `messages/en.json`
- [x] 6c-1.3 Add `shell.appName`, `shell.nav.dashboard`, `shell.nav.costVariance` keys to `messages/es.json`
- [x] 6c-1.4 Add same keys with English values to `messages/en.json`
- [x] 6c-1.5 Verify catalog parity: both files have identical top-level key sets (compare via script or manual inspection)

### Phase 6c-2: insight.label Wire-up

- [x] 6c-2.1 **RED** Create `src/components/query-panel/query-results.test.tsx` — 5 tests including failing: insight element displays text derived from `textQuery.insight.label` i18n key
- [x] 6c-2.2 **GREEN** Update `src/components/query-panel/query-results.tsx` — add insight label span using `t('insight.label')` from `useTranslations('textQuery')`

### Phase 6c-3: Playwright Setup

- [x] 6c-3.1 Install `@playwright/test` as devDependency: `pnpm add -D @playwright/test`
- [x] 6c-3.2 Create `playwright.config.ts` at repo root — configure `webServer: { command: 'pnpm dev', url: 'http://localhost:3000', reuseExistingServer: !process.env.CI }`, `use: { baseURL: 'http://localhost:3000' }`, output dir `e2e-results/`
- [x] 6c-3.3 Add `"test:e2e": "playwright test"` to `package.json` scripts

### Phase 6c-4: Smoke E2E Suite

- [x] 6c-4.1 Create `e2e/smoke.spec.ts` — test "dashboard loads without error": navigate to `/`, assert page has visible heading or title
- [x] 6c-4.2 Add test to `e2e/smoke.spec.ts` — "KPI cards present": assert main element visible
- [x] 6c-4.3 Add test to `e2e/smoke.spec.ts` — "sidebar navigation present": assert Dashboard nav text visible
- [x] 6c-4.4 Add test to `e2e/smoke.spec.ts` — "text-to-query panel present": assert first form element visible

### Phase 6c-5: Verification

- [x] 6c-5.1 Run `pnpm test` — all unit/RTL suites pass GREEN (230 tests, 37 files)
- [ ] 6c-5.2 Run `pnpm test:e2e` against local dev server — all smoke tests pass (requires running dev server with valid .env.local)
- [ ] 6c-5.3 Static analysis pass: grep `src/` for `text-red-600`, `text-green-600`, `#d97706`, `bg-amber-600` — remaining matches not in scope for PR 6c

---

## Cross-PR Notes

- PR 6a must merge before 6b work begins (Button/Badge/Card primitives are consumed in 6b).
- PR 6b must merge before 6c work begins (shell i18n keys from 6b are consumed in 6c specs).
- Rollback order: revert 6c → revert 6b → revert 6a restores prior state completely.
- `cn()` in `src/lib/cn.ts` is shared across all three PRs; create in 6a, never duplicate.
