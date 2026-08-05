# Design: Etapa 1 — Database Schema & Deterministic Seed

## Technical Approach

Raw Postgres DDL applied by `psql` from an npm script; TypeScript seed split into **pure generators** (baseline, event applicators, PRNG noise) and an **impure `pg` runner**. Generators emit plain row objects and are unit-tested RED→GREEN (Vitest). All baseline values, market prices and supplier data live as typed constants. Determinism is guaranteed by a self-contained `mulberry32` PRNG seeded with `42`. Maps proposal "pure generators + thin runner" and spec domains `db-schema` + `seed-data`.

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|----------|--------|----------|-----------|
| Migration mechanism | `psql $DATABASE_URL < 001_initial_schema.sql`, `CREATE TABLE IF NOT EXISTS` | Supabase CLI / node migration lib | No new runtime dep; idempotent; matches docker-compose postgres:16 |
| PRNG | `mulberry32(seed=42)`, pure TS | `Math.random` (non-deterministic); crypto; npm dep | 32-bit, zero-dep, reproducible byte-identical output; testable |
| Noise application | Per `(mine, driver, month)` tuple on cost **amounts only** | Global noise; noise on grade/events | Events & grade must stay exact so the 3 stories are legible; ±4% adds realism to costs |
| Seed idempotency | TRUNCATE all tables (FK-safe order) then insert | Upsert; DELETE | Simplest, guarantees identical row counts across runs |
| Runner insertion | `pg` Pool, parameterized inserts, single transaction | ORM; Supabase client | Tooling stays decoupled from app's Supabase layer (proposal risk mitigation) |
| Execution | `tsx` for `db/*.ts`; connection from `DATABASE_URL` | `ts-node` | Faster, ESM-native, aligns with Next 16 / vitest 4 stack |
| Grade decline shape | Linear interpolation `1.8 - (0.6 * (m-1)/11)` months 1→12 | Step function | Spec says linear 1.8%→1.2% |

## Data Flow

    constants.ts ──┐
                   ├─→ generators.ts ─(row objects)─→ run.ts ──→ pg Pool ──→ Postgres
    seed=42 ───────┘   (baseline →         (TRUNCATE → INSERT tx)
                        applyGeologicalDecline →
                        applySupplierPriceShock →
                        applyOperationalStoppage →
                        deterministicNoise)

    generators.ts ←──(assert baselines, deltas, noise bounds)── generators.test.ts

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `db/migrations/001_initial_schema.sql` | Create | 7 tables, uuid PKs, driver/category CHECKs, FKs ON DELETE RESTRICT, `date` period cols, `IF NOT EXISTS` |
| `db/seed/constants.ts` | Create | Typed constants: 5 mines (mineral, tonnage, grade, region), baseline costs per driver, grade endpoints, 3 event defs, 5 suppliers, market prices, `SEED=42` |
| `db/seed/generators.ts` | Create | Pure fns: `baselineGenerator`, `applyGeologicalDecline`, `applySupplierPriceShock`, `applyOperationalStoppage`, `deterministicNoise`, `mulberry32` |
| `db/seed/run.ts` | Create | Loads constants → pipes generators → TRUNCATE + INSERT via `pg` in one tx from `DATABASE_URL` |
| `db/__tests__/generators.test.ts` | Create (FIRST/RED) | Unit tests for every pure fn before implementation exists |
| `vitest.config.ts` | Modify | Add `db/**/*.{test,spec}.{ts,tsx}` to `include` |
| `package.json` | Modify | Add `pg`+`@types/pg`+`tsx` devDeps; scripts `db:migrate`, `db:seed` |

## Interfaces / Contracts

```ts
type MineSeed = { name: string; mineral: 'Cu'|'Au'|'Fe'|'Ag'|'Zn'; region: string;
  tonnage: number; baseGrade: number };
type CostRow = { mine: string; period: string; driver: 'fuel'|'supplies'|'equipment'|'labor'; amount: number };
type ProductionRow = { mine: string; period: string; tonnage: number; ore_grade: number };

function mulberry32(seed: number): () => number;            // [0,1)
function deterministicNoise(rng: () => number): number;     // factor in [0.96, 1.04]
function baselineGenerator(): { production: ProductionRow[]; costs: CostRow[] };
function applyGeologicalDecline(rows: ProductionRow[]): ProductionRow[];   // Cerro Rojo 1.8→1.2 linear
function applySupplierPriceShock(rows: CostRow[]): CostRow[];               // month≥8 Cerro Rojo+Loma fuel ×1.15
function applyOperationalStoppage(rows: ProductionRow[]): ProductionRow[]; // month6 Quebrada ×0.60
```

Baseline costs (USD/month, months 1–7): Cerro Rojo fuel 600k/supplies 400k/equip 450k/labor 350k; Veta Dorada 90k/110k/90k/70k; Loma Grande 900k/350k/700k/250k; Quebrada Sur 130k/180k/160k/130k; Peña Azul 300k/620k/380k/250k. Regions: Norte, Centro, Sur (distinct assignment). Suppliers carry `reliability_score`: Diésel del Norte 0.85, Reactivos del Sur 0.62, Explosivos Andinos 0.90, Repuestos Cordillera 0.88, Lubricantes Sur 0.80.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (RED first) | baselines exactly match constants; grade linear endpoints (m1=1.8, m12=1.2); +15% diesel delta (Cerro fuel 690k, Loma 1035k) from m8; m6 Quebrada tonnage 9000 & cost/t ~62; noise factor within [0.96,1.04]; two runs byte-identical | Vitest pure-fn assertions, no DB |
| Integration | migrate+seed on clean DB yields 5×12 rows + 5 suppliers; re-run identical counts | Manual/optional; not automated this stage |

TDD: `db/__tests__/generators.test.ts` is authored FIRST and MUST fail before any `generators.ts` implementation.

## Threat Matrix

Applicable — one shell/subprocess boundary: `db:migrate` runs `psql $DATABASE_URL < db/migrations/001_initial_schema.sql`.
- Command injection / arg splitting: N/A — static command, no user-derived tokens; `DATABASE_URL` is an env var consumed by `psql`, not interpolated into shell.
- Path classification: N/A — fixed relative SQL path, no dynamic file resolution.
- Secret exposure: `DATABASE_URL` may contain credentials; MUST NOT be echoed/logged by `run.ts` or scripts. Safe behavior: read via `process.env`, never print. Planned check: assert runner does not log the connection string.
All other threat-matrix rows: N/A — no routing, VCS/PR automation, or executable-file classification.

## Migration / Rollout

Additive DDL. Rollback = `DROP TABLE` or reset docker volume (`docker compose down -v`). Seed is truncate-then-insert, freely re-runnable. Revert `package.json`/`vitest.config.ts` edits to undo.

## Open Questions

- [ ] Resolved: cost_per_tonne / margin stay OUT of scope — seed stores raw facts only (per proposal assumption; spec confirms).
- [ ] None blocking.
