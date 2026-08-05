# Proposal: Etapa 1 — Database Schema & Deterministic Seed

## Intent

The ERP demo needs a populated Postgres database before any read-only feature
(KPI dashboards, text-to-query, cost-variance explainer) can be built. Today the
repo has docker-compose `postgres:16` and a Supabase client but zero tables and
zero data. This change delivers the 7-table schema (obs #405) plus a
deterministic parametric seed (obs #406) whose numbers are engineered so the
question "why did cost per tonne rise?" has three distinct answers (geology,
supplier price, operational stoppage). Without this, no downstream feature is
demonstrable.

## Scope

### In Scope
- SQL migration files in `db/migrations/` (raw Postgres DDL, not Supabase CLI)
- TypeScript seed generator in `db/seed/`: pure functions for baselines, event
  deltas, and ±4% deterministic fixed-seed noise; `pg`-based runner vs DATABASE_URL
- `db:migrate` and `db:seed` npm scripts in `package.json`; add `pg` dependency
- Vitest unit tests for all seed generation logic (RED before GREEN)

### Out of Scope
- Any query layer, KPI computation, API routes, or UI
- Supabase local stack / migrations CLI (dev uses docker-compose `postgres:16`)
- Auth, RLS, indices tuning beyond primary/foreign keys
- Market-constant margin math consumers (seed only stores raw facts)

## Capabilities

### New Capabilities
- `db-schema`: 7-table relational schema, period as explicit first-of-month `date`,
  driver/category enums, FK integrity across mines/supplies/suppliers.
- `seed-data`: deterministic parametric dataset — 5 mines × 12 months, 3 encoded
  variance stories, fixed-seed ±4% noise, supplier-traceable purchase orders.

### Modified Capabilities
None.

## Approach

Raw `.sql` migrations applied by a thin `pg` runner (no ORM). Seed logic split
into pure generator functions (`baseline`, `applyEvents`, `deterministicNoise`)
that emit plain row objects, kept separate from the `pg` insertion side-effect so
they are unit-testable. A single fixed seed makes output reproducible; tests
assert baseline values, event deltas (grade decline, +15% diesel month 8, -40%
month 6 stoppage), and noise bounds. Runner truncates then inserts for idempotency.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `db/migrations/*.sql` | New | 7-table DDL + enums + FKs |
| `db/seed/*.ts` | New | Pure generators + `pg` runner |
| `db/seed/*.test.ts` | New | Vitest unit tests for generators |
| `package.json` | Modified | `db:migrate`, `db:seed` scripts; add `pg`, `@types/pg` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Seed numbers drift from cost-variance stories | Med | Encode baselines/deltas as named constants asserted by tests |
| Non-deterministic noise breaks reproducibility | Med | Seeded PRNG; test asserts stable output across runs |
| `pg` vs Supabase client duplication | Low | `pg` scoped to db tooling only; app keeps Supabase client |

## Rollback Plan

Migrations are additive DDL; rollback = `DROP` the created tables (or reset the
docker-compose volume). Seed is truncate-then-insert, re-runnable and reversible
by truncating. Revert the `package.json` script/dependency additions.

## Dependencies

- Running `postgres:16` via docker-compose; valid `DATABASE_URL` (from `env.example`)
- `pg` npm package (new devDependency)

## Success Criteria

- [ ] `pnpm db:migrate` creates all 7 tables with enums and FKs on a clean DB
- [ ] `pnpm db:seed` populates 5 mines × 12 months and 5 suppliers idempotently
- [ ] `pnpm test` passes; generators tested RED→GREEN including all 3 variance events
- [ ] Seed output byte-identical across repeated runs (deterministic)

## Proposal question round

Context obs #405/#406 lock the schema and seed scenario (user-approved), so no
blocking round is required. One decision gap the user may confirm during specs:
should `cost_per_tonne` and margin/market constants live as computed columns/views
now, or stay out of scope (current assumption: out of scope — seed stores raw
facts only)?
