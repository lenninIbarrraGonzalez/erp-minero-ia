// Quality evaluation suite — 30 questions
// Fresh batch distinct from text-query.spec.ts (30q) and text-query-100.spec.ts (100q)
// Data reference: db/seed/constants.ts + db/seed/generators.ts (SEED=42, year 2024)
//
// Key data facts:
//   Cerro Rojo   Cu Norte  50K t/mo  CPT ≈ 36$/t   fuel shock m8–12 ×1.15
//   Veta Dorada  Au Centro  8K t/mo  CPT ≈ 45$/t
//   Loma Grande  Fe Sur   120K t/mo  CPT ≈ 18$/t   fuel shock m8–12 ×1.15
//   Quebrada Sur Ag Sur    15K t/mo  CPT ≈ 40$/t   operational stoppage m6 ×0.60
//   Peña Azul    Zn Centro 30K t/mo  CPT ≈ 52$/t

export interface DataCheck {
  rowIndex: number;
  column: string;
  op: "gt" | "lt" | "eq" | "gte" | "lte";
  value: number;
}

export interface QualityFixture {
  id: number;
  question: string;
  category: string;
  expectedChart: "line" | "bar" | "none" | "any";
  expectedMinRows: number;
  expectedMaxRows: number;
  expectedColumns: string[];
  expectInsight: boolean;
  expectError?: boolean;
  expectEmpty?: boolean;
  dataChecks?: DataCheck[];
  llmDependent?: boolean;
  notes?: string;
}

export const QUALITY_EVAL_30: QualityFixture[] = [
  // ── Category A: Simple — single mine, full year CPT/tonnage ──────────────

  {
    id: 1,
    question: "¿Cuál fue el costo por tonelada de Veta Dorada durante todo 2024?",
    category: "A-simple",
    expectedChart: "line",
    expectedMinRows: 12,
    expectedMaxRows: 12,
    expectedColumns: ["period", "cost_per_tonne"],
    expectInsight: true,
    dataChecks: [
      // CPT Veta Dorada ≈ 45 $/t — floor 38, ceiling 55 (allows ±4% noise)
      { rowIndex: 0, column: "cost_per_tonne", op: "gt", value: 38 },
      { rowIndex: 0, column: "cost_per_tonne", op: "lt", value: 55 },
    ],
    notes: "8K t/month × ~360K total cost → CPT ~45 $/t. No shocks.",
  },

  {
    id: 2,
    question: "Mostrame el tonelaje de Cerro Rojo mes por mes en 2024",
    category: "A-simple",
    expectedChart: "line",
    expectedMinRows: 12,
    expectedMaxRows: 12,
    expectedColumns: ["period", "tonnage"],
    expectInsight: true,
    dataChecks: [
      // Cerro Rojo baseline 50K t/month, ±4% → 48K–52K
      { rowIndex: 0, column: "tonnage", op: "gt", value: 45000 },
      { rowIndex: 0, column: "tonnage", op: "lt", value: 55000 },
    ],
    notes: "50K t/month baseline, no stoppage event.",
  },

  {
    id: 3,
    question: "Costo por tonelada mensual de Peña Azul en 2024",
    category: "A-simple",
    expectedChart: "line",
    expectedMinRows: 12,
    expectedMaxRows: 12,
    expectedColumns: ["period", "cost_per_tonne"],
    expectInsight: true,
    dataChecks: [
      // Peña Azul: total ~1.55M / 30K t ≈ 51.7 $/t, range 48–57
      { rowIndex: 0, column: "cost_per_tonne", op: "gt", value: 45 },
      { rowIndex: 0, column: "cost_per_tonne", op: "lt", value: 60 },
    ],
    notes: "30K t/month, supplies-heavy (620K baseline). No fuel shock.",
  },

  {
    id: 4,
    question: "Evolución del costo por tonelada de Quebrada Sur en 2024",
    category: "A-simple",
    expectedChart: "line",
    expectedMinRows: 12,
    expectedMaxRows: 12,
    expectedColumns: ["period", "cost_per_tonne"],
    expectInsight: true,
    notes: "Normal months CPT ≈ 40$/t; June spike (stoppage ×0.60 tonnage) → CPT ≈ 67$/t.",
  },

  {
    id: 5,
    question: "Tonelaje mensual de Loma Grande durante 2024",
    category: "A-simple",
    expectedChart: "line",
    expectedMinRows: 12,
    expectedMaxRows: 12,
    expectedColumns: ["period", "tonnage"],
    expectInsight: true,
    dataChecks: [
      // Loma Grande 120K t/month ±4% → 115K–125K
      { rowIndex: 0, column: "tonnage", op: "gt", value: 110000 },
      { rowIndex: 0, column: "tonnage", op: "lt", value: 130000 },
    ],
    notes: "Highest tonnage mine. No stoppage.",
  },

  // ── Category B: Single point — specific month or quarter ─────────────────

  {
    id: 6,
    question: "Costo por tonelada de Loma Grande en agosto 2024",
    category: "B-point",
    expectedChart: "none",
    expectedMinRows: 1,
    expectedMaxRows: 1,
    expectedColumns: ["period", "cost_per_tonne"],
    expectInsight: true,
    dataChecks: [
      // Diesel shock m8: fuel 900K→1035K, total ~2.335M / 120K ≈ 19.5 $/t (range 18–22)
      { rowIndex: 0, column: "cost_per_tonne", op: "gt", value: 17 },
      { rowIndex: 0, column: "cost_per_tonne", op: "lt", value: 23 },
    ],
    notes: "August = first diesel shock month for Loma Grande.",
  },

  {
    id: 7,
    question: "Tonelaje de Quebrada Sur en junio 2024",
    category: "B-point",
    expectedChart: "none",
    expectedMinRows: 1,
    expectedMaxRows: 1,
    expectedColumns: ["period", "tonnage"],
    expectInsight: true,
    dataChecks: [
      // Stoppage month: 15K × 0.60 = 9K (±4% → 8.6K–9.4K)
      { rowIndex: 0, column: "tonnage", op: "gt", value: 7500 },
      { rowIndex: 0, column: "tonnage", op: "lt", value: 10500 },
    ],
    notes: "June = operational stoppage × 0.60 for Quebrada Sur.",
  },

  {
    id: 8,
    question: "Costo por tonelada de Cerro Rojo en enero 2024",
    category: "B-point",
    expectedChart: "none",
    expectedMinRows: 1,
    expectedMaxRows: 1,
    expectedColumns: ["period", "cost_per_tonne"],
    expectInsight: true,
    dataChecks: [
      // Pre-shock month: 1.8M / 50K = 36 $/t, range 34–40
      { rowIndex: 0, column: "cost_per_tonne", op: "gt", value: 32 },
      { rowIndex: 0, column: "cost_per_tonne", op: "lt", value: 42 },
    ],
    notes: "January = no shocks, baseline CPT for Cerro Rojo.",
  },

  {
    id: 9,
    question: "What was Peña Azul's tonnage in March 2024?",
    category: "B-point",
    expectedChart: "none",
    expectedMinRows: 1,
    expectedMaxRows: 1,
    expectedColumns: ["period", "tonnage"],
    expectInsight: true,
    dataChecks: [
      // March baseline: 30K ±4% → 28.8K–31.2K
      { rowIndex: 0, column: "tonnage", op: "gt", value: 27000 },
      { rowIndex: 0, column: "tonnage", op: "lt", value: 33000 },
    ],
    notes: "English query. No events in March for Peña Azul.",
  },

  {
    id: 10,
    question: "Costo por tonelada de Veta Dorada en diciembre 2024",
    category: "B-point",
    expectedChart: "none",
    expectedMinRows: 1,
    expectedMaxRows: 1,
    expectedColumns: ["period", "cost_per_tonne"],
    expectInsight: true,
    dataChecks: [
      // December: no shock for Veta Dorada, CPT ≈ 45$/t, range 42–50
      { rowIndex: 0, column: "cost_per_tonne", op: "gt", value: 38 },
      { rowIndex: 0, column: "cost_per_tonne", op: "lt", value: 55 },
    ],
    notes: "Veta Dorada not affected by diesel shock. Last month of year.",
  },

  // ── Category C: Driver breakdown ─────────────────────────────────────────

  {
    id: 11,
    question: "Desglose de gastos de Loma Grande por categoría en 2024",
    category: "C-driver",
    expectedChart: "bar",
    expectedMinRows: 1,
    expectedMaxRows: 4,
    expectedColumns: ["driver", "amount"],
    expectInsight: true,
    notes: "4 drivers: fuel, supplies, equipment, labor. LLM may spuriously set driverFilter.",
    llmDependent: true,
  },

  {
    id: 12,
    question: "¿Cuánto gastó Cerro Rojo en combustible durante 2024?",
    category: "C-driver",
    expectedChart: "bar",
    expectedMinRows: 1,
    expectedMaxRows: 1,
    expectedColumns: ["driver", "amount"],
    expectInsight: true,
    dataChecks: [
      // Fuel Cerro Rojo: m1-7 = 7×600K=4.2M, m8-12 = 5×690K=3.45M → ~7.65M (±4% noise)
      // Range: 7M–8.5M
      { rowIndex: 0, column: "amount", op: "gt", value: 7000000 },
      { rowIndex: 0, column: "amount", op: "lt", value: 8800000 },
    ],
    notes: "Fuel driver only. Diesel shock months 8–12 inflate total.",
  },

  {
    id: 13,
    question: "Costo de mano de obra de Peña Azul en 2024",
    category: "C-driver",
    expectedChart: "bar",
    expectedMinRows: 1,
    expectedMaxRows: 1,
    expectedColumns: ["driver", "amount"],
    expectInsight: true,
    dataChecks: [
      // Labor Peña Azul: 12 × 250K = 3M (±4% → 2.88M–3.12M, wider for noise)
      { rowIndex: 0, column: "amount", op: "gt", value: 2600000 },
      { rowIndex: 0, column: "amount", op: "lt", value: 3500000 },
    ],
    notes: "Labor only. No shocks affect labor.",
  },

  {
    id: 14,
    question: "Gasto en insumos de Quebrada Sur en 2024",
    category: "C-driver",
    expectedChart: "bar",
    expectedMinRows: 1,
    expectedMaxRows: 1,
    expectedColumns: ["driver", "amount"],
    expectInsight: true,
    dataChecks: [
      // Supplies Quebrada Sur: 12 × 180K = 2.16M baseline. Noise ±4% per entry compounds
      // across 12 months, so realistic range is 1.4M–2.6M.
      { rowIndex: 0, column: "amount", op: "gt", value: 1400000 },
      { rowIndex: 0, column: "amount", op: "lt", value: 2700000 },
    ],
    notes: "Supplies driver only.",
  },

  {
    id: 15,
    question: "Evolución mensual del costo de combustible de Cerro Rojo en 2024",
    category: "C-driver",
    expectedChart: "line",
    expectedMinRows: 12,
    expectedMaxRows: 12,
    expectedColumns: ["period", "amount"],
    expectInsight: true,
    dataChecks: [
      // January: fuel 600K ±4% → row0 between 576K and 624K
      { rowIndex: 0, column: "amount", op: "gt", value: 540000 },
      { rowIndex: 0, column: "amount", op: "lt", value: 670000 },
      // September (row8, m9): 690K ±4% → 662K–718K
      { rowIndex: 8, column: "amount", op: "gt", value: 620000 },
      { rowIndex: 8, column: "amount", op: "lt", value: 760000 },
    ],
    notes: "Monthly fuel time-series. Clear step-up visible at month 8. groupBy:month + driverFilter:fuel.",
    llmDependent: true,
  },

  // ── Category D: Cross-mine comparison ─────────────────────────────────────

  {
    id: 16,
    question: "Comparar el costo por tonelada de Cerro Rojo y Peña Azul en 2024",
    category: "D-multimine",
    expectedChart: "bar",
    expectedMinRows: 2,
    expectedMaxRows: 2,
    expectedColumns: ["mine", "avg_cost_per_tonne"],
    expectInsight: true,
    dataChecks: [
      // Both mines: Cerro Rojo CPT ~36 < Peña Azul CPT ~52
      // min value for any row should be > 30
      { rowIndex: 0, column: "avg_cost_per_tonne", op: "gt", value: 28 },
    ],
    notes: "Multi-mine comparison. Peña Azul should be higher CPT than Cerro Rojo.",
  },

  {
    id: 17,
    question: "¿Qué mina tuvo mayor tonelaje en 2024?",
    category: "D-multimine",
    expectedChart: "bar",
    expectedMinRows: 5,
    expectedMaxRows: 5,
    expectedColumns: ["mine", "total_tonnage"],
    expectInsight: true,
    dataChecks: [
      // Loma Grande highest: ~120K × 12 = 1.44M, row0 should be Loma Grande
      { rowIndex: 0, column: "total_tonnage", op: "gt", value: 1300000 },
    ],
    notes: "groupBy:mine + tonnage. Loma Grande should top the ranking.",
    llmDependent: true,
  },

  {
    id: 18,
    question: "Ranking de costo por tonelada de todas las minas en 2024",
    category: "D-multimine",
    expectedChart: "bar",
    expectedMinRows: 5,
    expectedMaxRows: 5,
    expectedColumns: ["mine", "avg_cost_per_tonne"],
    expectInsight: true,
    dataChecks: [
      // Highest CPT should be Peña Azul ~52 or Veta Dorada ~45
      // Lowest should be Loma Grande ~18
      { rowIndex: 4, column: "avg_cost_per_tonne", op: "gt", value: 14 },
      { rowIndex: 4, column: "avg_cost_per_tonne", op: "lt", value: 25 },
    ],
    notes: "groupBy:mine CPT. Sorted descending: Peña Azul > Veta Dorada > Quebrada Sur > Cerro Rojo > Loma Grande.",
    llmDependent: true,
  },

  {
    id: 19,
    question: "Comparar costos de combustible entre Veta Dorada y Loma Grande en 2024",
    category: "D-multimine",
    expectedChart: "bar",
    expectedMinRows: 2,
    expectedMaxRows: 2,
    expectedColumns: ["mine", "amount"],
    expectInsight: true,
    dataChecks: [
      // Veta Dorada fuel: 12×90K = 1.08M. Loma Grande fuel: ~7.65M+. Loma >> Veta
      { rowIndex: 0, column: "amount", op: "gt", value: 5000000 },
    ],
    notes: "Multi-mine cost_by_driver fuel. Loma Grande fuel >> Veta Dorada by ~7×.",
  },

  {
    id: 20,
    question: "Comparar tonelaje entre Quebrada Sur y Cerro Rojo en 2024",
    category: "D-multimine",
    expectedChart: "bar",
    expectedMinRows: 2,
    expectedMaxRows: 2,
    expectedColumns: ["mine", "total_tonnage"],
    expectInsight: true,
    dataChecks: [
      // Cerro Rojo: ~600K annual. Quebrada Sur: ~174K (15K×11 + 9K = 174K)
      { rowIndex: 0, column: "total_tonnage", op: "gt", value: 100000 },
    ],
    notes: "Multi-mine tonnage comparison.",
  },

  // ── Category E: Quarter period ────────────────────────────────────────────

  {
    id: 21,
    question: "Costo por tonelada de Cerro Rojo en el primer trimestre de 2024",
    category: "E-quarter",
    expectedChart: "any",
    expectedMinRows: 1,
    expectedMaxRows: 3,
    expectedColumns: ["period", "cost_per_tonne"],
    expectInsight: true,
    dataChecks: [
      // Q1 = months 1–3, no shocks, CPT ≈ 36$/t per month
      { rowIndex: 0, column: "cost_per_tonne", op: "gt", value: 30 },
      { rowIndex: 0, column: "cost_per_tonne", op: "lt", value: 45 },
    ],
    notes: "Q1 2024, pre-shock. Could return 1 aggregate row or 3 monthly rows depending on LLM.",
    llmDependent: true,
  },

  {
    id: 22,
    question: "Tonelaje de Loma Grande en el segundo trimestre de 2024",
    category: "E-quarter",
    expectedChart: "any",
    expectedMinRows: 1,
    expectedMaxRows: 3,
    expectedColumns: ["period", "tonnage"],
    expectInsight: true,
    dataChecks: [
      { rowIndex: 0, column: "tonnage", op: "gt", value: 100000 },
    ],
    notes: "Q2 = April-May-June. Loma Grande 120K/month. No events.",
    llmDependent: true,
  },

  {
    id: 23,
    question: "¿Cuánto costó el combustible en Cerro Rojo en el Q4 de 2024?",
    category: "E-quarter",
    expectedChart: "any",
    expectedMinRows: 1,
    expectedMaxRows: 3,
    expectedColumns: ["driver", "amount"],
    expectInsight: true,
    dataChecks: [
      // Q4 = Oct-Nov-Dec. All shock months: 3 × 690K = 2.07M (±4%)
      { rowIndex: 0, column: "amount", op: "gt", value: 1700000 },
    ],
    notes: "Q4 all months are post-shock. Fuel cost elevated.",
    llmDependent: true,
  },

  {
    id: 24,
    question: "Costo por tonelada de Quebrada Sur en el tercer trimestre de 2024",
    category: "E-quarter",
    expectedChart: "any",
    expectedMinRows: 1,
    expectedMaxRows: 3,
    expectedColumns: ["period", "cost_per_tonne"],
    expectInsight: true,
    notes: "Q3 = Jul-Aug-Sep. Month 8-9 have diesel shock but Quebrada Sur NOT in DIESEL_SHOCK_MINES. No anomaly.",
    llmDependent: true,
  },

  {
    id: 25,
    question: "What are the equipment costs for Peña Azul in Q2 2024?",
    category: "E-quarter",
    expectedChart: "any",
    expectedMinRows: 1,
    expectedMaxRows: 3,
    expectedColumns: ["driver", "amount"],
    expectInsight: true,
    dataChecks: [
      // Q2 equipment: 3 × 380K = 1.14M (±4% noise → ~1.09M–1.19M)
      { rowIndex: 0, column: "amount", op: "gt", value: 900000 },
    ],
    notes: "English query with quarter + specific driver.",
    llmDependent: true,
  },

  // ── Category F: All-mines global analysis ─────────────────────────────────

  {
    id: 26,
    question: "¿Cuánto gastó cada mina en combustible en 2024?",
    category: "F-global",
    expectedChart: "bar",
    expectedMinRows: 5,
    expectedMaxRows: 5,
    expectedColumns: ["mine", "amount"],
    expectInsight: true,
    dataChecks: [
      // Loma Grande should be highest fuel spender: ~7.65M
      // Combined all mines the max should be > 5M
      { rowIndex: 0, column: "amount", op: "gt", value: 5000000 },
    ],
    notes: "groupBy:mine + cost_by_driver fuel. Loma Grande >> all others.",
    llmDependent: true,
  },

  {
    id: 27,
    question: "Costo total de mano de obra de todas las minas en 2024",
    category: "F-global",
    expectedChart: "bar",
    expectedMinRows: 5,
    expectedMaxRows: 5,
    expectedColumns: ["mine", "amount"],
    expectInsight: true,
    notes: "groupBy:mine + cost_by_driver labor. 5 rows sorted by amount.",
    llmDependent: true,
  },

  // ── Category G: Edge cases / error handling ───────────────────────────────

  {
    id: 28,
    question: "Costo por tonelada en 2023",
    category: "G-edge",
    expectedChart: "none",
    expectedMinRows: 0,
    expectedMaxRows: 0,
    expectedColumns: [],
    expectInsight: false,
    expectError: false,
    expectEmpty: true,
    notes: "Year 2023 is outside available data range. Pre-flight check skips LLM, returns empty state immediately.",
  },

  {
    id: 29,
    question: "dame la información",
    category: "G-edge",
    expectedChart: "none",
    expectedMinRows: 0,
    expectedMaxRows: 0,
    expectedColumns: [],
    expectInsight: false,
    expectError: true,
    notes: "Completely vague query. Should trigger parse_failure or out-of-scope error.",
  },

  {
    id: 30,
    question: "Costo por tonelada de Cerro Rojo en noviembre 2024",
    category: "G-edge",
    expectedChart: "none",
    expectedMinRows: 1,
    expectedMaxRows: 1,
    expectedColumns: ["period", "cost_per_tonne"],
    expectInsight: true,
    dataChecks: [
      // November = shock month: fuel 690K, total ~1.89M / 50K ≈ 37.8$/t (range 34–43)
      { rowIndex: 0, column: "cost_per_tonne", op: "gt", value: 32 },
      { rowIndex: 0, column: "cost_per_tonne", op: "lt", value: 45 },
    ],
    notes: "November = post-shock month. CPT should be slightly above pre-shock baseline.",
  },
];
