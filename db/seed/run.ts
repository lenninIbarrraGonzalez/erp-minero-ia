/**
 * db/seed/run.ts — Impure seed runner.
 *
 * Reads DATABASE_URL from env, connects via pg, truncates all tables in
 * FK-safe order, then inserts deterministic seed data using pure generators.
 *
 * SECURITY: DATABASE_URL / connection strings are NEVER logged.
 */

import pg from 'pg';
import {
  MINES,
  MONTHS,
  START_YEAR,
  SEED,
  SUPPLIERS,
  SUPPLIES_CATALOG,
  DRIVER_BASELINES,
  EQUIPMENT_HOURS,
} from './constants';
import {
  mulberry32,
  addNoise,
  getOreGrade,
  applyDieselShock,
  applyOperationalStoppage,
} from './generators';

const DRIVERS = ['fuel', 'supplies', 'equipment', 'labor'] as const;

/**
 * runSeed — exported so tests can call it without spawning a subprocess.
 * The function throws on error; callers that need process.exit should wrap it.
 */
export async function runSeed(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // IMPORTANT: never log connectionString or DATABASE_URL
  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    await client.query('BEGIN');

    // ── Truncate all tables FK-safe order ──────────────────────────────────
    console.log('Truncating tables...');
    await client.query(`
      TRUNCATE TABLE
        purchase_orders,
        supply_consumption,
        cost_entries,
        production_runs,
        supplies,
        suppliers,
        mines
      RESTART IDENTITY CASCADE
    `);

    // ── Insert mines ───────────────────────────────────────────────────────
    console.log('Inserting mines...');
    const mineIds: Record<string, string> = {};
    for (const mine of MINES) {
      const result = await client.query<{ id: string }>(
        `INSERT INTO mines (name, region, mineral_type)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [mine.name, mine.region, mine.mineral_type],
      );
      mineIds[mine.name] = result.rows[0].id;
    }

    // ── Insert suppliers ───────────────────────────────────────────────────
    console.log('Inserting suppliers...');
    const supplierIds: Record<string, string> = {};
    for (const supplier of SUPPLIERS) {
      const result = await client.query<{ id: string }>(
        `INSERT INTO suppliers (name, reliability_score)
         VALUES ($1, $2)
         RETURNING id`,
        [supplier.name, supplier.reliability_score],
      );
      supplierIds[supplier.name] = result.rows[0].id;
    }

    // ── Insert supplies ────────────────────────────────────────────────────
    console.log('Inserting supplies...');
    const supplyIds: Record<string, string> = {};
    for (const supply of SUPPLIES_CATALOG) {
      const result = await client.query<{ id: string }>(
        `INSERT INTO supplies (name, unit, category)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [supply.name, supply.unit, supply.category],
      );
      supplyIds[supply.name] = result.rows[0].id;
    }

    // ── Insert production_runs and cost_entries ────────────────────────────
    console.log('Inserting production runs and cost entries...');
    const rng = mulberry32(SEED);

    // Track fuel cost per mine per month for purchase_orders
    const fuelCostByMineMonth: Record<string, Record<number, number>> = {};

    for (const mine of MINES) {
      const mineId = mineIds[mine.name];
      fuelCostByMineMonth[mine.name] = {};

      for (let month = 1; month <= MONTHS; month++) {
        const period = `${START_YEAR}-${String(month).padStart(2, '0')}-01`;
        const tonnage = applyOperationalStoppage(mine.name, mine.baselineTonnage, month);
        const oreGrade = getOreGrade(mine.name, month);
        const equipmentHours = EQUIPMENT_HOURS[mine.name] ?? 0;

        // production_runs: uses column "tonnage"
        await client.query(
          `INSERT INTO production_runs (mine_id, period, tonnage, ore_grade, equipment_hours)
           VALUES ($1, $2::date, $3, $4, $5)`,
          [mineId, period, tonnage, oreGrade, equipmentHours],
        );

        for (const driver of DRIVERS) {
          const baseline = DRIVER_BASELINES[mine.name][driver] ?? 0;
          const afterShock = applyDieselShock(mine.name, driver, baseline, month);
          const amount = addNoise(afterShock, rng);

          // cost_entries: uses mine_id + period (not production_run_id)
          await client.query(
            `INSERT INTO cost_entries (mine_id, period, driver, amount)
             VALUES ($1, $2::date, $3, $4)`,
            [mineId, period, driver, amount],
          );

          if (driver === 'fuel') {
            fuelCostByMineMonth[mine.name][month] = amount;
          }
        }
      }
    }

    // ── Insert supply_consumption ──────────────────────────────────────────
    // Link each mine to relevant supplies with monthly quantity
    console.log('Inserting supply consumption...');

    const dieselSupplyId    = supplyIds['Diesel'];
    const reactivosSupplyId = supplyIds['Reactivos Flotación'];
    const anfoSupplyId      = supplyIds['Explosivos ANFO'];

    for (const mine of MINES) {
      const mineId = mineIds[mine.name];

      for (let month = 1; month <= MONTHS; month++) {
        const period = `${START_YEAR}-${String(month).padStart(2, '0')}-01`;

        // All mines consume Diesel (fuel driver cost / unit price estimate)
        if (dieselSupplyId) {
          const fuelCost = fuelCostByMineMonth[mine.name]?.[month] ?? 0;
          const quantity = Math.max(1, Math.round(fuelCost / 1.0)); // 1 USD/liter placeholder
          await client.query(
            `INSERT INTO supply_consumption (mine_id, supply_id, period, quantity)
             VALUES ($1, $2, $3::date, $4)`,
            [mineId, dieselSupplyId, period, quantity],
          );
        }

        // Peña Azul consumes Reactivos Flotación
        if (mine.name === 'Peña Azul' && reactivosSupplyId) {
          const suppliesCost = DRIVER_BASELINES[mine.name]['supplies'] ?? 0;
          const quantity = Math.max(1, Math.round(suppliesCost / 5));
          await client.query(
            `INSERT INTO supply_consumption (mine_id, supply_id, period, quantity)
             VALUES ($1, $2, $3::date, $4)`,
            [mineId, reactivosSupplyId, period, quantity],
          );
        }

        // All mines consume Explosivos ANFO
        if (anfoSupplyId) {
          const suppliesCost = DRIVER_BASELINES[mine.name]['supplies'] ?? 0;
          const quantity = Math.max(1, Math.round(suppliesCost / 3));
          await client.query(
            `INSERT INTO supply_consumption (mine_id, supply_id, period, quantity)
             VALUES ($1, $2, $3::date, $4)`,
            [mineId, anfoSupplyId, period, quantity],
          );
        }
      }
    }

    // ── Insert purchase_orders ─────────────────────────────────────────────
    // Schema: (supplier_id, supply_id, period, unit_price, quantity)
    console.log('Inserting purchase orders...');

    const dieselSupplierId    = supplierIds['Diésel del Norte'];
    const reactivosSupplierId = supplierIds['Reactivos del Sur'];
    const explosivosSupplierId = supplierIds['Explosivos Andinos'];

    // Diésel del Norte → Diesel supply (month 8+: unit_price ×1.15)
    // Cerro Rojo and Loma Grande are the diesel-shock mines
    if (dieselSupplierId && dieselSupplyId) {
      for (let month = 1; month <= MONTHS; month++) {
        const period = `${START_YEAR}-${String(month).padStart(2, '0')}-01`;
        const baseUnitPrice = 1.0;
        const unitPrice = month >= 8 ? baseUnitPrice * 1.15 : baseUnitPrice;

        // Aggregate quantity across Cerro Rojo + Loma Grande for this period
        const quantity =
          Math.round((fuelCostByMineMonth['Cerro Rojo']?.[month] ?? 0) / unitPrice) +
          Math.round((fuelCostByMineMonth['Loma Grande']?.[month] ?? 0) / unitPrice);

        await client.query(
          `INSERT INTO purchase_orders (supplier_id, supply_id, period, quantity, unit_price)
           VALUES ($1, $2, $3::date, $4, $5)`,
          [dieselSupplierId, dieselSupplyId, period, Math.max(1, quantity), unitPrice],
        );
      }
    }

    // Reactivos del Sur → Reactivos Flotación × Peña Azul
    if (reactivosSupplierId && reactivosSupplyId) {
      for (let month = 1; month <= MONTHS; month++) {
        const period = `${START_YEAR}-${String(month).padStart(2, '0')}-01`;
        const unitPrice = 5.0;
        const quantity = 1_000;
        await client.query(
          `INSERT INTO purchase_orders (supplier_id, supply_id, period, quantity, unit_price)
           VALUES ($1, $2, $3::date, $4, $5)`,
          [reactivosSupplierId, reactivosSupplyId, period, quantity, unitPrice],
        );
      }
    }

    // Explosivos Andinos → Explosivos ANFO × all mines (one PO per period)
    if (explosivosSupplierId && anfoSupplyId) {
      for (let month = 1; month <= MONTHS; month++) {
        const period = `${START_YEAR}-${String(month).padStart(2, '0')}-01`;
        const unitPrice = 3.0;
        const quantity = MINES.length * 500; // 500 kg per mine
        await client.query(
          `INSERT INTO purchase_orders (supplier_id, supply_id, period, quantity, unit_price)
           VALUES ($1, $2, $3::date, $4, $5)`,
          [explosivosSupplierId, anfoSupplyId, period, quantity, unitPrice],
        );
      }
    }

    await client.query('COMMIT');
    console.log('Done.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {
      // ignore rollback errors
    });
    throw err;
  } finally {
    await client.end();
  }
}

// ── CLI entry point ────────────────────────────────────────────────────────
// Only run when invoked directly via tsx (not when imported by tests)
const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] != null &&
  (process.argv[1].endsWith('run.ts') || process.argv[1].endsWith('run.js'));

if (isMain) {
  runSeed()
    .then(() => {
      process.exit(0);
    })
    .catch((err: unknown) => {
      if (err instanceof Error) {
        console.error('Seed failed:', err.message);
      } else {
        console.error('Seed failed with unknown error');
      }
      process.exit(1);
    });
}
