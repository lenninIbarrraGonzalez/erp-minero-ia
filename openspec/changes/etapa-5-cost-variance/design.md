# Design: Cost Variance Explainer (Etapa 5)

## Technical Approach

Hexagonal-lite, mirroring the Etapa 4 text-query slice. The domain module `src/lib/cost-variance/` is pure TypeScript with **no framework imports** (no `next/*`, no React). `route.ts` is the composition root: it owns `import "server-only"`, instantiates Supabase + LLM, validates input with Zod, calls the pure calculator, then the narrator, assembles `CostVarianceResult`, and serializes to JSON. The client `cost-variance-panel/` only fetches and renders. Two deterministic period aggregations (N and N-1) feed a driver-delta computation over the fixed enum `['fuel','supplies','equipment','labor']` (zero-filled). The structured breakdown is handed to the LLM for one-sentence narration that degrades to `""` on any failure.

## Architecture Decisions

| Decision | Choice | Alternatives rejected | Rationale |
|----------|--------|-----------------------|-----------|
| Aggregation site | In-memory `Map` over two `.eq` selects | SQL `GROUP BY` / RPC | Matches existing `query-builder.ts`; no new DB objects; testable with mocked client |
| Period key | Route converts `{year,month}` → ISO first-of-month `YYYY-MM-01`; `.eq("period", iso)` | Store year/month | `period` is SQL `date`; single equality is exact and index-friendly |
| First-month | Prior select empty → throw `no_prior_period` → HTTP 422 | Compare vs zero | Zero baseline invents 100% deltas; explicit is honest (proposal-decided) |
| Δ% when prior=0 | `deltaPct = null`; keep absolute `delta` | Emit `Infinity`/`0` | Avoids divide-by-zero lie; UI renders `—` |
| mineId | Direct UUID from client, consumed in `.eq("mine_id", mineId)`, asserted in route test | NL name resolution | Fixes Etapa 4 W2 (injected-but-unused); no dead param |
| Narrator failure | try/catch → `""`; breakdown still returned 200 | 500 on LLM error | LLM is non-critical; deterministic core must survive |
| UI | Standalone `CostVariancePanel` | Merge into query-panel | Distinct input (mine+month pickers vs free-text) |

## Data Flow

    CostVariancePanel ──POST {mineId, period:{year,month}}──▶ route.ts
         (client)                                              │ Zod validate → iso
                                                               ▼
                                       variance-calculator.ts (pure)
                                         ├─ select period=N   ─┐
                                         ├─ select period=N-1 ─┤ 2× .eq
                                         └─ Map aggregate, zero-fill, deltas
                                                               │ breakdown
                                                               ▼
                                          variance-narrator.ts (LLM, try/catch→"")
                                                               │ narration
                                                               ▼
                                       CostVarianceResult ──JSON 200──▶ panel renders
                                       (422 no_prior_period / 500 internal)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/cost-variance/types.ts` | Create | Zod schemas + inferred `DriverDelta`, `CostVarianceResult`, error codes |
| `src/lib/cost-variance/variance-calculator.ts` | Create | Pure two-period aggregation + delta math |
| `src/lib/cost-variance/variance-narrator.ts` | Create | LLM narration, degrades to `""` |
| `src/app/api/cost-variance/route.ts` | Create | POST composition root, `import "server-only"` |
| `src/components/cost-variance-panel/cost-variance-input.tsx` | Create | Mine `<select>` + year/month pickers |
| `src/components/cost-variance-panel/cost-variance-results.tsx` | Create | Delta table + BarChart + narration |
| `src/components/cost-variance-panel/cost-variance-panel.tsx` | Create | State orchestrator, fetch, loading/error |
| `src/app/page.tsx` | Modify | Mount panel, pass server-fetched `mines` prop |
| `messages/es.json`, `messages/en.json` | Modify | `costVariance.*` keys, es/en parity |
| `*.test.ts(x)` per module | Create | Unit + route + panel tests |

## Interfaces / Contracts

```ts
export const DRIVERS = ["fuel", "supplies", "equipment", "labor"] as const;

export interface DriverDelta {
  driver: (typeof DRIVERS)[number];
  current: number;   // period N sum
  prior: number;     // period N-1 sum
  delta: number;     // current - prior
  deltaPct: number | null; // null when prior === 0
  share: number;     // signed contribution to totalDelta, 0 when totalDelta===0
}
export interface CostVarianceResult {
  breakdown: DriverDelta[]; // always 4, DRIVERS order
  totalDelta: number;
  narration: string;        // "" on LLM failure
}
// request Zod: { mineId: uuid, period: { year:int, month:int 1..12 } }
// errors: no_prior_period (422) | internal_error (500)
```

Calculator: `computeVariance(db, mineId, isoPeriod, isoPrior) → CostVarianceResult (narration="")`; narrator fills `narration`. Prompt: analyst persona + JSON breakdown, one sentence, `llm.complete(prompt, { maxTokens: 150, temperature: 0.3 })`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit calculator | 4 rows sum to totalDelta; zero-fill missing driver; prior=0 → `deltaPct null`; empty prior → throws `no_prior_period`; fuel-shock top driver | `vi.fn()` Supabase stub returning `{ data }` per `.eq` call |
| Unit narrator | success trims text; thrown LLM → `""` | `vi.fn()` LLM `complete` resolve/reject |
| Route | 200 shape; **mineId reaches `.eq("mine_id")`** (assert on mock); Zod 422; first-month 422; LLM fail still 200 | `vi.mock` calculator/narrator + Supabase client |
| Component | panel loading→results, error branch, `deltaPct null` renders `—`, mines prop populates select | RTL + happy-dom, mocked `fetch` |
| i18n | es/en `costVariance.*` parity | existing messages parity test |

## Threat Matrix

N/A — no routing beyond a standard Next.js route handler, no shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. Input is validated with Zod; Supabase parameterizes queries.

## Review Workload Forecast

- **400-line budget risk: Medium**
- **Chained PRs recommended: Yes**
- **Decision needed before apply: No** (strategy `ask-on-risk` default; two clean work units already identified)

Split into two chained PRs by work unit:

- **PR 5a — domain + route** (`src/lib/cost-variance/*`, `src/app/api/cost-variance/route.ts` + tests). Independent: deterministic core + endpoint verifiable via route test alone. ~250–300 lines.
- **PR 5b — client + integration** (`src/components/cost-variance-panel/*`, `src/app/page.tsx`, `messages/{es,en}.json` + tests). Depends on 5a endpoint contract. ~250 lines.

Feature Branch Chain: 5b targets 5a's branch; retarget until diff is clean.

## Migration / Rollout

No migration required. No schema changes. Rollback = delete the three new directories and the `costVariance.*` keys; dashboard and text-query untouched.

## Open Questions

None blocking. Assumption: `page.tsx` already fetches `mines` (`fetchMines`) and passes them as a prop to the panel, avoiding a duplicate mines fetch client-side.
