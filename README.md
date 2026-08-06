# ERP Minero IA

AI-powered cost intelligence dashboard for mining operations. Operators query production costs, analyze month-over-month variance, and explore tonnage metrics using natural language — in English or Spanish.

---

## Features

- **Dashboard** — KPI cards (tonnage, cost/tonne), 12-month cost trend, per-driver cost breakdown
- **Text-to-Query** — Ask questions in plain language; LLM parses intent and returns a table + chart + one-line insight
- **Cost Variance Explainer** — Month-over-month driver decomposition (fuel, supplies, equipment, labor) with LLM narrative
- **Mine filter** — URL-driven selector; all charts and panels update together
- **Bilingual UI** — Full i18n in English and Spanish (`next-intl`)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Styling | Tailwind CSS 4, Odoo-light design tokens |
| Charts | Recharts 3 |
| Database | PostgreSQL 16 via Supabase (SSR SDK) |
| Validation | Zod 4 |
| LLM | Groq / OpenRouter / Gemini (fallback chain) |
| i18n | next-intl 4 |
| Tests | Vitest 4 + React Testing Library, Playwright |
| Language | TypeScript 5 (strict) |

---

## Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- Docker (for local Postgres) **or** a Supabase project

---

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment variables and fill in values
cp env.example .env.local

# 3. Start the database (Docker)
docker-compose up -d db

# 4. Run migrations and seed data
pnpm db:migrate
pnpm db:seed

# 5. Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

Create `.env.local` from `env.example`:

```env
# Supabase (server-side only)
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<anon-key>

# Direct Postgres (Docker / local)
DATABASE_URL=postgresql://erp:erp@localhost:5432/erp_minero

# LLM providers — at least one required for AI features
GROQ_API_KEY=
OPENROUTER_API_KEY=
GEMINI_API_KEY=
```

The LLM layer tries providers in order: **Groq → OpenRouter → Gemini**. Missing keys are skipped; all three missing disables AI features gracefully.

> API keys are enforced server-side with `import "server-only"` and are never sent to the client.

---

## Scripts

```bash
pnpm dev          # Dev server with hot reload
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # ESLint

pnpm db:migrate   # Apply SQL migrations (idempotent)
pnpm db:seed      # Seed database with deterministic test data

pnpm test         # Vitest (single run)
pnpm test:watch   # Vitest (watch mode)
pnpm test:e2e     # Playwright smoke tests
```

---

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx            # Dashboard (Server Component)
│   ├── layout.tsx          # Root layout + AppShell
│   ├── globals.css         # Design tokens + Tailwind
│   └── api/
│       ├── health/         # GET /api/health
│       ├── text-query/     # POST /api/text-query
│       ├── cost-variance/  # POST /api/cost-variance
│       └── llm/complete/   # POST /api/llm/complete
├── components/
│   ├── shell/              # AppShell, Sidebar
│   ├── charts/             # Recharts wrappers (client)
│   ├── query-panel/        # Text-to-query UI
│   ├── cost-variance-panel/
│   └── ui/                 # Card, Button, Badge primitives
├── lib/
│   ├── llm/                # Provider adapters + fallback chain
│   ├── text-query/         # intent-parser → query-builder → insight
│   ├── cost-variance/      # variance-calculator + narrator
│   ├── queries/            # Dashboard data fetchers
│   └── supabase/           # Supabase client factory
└── i18n/                   # next-intl setup
db/
├── migrations/             # 001_initial_schema.sql
└── seed/                   # Deterministic seed with Mulberry32 PRNG
e2e/                        # Playwright smoke tests
messages/
├── en.json
└── es.json
```

---

## API Reference

| Endpoint | Method | Body | Returns |
|---|---|---|---|
| `/api/health` | GET | — | `{ ok: true }` |
| `/api/text-query` | POST | `{ question, mineId? }` | `{ rows, chartType, insightText }` |
| `/api/cost-variance` | POST | `{ mineId, period, comparisonPeriod? }` | `{ drivers[], narrative, ... }` |
| `/api/llm/complete` | POST | `{ prompt }` | `{ text, provider, model }` |

`chartType` is one of `"line" | "bar" | "none"` — determined automatically from query intent.

---

## Database Schema

| Table | Purpose |
|---|---|
| `mines` | Mining site catalog |
| `production_runs` | Tonnage and ore grade per mine per period |
| `cost_entries` | Cost per driver (fuel, supplies, equipment, labor) |
| `supplies` | Supply item catalog |
| `supply_consumption` | Consumption records |
| `suppliers` | Supplier info with reliability score |
| `purchase_orders` | Supply purchase history |

Migrations are idempotent — safe to run repeatedly.

---

## Architecture Notes

**LLM fallback chain** — provider errors bubble up through the chain. A single provider failure never surfaces to the user.

**Pure domain logic** — `src/lib/text-query/` and `src/lib/cost-variance/` contain no Next.js or Supabase imports. Route handlers compose them with infrastructure.

**Server-only boundary** — all LLM and database credentials live exclusively in route handlers and server modules. `import "server-only"` enforces this at build time.

**Deterministic seed** — the seed script uses a Mulberry32 PRNG seeded with a fixed value, producing identical data on every run for reproducible development and testing.

---

## Testing

```bash
pnpm test         # Unit + integration tests (Vitest)
pnpm test:e2e     # Smoke tests against running app (Playwright)
```

Unit tests cover: intent parsing, query building, chart heuristics, variance calculation, and i18n key parity (all keys must exist in both `en.json` and `es.json`).

E2E smoke tests verify: dashboard loads, sidebar renders, KPI cards appear, and the query panel is visible.

---

## License

Private — all rights reserved.
