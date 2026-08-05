# Design: Etapa 6 — Design System, App Shell & Smoke E2E

## Technical Approach

Presentation-only refactor across three chained PRs (6a→6b→6c). Tokens stay CSS
variables in `globals.css` exposed to Tailwind v4 via `@theme inline` (existing
mechanism — only raw `:root` values change). Primitives (`Card`/`Button`/`Badge`)
centralize the copy-pasted `bg-surface border border-border rounded-[var(--radius)]`
pattern already visible in `page.tsx`, `kpi-card.tsx`. Charts resolve tokens at
runtime via a `useChartColors()` client hook because Recharts SVG props take
literal strings, not `var(...)`. AppShell wraps `layout.tsx` as a Server Component
with a Client `MineSelector` island. No behavioral (query/variance/LLM) logic
changes.

## Architecture Decisions

| Decision | Options | Choice & Rationale |
|----------|---------|--------------------|
| Chart colors | (a) inline `var()` (b) hardcode (c) runtime hook | **(c) `useChartColors()`** — SVG ignores CSS-var cascade; hook reads `getComputedStyle(document.documentElement)` once, single source of truth stays the tokens. |
| className merge | (a) template strings (b) `clsx` (c) `clsx`+`tailwind-merge` | **(b) tiny local `cn()` in `src/lib/cn.ts`** using `clsx` only — no conflict-resolution need yet; avoids adding `tailwind-merge`. Keep zero-dep if `clsx` absent → hand-rolled join. |
| Shell composition | (a) Client shell (b) Server shell + Client island | **(b)** — sidebar is static; only `MineSelector` needs hooks. Preserves RSC streaming and matches existing `layout.tsx` async server pattern. |
| Radius application | (a) `rounded-[var(--radius)]` (b) map `--radius` into `@theme` `--radius` | **(a) keep existing inline util** — components already use it; not worth a Tailwind theme change this etapa. |
| Token palette | fixed Odoo light (given) | Overwrite `:root` values only; `@theme inline` mapping unchanged. `body` bg/text auto-follow. |

## Data Flow

    globals.css :root tokens  ──(@theme inline)──►  Tailwind utils (bg-primary…)
            │
            └──(getComputedStyle)──► useChartColors() ──► Recharts stroke/fill props

    layout.tsx ──► AppShell (RSC) ──► Sidebar (RSC) ──► MineSelector (Client)
                                  └──► {children} = page.tsx (RSC)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/globals.css` | Modify | Replace `:root` values with fixed light palette + `--color-primary-hover`, `--color-primary-contrast`. |
| `src/lib/cn.ts` | Create | `cn()` className merge helper. |
| `src/components/ui/card.tsx` | Create | `Card` primitive (surface+border+radius+`className`). |
| `src/components/ui/button.tsx` | Create | `Button` variants primary/secondary/ghost, size sm/md. |
| `src/components/ui/badge.tsx` | Create | `Badge` variants positive/negative/neutral. |
| `src/lib/hooks/use-chart-colors.ts` | Create | Client hook returning resolved hex tokens. |
| `src/components/charts/cost-trend-chart.tsx` | Modify | Use `useChartColors()`; drop `#d97706`. |
| `src/components/charts/cost-breakdown-chart.tsx` | Modify | Same. |
| `src/components/shell/app-shell.tsx` | Create | RSC layout: sidebar + main. |
| `src/components/shell/sidebar.tsx` | Create | Logo, nav items (static), hosts MineSelector. |
| `src/app/layout.tsx` | Modify | Wrap `{children}` in `<AppShell>`. |
| `src/app/page.tsx` | Modify | Adopt `Card`; remove header `MineSelector` (moves to sidebar). |
| `src/components/kpi-card.tsx` | Modify | Use `Card`. |
| `src/components/query-panel/query-input.tsx` | Modify | `bg-amber-600` → `Button`. |
| `src/components/query-panel/query-results.tsx` | Modify | `useChartColors()`; consume `textQuery.insight.label`. |
| `src/components/cost-variance-panel/cost-variance-input.tsx` | Modify | → `Button`. |
| `src/components/cost-variance-panel/cost-variance-results.tsx` | Modify | `text-red/green-600` → `text-negative/text-positive`. |
| `messages/{es,en}.json` | Modify | Remove `home.subtitle`; add `shell.*` keys; keep `insight.label`. |
| `playwright.config.ts` | Create | `webServer` on :3000, `reuseExistingServer: !CI`. |
| `e2e/smoke.spec.ts` | Create | Boot + heading + shell/panel presence assertions. |
| `package.json` | Modify | `test:e2e` script; `@playwright/test` devDep. |

## Interfaces / Contracts

```ts
// use-chart-colors.ts
function useChartColors(): { primary: string; positive: string; negative: string };
// button.tsx
type ButtonProps = React.ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md";
};
// badge.tsx
type BadgeProps = { variant?: "positive" | "negative" | "neutral"; children: ReactNode };
// card.tsx — <div> props + className merged via cn()
```

`useChartColors` reads on mount (client only); SSR renders chart container, color
applied after hydration — acceptable for smoke (asserts presence, not color).

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | Button variants, Badge variants, Card className merge, cn() | Vitest + @testing-library/react (happy-dom), assert classes/roles. |
| Unit | useChartColors returns non-empty strings | Render probe component; stub `getComputedStyle`. |
| Unit | i18n parity es/en; no `home.subtitle`; `insight.label` present | Assert key sets equal + specific keys. |
| E2E | App boots, heading + sidebar + panels visible | Playwright smoke, structure-only (no data values). |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file
classification, or process-integration boundary. Change is presentation + a
Playwright dev-server config that only runs `pnpm dev` locally/CI.

## Migration / Rollout

No data migration. Three chained PRs: 6a tokens+primitives (~200), 6b shell+refactor
(~250, consumes 6a), 6c i18n+Playwright (~200, needs 6b shell keys). Each
independently revertable; revert 6c→6b→6a restores prior state with no orphaned
imports. Recommend chained PRs (combined >400 lines).

## Open Questions

- [ ] Assumption (auto mode): sidebar nav items are static placeholders (Dashboard,
  Cost Variance) — no router targets exist yet. Confirm at review.
- [ ] Confirm `clsx` is acceptable as a runtime dep, else `cn()` hand-rolls the join.
