# Proposal: Etapa 6 — Design System, App Shell & Smoke E2E

## Intent

The dashboard works but looks ad hoc: dark amber tokens leak as hardcoded
`bg-amber-600` / `text-red-600` classes, card patterns are copy-pasted inline,
there is no navigation shell, and Recharts colors are string literals. Two i18n
keys are orphaned and there is zero E2E coverage. This etapa makes the product
visually coherent (LIGHT / Odoo style — **already decided**), reusable, and
smoke-tested before further feature work.

## Scope

### In Scope
- Replace `globals.css` tokens with the fixed Odoo light palette (bg, surface,
  border, text, primary `#714B67`, positive/negative/warning, radius).
- UI primitives: `Card`, `Button` (primary/secondary/ghost), `Badge`.
- Route chart colors through tokens (no hardcoded `#d97706`).
- `AppShell` with Odoo-style left sidebar (logo, nav, mine selector) wired into
  `layout.tsx`; `page.tsx` adopts primitives and drops duplicated MineSelector.
- Refactor `query-input`, `cost-variance-input` to `Button`;
  `cost-variance-results` to `text-positive` / `text-negative`.
- i18n: remove orphaned `home.subtitle`, consume `textQuery.insight.label`,
  add shell nav/app-name keys in both catalogs.
- Playwright: install, `playwright.config.ts`, `e2e/smoke.spec.ts`,
  `test:e2e` script.

### Out of Scope
- Any change to query-layer, cost-variance, or LLM behavioral requirements.
- Dark-mode / theme switching (single fixed light theme only).
- New dashboard features, charts, or data.
- E2E beyond smoke (dashboard loads, mine selector, panel presence).

## Capabilities

### New Capabilities
- `design-system`: color tokens, radius, and reusable Card/Button/Badge
  primitives plus token-driven chart colors.
- `app-shell`: persistent Odoo-style sidebar layout hosting nav and mine
  selector, applied via root layout.
- `e2e-smoke`: Playwright smoke suite verifying the app boots and core UI is present.

### Modified Capabilities
- None. `dashboard` and `text-query` behavioral requirements are unchanged; only
  presentation (classes, primitives, i18n key hygiene) is refactored.

## Approach

Deliver as three chained PRs sized to the review budget:
- **6a** tokens + primitives (~200 lines) — foundation, no layout move yet.
- **6b** App Shell + component cleanup (~250 lines) — consumes 6a primitives.
- **6c** i18n polish + Playwright smoke (~200 lines) — depends on shell nav keys.
Tokens stay CSS variables (Tailwind v4 CSS config); charts read the token value
rather than a literal so the palette has one source of truth.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/globals.css` | Modified | Odoo light palette tokens |
| `src/components/ui/*` | New | Card, Button, Badge |
| `src/components/shell/app-shell.tsx` | New | Sidebar layout |
| `src/app/layout.tsx`, `page.tsx` | Modified | Adopt shell + primitives |
| `*-input.tsx`, `cost-variance-results.tsx` | Modified | Use primitives/tokens |
| `messages/{es,en}.json` | Modified | Remove orphan, add shell keys |
| `playwright.config.ts`, `e2e/`, `package.json` | New/Modified | Smoke E2E |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Recharts cannot read CSS var directly | Med | Pass resolved token value as prop |
| Palette regressions across screens | Med | Smoke suite + visual pass per PR |
| Playwright needs running server in CI | Med | `webServer` in config on :3000 |
| i18n key removal breaks a hidden usage | Low | Grep before delete; both catalogs |

## Rollback Plan

Each PR is independently revertable. Reverting 6a restores prior tokens and
removes primitives; 6b/6c only consume them, so revert order 6c → 6b → 6a leaves
the app on the pre-etapa dark theme with no orphaned imports.

## Dependencies

- Fixed color decision (LIGHT / Odoo) — already made.
- `@playwright/test` devDependency (new).

## Success Criteria

- [ ] No hardcoded color classes/literals remain in refactored components.
- [ ] Card/Button/Badge used across dashboard and cost-variance screens.
- [ ] Sidebar shell renders with single mine selector; no duplicate.
- [ ] `home.subtitle` removed; `textQuery.insight.label` consumed; parity in both catalogs.
- [ ] `pnpm test` green; `pnpm test:e2e` smoke passes locally.
