# Verification Report: etapa-6-design-system

**Change**: etapa-6-design-system  
**Branch**: etapa-6/pr6c-e2e-i18n (commit 5ea5262)  
**Mode**: Strict TDD  
**Verdict**: FAIL — 4 CRITICAL issues block archive

---

## Build / Test Evidence

| Command | Exit Code | Result |
|---------|-----------|--------|
| `pnpm test` | 0 | 37 test files, 230 tests — all passing |
| `pnpm exec tsc --noEmit` | 2 | **4 TS errors** in `cost-variance-results.test.tsx` |
| `pnpm lint` | 1 | **2 errors** (sidebar.tsx `<a>` tags), 3 warnings |

---

## Spec Compliance Matrix

### design-system (PR 6a)

| Requirement | Status | Notes |
|-------------|--------|-------|
| globals.css: 13 Odoo-light tokens in :root | PASS | All 13 tokens with correct values |
| Card / Button / Badge in src/components/ui/ | PASS | All exist, all tests pass |
| useChartColors in src/hooks/ | PASS | Hook exists (deviation: not src/lib/hooks/ — acceptable) |
| cost-trend-chart / cost-breakdown-chart use hook | PASS | Both use useChartColors().primary |
| query-results.tsx charts use token | FAIL | Lines 88, 101: `stroke="#d97706"`, `fill="#d97706"` hardcoded |
| cost-variance-results bar chart uses token | FAIL | Line 102: `fill="#d97706"` hardcoded in Bar |
| KpiCard uses Badge primitive | PASS | Badge with variant prop |
| No text-red-600 / #d97706 in component files | FAIL | See CRITICAL issues 1-2 and WARNING 5 |

### app-shell (PR 6b)

| Requirement | Status | Notes |
|-------------|--------|-------|
| AppShell at src/components/shell/app-shell.tsx | PASS | |
| Sidebar at src/components/shell/sidebar.tsx | PASS | Nav items present |
| layout.tsx uses AppShell | PASS | Tests confirm |
| page.tsx uses Card, no inline card patterns | PASS | |
| query-input / cost-variance-input use Button | PASS | |
| cost-variance-results uses text-positive/text-negative | PASS | deltaClass() confirmed |
| Sidebar nav uses Link component | FAIL | `<a>` elements on lines 22, 29 (ESLint error) |

### e2e-smoke (PR 6c)

| Requirement | Status | Notes |
|-------------|--------|-------|
| home.subtitle absent from both JSONs and src/ | PASS | Zero matches |
| shell.* keys in both catalogs | PASS | appName + nav.dashboard + nav.costVariance |
| query-results.tsx renders t('insight.label') | PASS | Line 110 |
| playwright.config.ts at repo root | PASS | |
| e2e/smoke.spec.ts with ≥4 tests | PASS | 4 tests |
| package.json test:e2e script | PASS | `"playwright test"` |
| catalog.test.ts — JSON parity | PASS | 2 tests passing |
| E2E tests executed against dev server | WARNING | Not run — no dev server in apply context |

---

## Issues

### CRITICAL (4)

**C1 — Hardcoded `#d97706` in `query-results.tsx`**  
Lines 88 (`stroke="#d97706"`) and 101 (`fill="#d97706"`). Spec requires all Recharts color props to resolve through the design token layer. File: `src/components/query-panel/query-results.tsx`

**C2 — Hardcoded `#d97706` in `cost-variance-results.tsx`**  
Line 102: `<Bar dataKey="delta" fill="#d97706" />`. Same spec violation. File: `src/components/cost-variance-panel/cost-variance-results.tsx`

**C3 — TypeScript errors in `cost-variance-results.test.tsx`** (4 errors, TS2322)  
Test fixtures use `driver: string` but the domain type requires `driver: "fuel" | "supplies" | "equipment" | "labor"`. `tsc --noEmit` exits 2. File: `src/components/cost-variance-panel/cost-variance-results.test.tsx` lines 55, 61, 71, 81.  
Fix: add `as const` assertion on driver string literals or cast to the union type.

**C4 — ESLint errors in `sidebar.tsx`** (2 errors, @next/next/no-html-link-for-pages)  
`<a href="/">` and `<a href="/?panel=cost-variance">` must become `<Link>` from `next/link`. ESLint exits 1. File: `src/components/shell/sidebar.tsx` lines 22, 29.

### WARNING (4)

**W1 — Hardcoded `text-red-600` for error alert paragraphs**  
`cost-variance-panel.tsx:65` and `query-panel.tsx:62` render `className="text-sm text-red-600"` for error alerts. Not in direct spec scope (spec targets results component), but violates the "no hardcoded color utilities" principle.

**W2 — Playwright E2E tests not executed**  
`pnpm test:e2e` has never been run. Smoke specs are written and the browser is installed, but no dev server was available during apply. Runtime boot cannot be confirmed structurally.

**W3 — `--radius` token absent from `@theme inline` block**  
`--radius: 0.5rem` is in `:root` but not in `@theme inline`. Tailwind utilities that depend on it (e.g., `rounded-[var(--radius)]`) may not resolve through the Tailwind token path.

**W4 — Badge prop is `variant`, spec used `intent`**  
Design spec described `intent="positive"`. Implementation uses `variant`. All call sites are internally consistent. Design deviation, no behavioral breakage.

### SUGGESTION (2)

**S1 — Dead variable in e2e/smoke.spec.ts**  
`const cards = ...` assigned but never used (line 20).

**S2 — Two `fetchMines` calls per render**  
layout.tsx and sidebar path each call fetchMines. Acceptable but worth consolidating in a future refactor.

---

## Task Completion Summary

| PR | Tasks | Status | Commit |
|----|-------|--------|--------|
| 6a | 17/17 | Complete | 240196c |
| 6b | 14/14 | Complete | 2264e46 |
| 6c | All | Complete | 5ea5262 |

Note: Tasks artifact in Engram shows PR 6b/6c unchecked. Apply-progress (obs #459) and code state both confirm all tasks complete. The tasks artifact was not updated post-apply.

---

## Next Recommended

`sdd-apply` — resolve the 4 CRITICAL issues, then re-run verify.

**Minimum fix set**:
1. `query-results.tsx`: add `useChartColors` hook, replace both `#d97706` literals with `chartColors.primary`
2. `cost-variance-results.tsx`: add `useChartColors` hook, replace `fill="#d97706"` with `chartColors.primary`
3. `cost-variance-results.test.tsx`: cast `driver` literals to `"fuel" | "supplies" | "equipment" | "labor"` (e.g., `driver: "fuel" as const`)
4. `sidebar.tsx`: replace `<a href="...">` with `<Link href="...">` from `next/link`
