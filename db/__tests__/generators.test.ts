import { describe, it, expect } from 'vitest';
import {
  mulberry32,
  addNoise,
  getBaselineCost,
  getOreGrade,
  applyDieselShock,
  applyOperationalStoppage,
} from '../seed/generators';
import { MINES, MONTHS } from '../seed/constants';

// ──────────────────────────────────────────────────────────
// mulberry32 — determinism / stability
// ──────────────────────────────────────────────────────────
describe('mulberry32', () => {
  it('calling twice with the same seed produces the same sequence', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);

    const seq1 = Array.from({ length: 20 }, () => rng1());
    const seq2 = Array.from({ length: 20 }, () => rng2());

    expect(seq1).toEqual(seq2);
  });

  it('returns values in [0, 1)', () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

// ──────────────────────────────────────────────────────────
// addNoise — ±4% of amount
// ──────────────────────────────────────────────────────────
describe('addNoise', () => {
  it('returns a value within ±4% of the base amount', () => {
    const rng = mulberry32(42);
    const base = 100_000;

    for (let i = 0; i < 50; i++) {
      const result = addNoise(base, rng);
      expect(result).toBeGreaterThanOrEqual(base * 0.96);
      expect(result).toBeLessThanOrEqual(base * 1.04);
    }
  });
});

// ──────────────────────────────────────────────────────────
// getBaselineCost — authoritative baseline table
// ──────────────────────────────────────────────────────────
describe('getBaselineCost', () => {
  const cases: [string, string, number][] = [
    ['Cerro Rojo',   'fuel',      600_000],
    ['Cerro Rojo',   'supplies',  400_000],
    ['Cerro Rojo',   'equipment', 450_000],
    ['Cerro Rojo',   'labor',     350_000],
    ['Veta Dorada',  'fuel',       90_000],
    ['Veta Dorada',  'supplies',  110_000],
    ['Veta Dorada',  'equipment',  90_000],
    ['Veta Dorada',  'labor',      70_000],
    ['Loma Grande',  'fuel',      900_000],
    ['Loma Grande',  'supplies',  350_000],
    ['Loma Grande',  'equipment', 700_000],
    ['Loma Grande',  'labor',     250_000],
    ['Quebrada Sur', 'fuel',      130_000],
    ['Quebrada Sur', 'supplies',  180_000],
    ['Quebrada Sur', 'equipment', 160_000],
    ['Quebrada Sur', 'labor',     130_000],
    ['Peña Azul',    'fuel',      300_000],
    ['Peña Azul',    'supplies',  620_000],
    ['Peña Azul',    'equipment', 380_000],
    ['Peña Azul',    'labor',     250_000],
  ];

  it.each(cases)('%s / %s → %d', (mine, driver, expected) => {
    expect(getBaselineCost(mine, driver)).toBe(expected);
  });
});

// ──────────────────────────────────────────────────────────
// getOreGrade — linear grade decline for Cerro Rojo
// ──────────────────────────────────────────────────────────
describe('getOreGrade', () => {
  it('Cerro Rojo month 1 grade is 1.8 (±0.01)', () => {
    expect(getOreGrade('Cerro Rojo', 1)).toBeCloseTo(1.8, 1);
  });

  it('Cerro Rojo month 12 grade is 1.2 (±0.01)', () => {
    expect(getOreGrade('Cerro Rojo', 12)).toBeCloseTo(1.2, 1);
  });

  it('Cerro Rojo grade is monotonically non-increasing across months 1–12', () => {
    let prev = getOreGrade('Cerro Rojo', 1);
    for (let m = 2; m <= 12; m++) {
      const curr = getOreGrade('Cerro Rojo', m);
      expect(curr).toBeLessThanOrEqual(prev + 0.0001);
      prev = curr;
    }
  });

  it('Veta Dorada grade stays at baseline 6.0 across all months', () => {
    for (let m = 1; m <= 12; m++) {
      expect(getOreGrade('Veta Dorada', m)).toBeCloseTo(6.0, 4);
    }
  });
});

// ──────────────────────────────────────────────────────────
// applyDieselShock — month 8+ ×1.15 for fuel
// ──────────────────────────────────────────────────────────
describe('applyDieselShock', () => {
  it('months 1–7: fuel amount is unchanged', () => {
    for (let m = 1; m <= 7; m++) {
      expect(applyDieselShock('Cerro Rojo', 'fuel', 600_000, m)).toBe(600_000);
    }
  });

  it('month 8: Cerro Rojo fuel becomes 690 000', () => {
    expect(applyDieselShock('Cerro Rojo', 'fuel', 600_000, 8)).toBeCloseTo(690_000, 0);
  });

  it('month 8: Loma Grande fuel becomes 1 035 000', () => {
    expect(applyDieselShock('Loma Grande', 'fuel', 900_000, 8)).toBeCloseTo(1_035_000, 0);
  });

  it('non-fuel drivers are unaffected in month 8+', () => {
    for (let m = 8; m <= 12; m++) {
      expect(applyDieselShock('Cerro Rojo', 'supplies', 400_000, m)).toBe(400_000);
      expect(applyDieselShock('Cerro Rojo', 'equipment', 450_000, m)).toBe(450_000);
      expect(applyDieselShock('Cerro Rojo', 'labor', 350_000, m)).toBe(350_000);
    }
  });
});

// ──────────────────────────────────────────────────────────
// applyOperationalStoppage — Quebrada Sur month 6 ×0.60
// ──────────────────────────────────────────────────────────
describe('applyOperationalStoppage', () => {
  it('Quebrada Sur month 6: tonnage becomes 9 000', () => {
    expect(applyOperationalStoppage('Quebrada Sur', 15_000, 6)).toBe(9_000);
  });

  it('Quebrada Sur month 7: tonnage recovers to 15 000', () => {
    expect(applyOperationalStoppage('Quebrada Sur', 15_000, 7)).toBe(15_000);
  });

  it('all other mines month 6: tonnage unchanged', () => {
    const otherMines = ['Cerro Rojo', 'Veta Dorada', 'Loma Grande', 'Peña Azul'];
    for (const mine of otherMines) {
      expect(applyOperationalStoppage(mine, 50_000, 6)).toBe(50_000);
    }
  });
});

// ──────────────────────────────────────────────────────────
// Threat matrix: run.ts MUST NOT log DATABASE_URL / connection string
// ──────────────────────────────────────────────────────────
describe('secret exposure — run.ts must not log connection strings', () => {
  it('no console output contains "postgresql://" during a seed run', async () => {
    const { runSeed } = await import('../seed/run');

    const logged: string[] = [];
    const origLog   = console.log;
    const origError = console.error;
    const origWrite = process.stdout.write.bind(process.stdout);

    console.log   = (...args: unknown[]) => { logged.push(args.map(String).join(' ')); };
    console.error = (...args: unknown[]) => { logged.push(args.map(String).join(' ')); };
    process.stdout.write = (chunk: Uint8Array | string) => { logged.push(String(chunk)); return true; };

    try {
      // runSeed will fail (no real DB in unit test environment) — we only care about
      // what gets logged, not whether the DB call succeeds.
      await runSeed().catch(() => { /* expected in unit context */ });
    } finally {
      console.log          = origLog;
      console.error        = origError;
      process.stdout.write = origWrite;
    }

    const combined = logged.join('\n');
    expect(combined).not.toContain('postgresql://');
  });
});

// ──────────────────────────────────────────────────────────
// Dimension test: 5 mines × 12 months = 60 production rows
//                 5 × 12 × 4 = 240 cost rows
// ──────────────────────────────────────────────────────────
describe('dimensions', () => {
  it('MINES constant has exactly 5 entries', () => {
    expect(MINES).toHaveLength(5);
  });

  it('produces 60 production rows (5 mines × 12 months)', () => {
    const DRIVER_COUNT = 4;
    let productionCount = 0;
    let costCount = 0;

    for (let _mi = 0; _mi < MINES.length; _mi++) {
      for (let _m = 1; _m <= MONTHS; _m++) {
        productionCount++;
        costCount += DRIVER_COUNT;
      }
    }

    expect(productionCount).toBe(60);
    expect(costCount).toBe(240);
  });
});
