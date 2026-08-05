# seed-data Specification

## Purpose

Defines the deterministic parametric seed dataset. Pure generator functions
produce row objects independently of the database; a pg runner inserts them.
Tests follow strict RED→GREEN TDD: every generator function MUST have a failing
test before its implementation exists.

## Requirements

### Requirement: Vitest Include Pattern Widened

The vitest configuration MUST widen its `include` pattern to cover
`db/**/*.{test,spec}.{ts,tsx}` in addition to the existing
`src/**/*.{test,spec}.{ts,tsx}` pattern, so seed unit tests under `db/seed/`
are discovered and executed by `pnpm test`.

#### Scenario: Seed tests discovered

- GIVEN `vitest.config.ts` include pattern covers both `src/**` and `db/**`
- WHEN `pnpm test` is executed
- THEN test files under `db/seed/` are collected and run

#### Scenario: TDD RED step — test written before implementation

- GIVEN a new generator function does not yet exist
- WHEN the test file importing it is run with `pnpm test`
- THEN vitest reports a failing (RED) test due to import or assertion failure
- AND no implementation file has been written yet

### Requirement: Baseline Mine Dimensions

The seed MUST produce exactly 5 mines with fixed names and mineral types.
Baseline monthly values (months 1–7, pre-event) MUST match the specified constants.

| Mine | Mineral | Tonnage baseline | Grade baseline |
|------|---------|-----------------|----------------|
| Cerro Rojo | Cu | 50 000 t | 1.8 % |
| Veta Dorada | Au | 8 000 t | 6.0 g/t |
| Loma Grande | Fe | 120 000 t | 58 % |
| Quebrada Sur | Ag | 15 000 t | 180 g/t |
| Peña Azul | Zn | 30 000 t | 8.0 % |

#### Scenario: RED — baseline generator test before implementation

- GIVEN no `baselineGenerator` function exists
- WHEN the test asserting `baselineGenerator('Cerro Rojo', 1).tonnage === 50000` runs
- THEN vitest reports a RED failure

#### Scenario: GREEN — baseline values match constants

- GIVEN `baselineGenerator` is implemented
- WHEN it is called for Cerro Rojo, month 1
- THEN `tonnage` is 50 000 and `ore_grade` is 1.8

#### Scenario: Exactly 5 mines × 12 months rows for production_runs

- GIVEN the seed is run
- WHEN `production_runs` is queried
- THEN exactly 60 rows exist (5 mines × 12 months, period = first of each month Jan–Dec 2024)

### Requirement: Variance Story — Geological Grade Decline (Cerro Rojo)

Cerro Rojo `ore_grade` MUST decline linearly from 1.8 % (month 1) to 1.2 %
(month 12), a reduction of 0.6 pp over 11 steps (~0.0545 pp/month). All other
Cerro Rojo columns remain at baseline. Cost entries remain stable, implying
cost-per-tonne margin degrades by ~33 %.

#### Scenario: RED — grade decline event test before implementation

- GIVEN no `applyGeologicalDecline` function exists
- WHEN the test asserting month-12 grade runs
- THEN vitest reports RED

#### Scenario: GREEN — grade at month 12

- GIVEN `applyGeologicalDecline` is implemented
- WHEN production_runs for Cerro Rojo month 12 is queried from seed output
- THEN `ore_grade` is 1.2 (±0.001 tolerance for floating-point)

#### Scenario: Grade is monotonically decreasing for Cerro Rojo

- GIVEN seed output for Cerro Rojo months 1–12
- WHEN ore_grade values are compared sequentially
- THEN each month's grade is less than or equal to the previous month's grade

### Requirement: Variance Story — Supplier Price Shock (month 8, diesel)

Starting month 8, diesel unit_price from Diésel del Norte MUST increase by 15 %.
`cost_entries` for Cerro Rojo fuel MUST reflect 600 000 → 690 000 (×1.15).
`cost_entries` for Loma Grande fuel MUST reflect 900 000 → 1 035 000 (×1.15).

#### Scenario: RED — supplier price event test before implementation

- GIVEN no `applySupplierPriceShock` function exists
- WHEN the test asserting month-8 fuel cost for Cerro Rojo runs
- THEN vitest reports RED

#### Scenario: GREEN — Cerro Rojo fuel cost month 8

- GIVEN `applySupplierPriceShock` is implemented
- WHEN cost_entries for Cerro Rojo, driver='fuel', month 8 is evaluated
- THEN `amount` equals 690 000

#### Scenario: GREEN — Loma Grande fuel cost month 8

- GIVEN `applySupplierPriceShock` is implemented
- WHEN cost_entries for Loma Grande, driver='fuel', month 8 is evaluated
- THEN `amount` equals 1 035 000

#### Scenario: Pre-shock months unaffected

- GIVEN seed output for Cerro Rojo, driver='fuel', months 1–7
- WHEN amounts are inspected
- THEN each equals 600 000 (before noise)

### Requirement: Variance Story — Operational Stoppage (Quebrada Sur, month 6)

Quebrada Sur tonnage MUST drop 40 % in month 6 (15 000 → 9 000 t). Fixed costs
in `cost_entries` for month 6 MUST remain at their baseline level, producing
cost-per-tonne of approximately 62 (vs ~40 at baseline). Month 7 MUST recover
to baseline tonnage (15 000 t).

#### Scenario: RED — stoppage event test before implementation

- GIVEN no `applyOperationalStoppage` function exists
- WHEN the test asserting Quebrada Sur month-6 tonnage runs
- THEN vitest reports RED

#### Scenario: GREEN — month 6 tonnage drop

- GIVEN `applyOperationalStoppage` is implemented
- WHEN production_runs for Quebrada Sur month 6 is evaluated
- THEN `tonnage` equals 9 000

#### Scenario: GREEN — month 7 recovery

- GIVEN seed output for Quebrada Sur month 7
- WHEN tonnage is inspected
- THEN it equals 15 000 (baseline restored)

### Requirement: Deterministic Fixed-Seed Noise

All numeric production and cost values MUST have ±4 % noise applied using a
seeded PRNG with a fixed seed. Two independent runs of the seed generator with
the same seed MUST produce byte-identical numeric output.

#### Scenario: RED — noise function test before implementation

- GIVEN no `deterministicNoise` function exists
- WHEN the test asserting stable output across two calls with the same seed runs
- THEN vitest reports RED

#### Scenario: GREEN — noise stays within ±4 %

- GIVEN `deterministicNoise(base, seed)` is implemented
- WHEN called with a base value of 50 000 and a fixed seed
- THEN the returned value is in the range [48 000, 52 000]

#### Scenario: Reproducibility across runs

- GIVEN two independent invocations of the full seed generator with the same fixed seed
- WHEN all numeric values are compared row by row
- THEN every value is identical (zero divergence)

### Requirement: Five Suppliers

The seed MUST insert exactly 5 supplier rows with specified names and
reliability_score values. Diésel del Norte is traceable in purchase_orders.
Reactivos del Sur MUST have `reliability_score = 0.62`.

#### Scenario: Supplier rows present after seed

- GIVEN `pnpm db:seed` completes
- WHEN `suppliers` is queried
- THEN exactly 5 rows exist with names: Diésel del Norte, Reactivos del Sur, Explosivos Andinos, Repuestos Cordillera, Lubricantes Sur

#### Scenario: Reactivos del Sur reliability score

- GIVEN seed output
- WHEN the Reactivos del Sur supplier row is inspected
- THEN `reliability_score` equals 0.62

### Requirement: Idempotent Seed Runner

The `pnpm db:seed` script MUST truncate all seed tables before inserting, so
running it multiple times produces the same final state without duplicate rows.

#### Scenario: Idempotent second run

- GIVEN `pnpm db:seed` has already been run once
- WHEN `pnpm db:seed` is run a second time
- THEN row counts in all 7 tables are identical to those after the first run
- AND no duplicate rows exist
