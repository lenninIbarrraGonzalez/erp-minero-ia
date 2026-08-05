# db-schema Specification

## Purpose

Defines the 7-table relational schema for the ERP demo Postgres database.
All tables are created via raw SQL migrations (no ORM). Computed columns and
views (cost_per_tonne, margins) are explicitly out of scope.

## Requirements

### Requirement: Seven-Table DDL

The migration MUST create exactly 7 tables: `mines`, `production_runs`,
`cost_entries`, `supplies`, `supply_consumption`, `suppliers`, and
`purchase_orders`. Each table MUST have a `uuid` primary key column named `id`.

#### Scenario: Clean-database migration

- GIVEN a running postgres:16 instance with no application tables
- WHEN `pnpm db:migrate` is executed with a valid `DATABASE_URL`
- THEN all 7 tables exist with their specified columns, constraints, and FK references
- AND re-running `pnpm db:migrate` on the same database produces no error (idempotent)

#### Scenario: Schema columns and types

- GIVEN the migration has been applied
- WHEN the information_schema is queried for each table
- THEN `mines` has columns `(id uuid PK, name text, region text, mineral_type text)`
- AND `production_runs` has `(id uuid PK, mine_id uuid FK→mines, period date, tonnage numeric, ore_grade numeric, equipment_hours numeric)`
- AND `cost_entries` has `(id uuid PK, mine_id uuid FK→mines, period date, driver text, amount numeric)`
- AND `supplies` has `(id uuid PK, name text, unit text, category text)`
- AND `supply_consumption` has `(id uuid PK, mine_id uuid FK→mines, supply_id uuid FK→supplies, period date, quantity numeric)`
- AND `suppliers` has `(id uuid PK, name text, reliability_score numeric)`
- AND `purchase_orders` has `(id uuid PK, supplier_id uuid FK→suppliers, supply_id uuid FK→supplies, period date, unit_price numeric, quantity numeric)`

### Requirement: Driver and Category Enums

The `cost_entries.driver` column MUST enforce a CHECK constraint accepting only
`'fuel'`, `'supplies'`, `'equipment'`, `'labor'`. The `supplies.category` column
MUST enforce a CHECK constraint accepting only `'fuel'`, `'explosives'`,
`'reagents'`.

#### Scenario: Valid driver value

- GIVEN the schema is applied
- WHEN an INSERT into `cost_entries` uses `driver = 'fuel'`
- THEN the row is accepted

#### Scenario: Invalid driver value rejected

- GIVEN the schema is applied
- WHEN an INSERT into `cost_entries` uses `driver = 'transport'`
- THEN the database raises a constraint violation error

#### Scenario: Invalid category value rejected

- GIVEN the schema is applied
- WHEN an INSERT into `supplies` uses `category = 'parts'`
- THEN the database raises a constraint violation error

### Requirement: Foreign Key Integrity

All FK columns MUST reference their parent tables with `ON DELETE RESTRICT`
(default) to prevent orphaned child rows.

#### Scenario: FK violation blocked

- GIVEN `production_runs` references `mines`
- WHEN a DELETE on `mines` targets a mine that has production_runs rows
- THEN the database raises a foreign key violation error

### Requirement: Period Column Semantics

All `period` columns MUST be typed as `date`. The seed contract (first-of-month)
is enforced at the application layer, not by a DB constraint.

#### Scenario: Period column accepts first-of-month date

- GIVEN the schema is applied
- WHEN a row is inserted with `period = '2024-01-01'`
- THEN the row is stored and retrievable with that exact date value
