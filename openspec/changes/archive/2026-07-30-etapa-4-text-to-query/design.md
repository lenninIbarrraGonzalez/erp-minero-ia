# Design: Etapa 4 — Text-to-Query

## Technical Approach

A `POST /api/text-query` Route Handler orchestrates a three-stage server-only
pipeline: **intent-parser** (LLM → JSON → Zod), **query-builder** (validated
intent → Supabase reads → client-side aggregation), and **insight-generator**
(second LLM call, degrades to `""`). A `chart-heuristic` pure function maps the
intent to a chart type. A client `<QueryPanel>` posts the question via `fetch`
using `useTransition` for loading state. Server-only factories
(`createLlmChain`, `createSupabaseServerClient`) stay inside the route. Mirrors
Etapa 3 (`/api/llm/complete`) and reuses the `dashboard.ts` query patterns
(`.from().select().eq()`, `error ?? !data` guards, `Number()` coercion,
in-memory aggregation via `Map`). See proposal `sdd/etapa-4-text-to-query/proposal`.

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|----------|--------|----------|-----------|
| ADR-1 Server boundary | Route Handler `POST /api/text-query` | Server Action | Mirrors Etapa 3; clean JSON contract; `vi.mock`-testable; server-only trivial |
| ADR-2 Intent parsing | LLM-only + Zod gate | LLM + regex fallback | Schema-in-prompt; Zod is the single validation gate; no parallel parser |
| ADR-3 Query build | Static per-metric functions `(db, intent)` | Dynamic SQL | 3 metrics only; type-safe, auditable, no injection surface |
| ADR-4 Mine resolution | `fetchMines` in route, exact case-insensitive match | DB-side `ILIKE` | 5-row table; reuses existing fetch; no fuzzy scope |
| ADR-5 Insight | 2nd `createLlmChain()` call post-query; failure → `""` | Combined single call | Separates structured parse from narration; graceful degrade |
| ADR-6 Client model | `<QueryPanel>` `fetch` + `useState` + `useTransition` | React Query / SWR | Single non-cached query; no new dependency |

Aggregation note: Supabase performs no `GROUP BY`/derived math here — the
builder aggregates rows in memory exactly like `fetchCostTrend`
(`cost_per_tonne = SUM(amount)/SUM(tonnage)` per period).

## Data Flow

    QueryInput ──POST {question, mineId?}──▶ route.ts
                                              │
              intent-parser (LLM→JSON→Zod) ◀──┤
                     │ ParsedIntent            │
              query-builder (Supabase→rows) ◀──┤  fetchMines → name→id
                     │ QueryResult             │
              chart-heuristic (pure) ──────────┤
              insight-generator (LLM, ""safe) ─┘
                                              │
    QueryResults ◀──{rows, chartType, insightText}──┘

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modify | Add `zod` (with 4a) |
| `src/lib/text-query/types.ts` | Create | `ParsedIntent`, `QueryResult`, `ChartType`, `TextQueryResponse` |
| `src/lib/text-query/intent-schema.ts` | Create | Zod schema for `ParsedIntent` |
| `src/lib/text-query/intent-parser.ts` | Create | LLM call, JSON parse + Zod validate |
| `src/lib/text-query/query-builder.ts` | Create | Metric dispatch → Supabase → aggregated rows |
| `src/lib/text-query/chart-heuristic.ts` | Create | Intent → `line \| bar \| none` |
| `src/lib/text-query/insight-generator.ts` | Create | 2nd LLM call → insight string |
| `src/lib/text-query/*.test.ts` | Create | Unit tests (4 files) |
| `src/app/api/text-query/route.ts` (+ test) | Create | POST orchestrator |
| `src/components/query-panel/*` (3 + test) | Create | input, results, panel |
| `src/app/page.tsx` | Modify | Add `<QueryPanel />` section below charts |
| `messages/{es,en}.json` | Modify | Add `textQuery.*` (parity enforced) |

## Interfaces / Contracts

```typescript
type ChartType = "line" | "bar" | "none";
type Metric = "cost_per_tonne" | "tonnage" | "cost_by_driver";

interface ParsedIntent {
  metric: Metric;
  mineName?: string;      // resolved to mineId in route via exact ci-match
  periodStart?: string;   // ISO YYYY-MM-DD
  periodEnd?: string;     // ISO YYYY-MM-DD
  driver?: "fuel" | "supplies" | "equipment" | "labor";
}
interface QueryResult { rows: Record<string, string | number>[]; }
interface TextQueryResponse {
  rows: QueryResult["rows"];
  chartType: ChartType;
  insightText: string;
}
// Request: { question: string; mineId?: string }
// Errors (i18n keys): 400 textQuery.error.invalidQuestion;
//   422 textQuery.error.unparseableIntent | mineNotFound;
//   503 textQuery.error.llmUnavailable
```

Intent parser prompt embeds the Zod schema and instructs JSON-only, zero prose;
LLM date phrases ("marzo", "March 2024") are converted to ISO by the model and
range-validated in the builder.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|--------------|----------|
| Unit | intent-parser: valid JSON, Zod fail, bad metric | `vi.mock` `createLlmChain` |
| Unit | query-builder: each metric rows, mine-not-found, empty | mock chainable Supabase |
| Unit | chart-heuristic: all metric branches | pure, no mocks |
| Unit | insight-generator: happy + LLM failure → `""` | `vi.mock` LLM |
| Integration | route: full pipeline, 422/503 status | mock the 3 modules |
| Component | query-panel: loading, result, error | `vi.mock` `fetch` |

Strict TDD: each module gets a RED test before implementation.

## Threat Matrix

N/A — no routing (framework-standard Route Handler only), shell, subprocess,
VCS/PR automation, executable-file classification, or process-integration
boundary. LLM output is validated by Zod and never executed; queries use static
parameterized builders (no dynamic SQL/injection surface).

## Migration / Rollout

No migration required. Both slices additive; no schema/DB changes. Revert 4b →
dashboard charts-only; revert 4a → remove logic layer + `zod`.

## Open Questions

- None blocking. Date-phrase→ISO conversion accuracy is an LLM-quality risk,
  mitigated by builder-side range validation (assumption to validate in verify).
