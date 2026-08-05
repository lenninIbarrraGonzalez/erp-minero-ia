# Tasks: Etapa 1 — Database Schema & Deterministic Seed

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 380–500 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: config + DDL → PR 2: constants + generators (RED+GREEN) → PR 3: seed runner |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Config changes + DDL migration | PR 1 | `pnpm vitest run` (existing tests pass) | `pnpm db:migrate` against a local PG | Revert `vitest.config.ts`, `package.json`, delete `db/migrations/` |
| 2 | Pure generators — RED tests + GREEN impl | PR 2 | `pnpm vitest run db/__tests__/generators.test.ts` | N/A — pure functions, no DB needed | Delete `db/seed/constants.ts`, `db/seed/generators.ts`, `db/__tests__/generators.test.ts` |
| 3 | Impure seed runner | PR 3 | `pnpm db:seed` (requires running PG + migrated DB) | `pnpm db:seed` then `SELECT COUNT(*) FROM production_runs` (expect 60) | Delete `db/seed/run.ts` |

---

## Phase 1: Infrastructure / Config

- [x] 1.1 `vitest.config.ts` — add `"db/**/*.{test,spec}.{ts,tsx}"` to the `include` array (alongside existing `src/**` pattern). Req: Vitest Include Pattern Widened.
- [x] 1.2 `package.json` — add devDependencies `pg`, `@types/pg`, `tsx` (pnpm add -D). Add scripts `"db:migrate": "psql $DATABASE_URL < db/migrations/001_initial_schema.sql"` and `"db:seed": "tsx db/seed/run.ts"`. Req: Idempotent Seed Runner + Baseline Mine Dimensions.

## Phase 2: DDL Migration

- [x] 2.1 Create `db/migrations/001_initial_schema.sql` — `CREATE TABLE IF NOT EXISTS` for all 7 tables: `mines`, `production_runs`, `cost_entries`, `supplies`, `supply_consumption`, `suppliers`, `purchase_orders`. Each with uuid PK. Req: Seven-Table DDL.
- [x] 2.2 Add CHECK constraint on `cost_entries.driver IN ('fuel','supplies','equipment','labor')`. Req: Driver and Category Enums.
- [x] 2.3 Add CHECK constraint on `supplies.category IN ('fuel','explosives','reagents')`. Req: Driver and Category Enums.
- [x] 2.4 Add all FK columns referencing parent tables with `ON DELETE RESTRICT`. All period columns typed as `date`. Req: Foreign Key Integrity + Period Column Semantics.

## Phase 3: RED Tests (must fail before any implementation in Phase 4)

- [x] 3.1 Create `db/__tests__/generators.test.ts` — test `baselineGenerator`: assert Cerro Rojo m1 returns `{ driver:'fuel', amount:600000 }` and 5 mines × 12 months produce exactly 60 rows. Req: Baseline Mine Dimensions + TDD Constraint.
- [x] 3.2 Add test for `applyGeologicalDecline` in `generators.test.ts`: Cerro Rojo `ore_grade` at m1 ≈ 1.8 and m12 ≈ 1.2 (linear, ±tolerance 0.001). Req: Variance Story — Geological Grade Decline + TDD Constraint.
- [x] 3.3 Add test for `applySupplierPriceShock` in `generators.test.ts`: Cerro Rojo fuel amount for m8 = 690000, Loma Grande fuel for m8 = 1035000; months 1-7 unchanged. Req: Variance Story — Supplier Price Shock + TDD Constraint.
- [x] 3.4 Add test for `applyOperationalStoppage` in `generators.test.ts`: Quebrada Sur `ore_tonnes` in m6 = 9000, costs unchanged, cost/t ≈ 62; m7 = 15000. Req: Variance Story — Operational Stoppage + TDD Constraint.
- [x] 3.5 Add test for `deterministicNoise` / `mulberry32` in `generators.test.ts`: noise factor in [0.96, 1.04] for all amounts; two independent runs with seed=42 produce byte-identical output. Req: Deterministic Fixed-Seed Noise + TDD Constraint.
- [x] 3.6 Add threat-matrix RED test in `generators.test.ts`: assert `run.ts` module (when imported) does NOT call `console.log` / `console.error` with any string matching `DATABASE_URL` or containing `://`. Req: SECRET EXPOSURE from Threat Matrix.
- [x] 3.7 Verify all tests in Phase 3 FAIL (`pnpm vitest run db/__tests__/generators.test.ts` exits non-zero) before proceeding to Phase 4.

## Phase 4: GREEN Implementation

- [x] 4.1 Create `db/seed/constants.ts` — export typed constants: `MINES` (5 entries with mineral/tonnage/grade/region), `BASELINE_COSTS` keyed by mine+driver, `GRADE_ENDPOINTS` (Cerro Rojo 1.8→1.2), `EVENT_DEFS` (3 stories), `SUPPLIERS` (5 rows with reliability_score), `MARKET_PRICES`, `SEED = 42`. NO side effects. Req: Five Suppliers + Baseline Mine Dimensions.
- [x] 4.2 Create `db/seed/generators.ts` — implement `mulberry32(seed)`, `deterministicNoise(mine, driver, month, rng)`, `baselineGenerator(mine, driver, month)`, `applyGeologicalDecline(entry, month)`, `applySupplierPriceShock(entry, month)`, `applyOperationalStoppage(entry, month)`. All pure functions, no I/O. Req: TDD Constraint (GREEN step).
- [x] 4.3 Run `pnpm vitest run db/__tests__/generators.test.ts` — all tests MUST PASS before continuing.

## Phase 5: Impure Seed Runner

- [x] 5.1 Create `db/seed/run.ts` — connect via `pg.Pool` using `DATABASE_URL` env var; MUST NOT `console.log` / `console.error` the connection string or any interpolated URL. Req: SECRET EXPOSURE Threat Matrix.
- [x] 5.2 In `run.ts`, implement TRUNCATE in FK-safe order: `purchase_orders`, `supply_consumption`, `cost_entries`, `production_runs`, `supplies`, `suppliers`, `mines`. Then bulk-insert all generated rows inside a single transaction. Req: Idempotent Seed Runner.
- [x] 5.3 Run `pnpm db:seed` against a local migrated DB; verify `SELECT COUNT(*) FROM production_runs` returns 60 and `SELECT COUNT(*) FROM suppliers` returns 5. Req: Baseline Mine Dimensions + Five Suppliers.
- [x] 5.4 Run `pnpm db:seed` a second time; verify row counts are identical (idempotency check). Req: Idempotent Seed Runner.
