export const SEED = 42;
export const MONTHS = 12;
export const START_YEAR = 2024;

export interface MineSeed {
  name: string;
  region: string;
  mineral_type: 'Cu' | 'Au' | 'Fe' | 'Ag' | 'Zn';
  baselineTonnage: number;
  baselineGrade: number;
}

export const MINES: MineSeed[] = [
  { name: 'Cerro Rojo',   region: 'Norte',  mineral_type: 'Cu', baselineTonnage: 50_000,  baselineGrade: 1.8   },
  { name: 'Veta Dorada',  region: 'Centro', mineral_type: 'Au', baselineTonnage: 8_000,   baselineGrade: 6.0   },
  { name: 'Loma Grande',  region: 'Sur',    mineral_type: 'Fe', baselineTonnage: 120_000, baselineGrade: 58.0  },
  { name: 'Quebrada Sur', region: 'Sur',    mineral_type: 'Ag', baselineTonnage: 15_000,  baselineGrade: 180.0 },
  { name: 'Peña Azul',    region: 'Centro', mineral_type: 'Zn', baselineTonnage: 30_000,  baselineGrade: 8.0   },
];

export const DRIVER_BASELINES: Record<string, Record<string, number>> = {
  'Cerro Rojo':   { fuel: 600_000, supplies: 400_000, equipment: 450_000, labor: 350_000 },
  'Veta Dorada':  { fuel:  90_000, supplies: 110_000, equipment:  90_000, labor:  70_000 },
  'Loma Grande':  { fuel: 900_000, supplies: 350_000, equipment: 700_000, labor: 250_000 },
  'Quebrada Sur': { fuel: 130_000, supplies: 180_000, equipment: 160_000, labor: 130_000 },
  'Peña Azul':    { fuel: 300_000, supplies: 620_000, equipment: 380_000, labor: 250_000 },
};

export interface SupplierSeed {
  name: string;
  reliability_score: number;
}

export const SUPPLIERS: SupplierSeed[] = [
  { name: 'Diésel del Norte',     reliability_score: 0.85 },
  { name: 'Reactivos del Sur',    reliability_score: 0.62 },
  { name: 'Explosivos Andinos',   reliability_score: 0.90 },
  { name: 'Repuestos Cordillera', reliability_score: 0.88 },
  { name: 'Lubricantes Sur',      reliability_score: 0.80 },
];

export interface SupplyCatalogEntry {
  name: string;
  unit: string;
  category: string;
}

export const SUPPLIES_CATALOG: SupplyCatalogEntry[] = [
  { name: 'Diesel',             unit: 'liter', category: 'fuel'       },
  { name: 'Reactivos Flotación',unit: 'kg',    category: 'reagents'   },
  { name: 'Explosivos ANFO',    unit: 'kg',    category: 'explosives' },
  { name: 'Repuestos Varios',   unit: 'unit',  category: 'reagents'   },
  { name: 'Lubricantes',        unit: 'liter', category: 'fuel'       },
];

// Grade endpoints for geological decline
export const GRADE_ENDPOINTS: Record<string, { start: number; end: number }> = {
  'Cerro Rojo': { start: 1.8, end: 1.2 },
};

// Mines affected by diesel shock (month 8+, fuel driver, ×1.15)
export const DIESEL_SHOCK_MINES = new Set(['Cerro Rojo', 'Loma Grande']);

// Mine affected by operational stoppage (month 6, ×0.60 tonnage)
export const STOPPAGE_MINE = 'Quebrada Sur';
export const STOPPAGE_MONTH = 6;
export const STOPPAGE_FACTOR = 0.60;
export const DIESEL_SHOCK_MONTH = 8;
export const DIESEL_SHOCK_FACTOR = 1.15;
