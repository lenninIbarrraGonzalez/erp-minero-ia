import {
  DRIVER_BASELINES,
  GRADE_ENDPOINTS,
  DIESEL_SHOCK_MINES,
  DIESEL_SHOCK_MONTH,
  DIESEL_SHOCK_FACTOR,
  STOPPAGE_MINE,
  STOPPAGE_MONTH,
  STOPPAGE_FACTOR,
} from './constants';

/**
 * mulberry32 — deterministic 32-bit PRNG.
 * Returns a factory that produces values in [0, 1).
 * Two calls with the same seed produce byte-identical sequences.
 */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * addNoise — applies ±4% multiplicative noise to an amount.
 * The noise factor is uniformly sampled from [0.96, 1.04] using the provided rng.
 */
export function addNoise(amount: number, rng: () => number): number {
  const factor = 0.96 + rng() * 0.08; // [0.96, 1.04)
  return amount * factor;
}

/**
 * getBaselineCost — returns the authoritative baseline cost amount for
 * a given (mineName, driver) pair from DRIVER_BASELINES.
 */
export function getBaselineCost(mineName: string, driver: string): number {
  const mineBaselines = DRIVER_BASELINES[mineName];
  if (!mineBaselines) {
    throw new Error(`Unknown mine: ${mineName}`);
  }
  const amount = mineBaselines[driver];
  if (amount === undefined) {
    throw new Error(`Unknown driver "${driver}" for mine "${mineName}"`);
  }
  return amount;
}

/**
 * getOreGrade — returns the ore grade for a mine at a given month (1-indexed).
 * Cerro Rojo declines linearly from 1.8 (m=1) to 1.2 (m=12).
 * All other mines return their constant baseline grade from GRADE_ENDPOINTS
 * or a default passed by callers; falls back to the mine's constant.
 */
export function getOreGrade(mineName: string, month: number): number {
  const endpoints = GRADE_ENDPOINTS[mineName];
  if (!endpoints) {
    // Mine has no decline — return its constant grade
    // (callers that need the actual constant grade should pass it from MINES)
    // For non-declining mines we just return the constant registered per mine.
    // Since GRADE_ENDPOINTS only lists mines with decline, return constant from
    // a lookup that returns a stable value. We use a fallback constant map here.
    const CONSTANT_GRADES: Record<string, number> = {
      'Veta Dorada':  6.0,
      'Loma Grande':  58.0,
      'Quebrada Sur': 180.0,
      'Peña Azul':    8.0,
    };
    const grade = CONSTANT_GRADES[mineName];
    if (grade === undefined) {
      throw new Error(`Unknown mine: ${mineName}`);
    }
    return grade;
  }
  // Linear interpolation: month 1 → start, month 12 → end
  // grade = start - (start - end) * (month - 1) / (12 - 1)
  const { start, end } = endpoints;
  return start - (start - end) * ((month - 1) / 11);
}

/**
 * applyDieselShock — applies ×1.15 to fuel amounts starting month 8
 * for mines listed in DIESEL_SHOCK_MINES.
 * Returns the original amount for non-fuel drivers or months < 8.
 */
export function applyDieselShock(
  mineName: string,
  driver: string,
  amount: number,
  month: number,
): number {
  if (driver === 'fuel' && month >= DIESEL_SHOCK_MONTH && DIESEL_SHOCK_MINES.has(mineName)) {
    return amount * DIESEL_SHOCK_FACTOR;
  }
  return amount;
}

/**
 * applyOperationalStoppage — reduces tonnage by 40% for STOPPAGE_MINE on STOPPAGE_MONTH.
 * All other mines and months are unchanged.
 */
export function applyOperationalStoppage(
  mineName: string,
  tonnage: number,
  month: number,
): number {
  if (mineName === STOPPAGE_MINE && month === STOPPAGE_MONTH) {
    return tonnage * STOPPAGE_FACTOR;
  }
  return tonnage;
}
