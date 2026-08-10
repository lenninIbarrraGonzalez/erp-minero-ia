// 30 error test cases targeting features added in commit f84ebc5
// Focus: recovery hints, "did you mean" suggestions, char counter, stats endpoint
// Known mines: "Cerro Rojo", "Veta Dorada", "Loma Grande", "Quebrada Sur", "Peña Azul"

export type HintExpectation = "present" | "absent" | "n/a";
export type SuggestionExpectation = "present" | "absent" | "n/a";

export interface ErrorV2TestCase {
  id: string;
  group: string;
  query: string;
  description: string;
  deterministic: boolean; // false = LLM-dependent, soft assertion
  expectedError: boolean;
  expectedHint: HintExpectation;
  expectedSuggestions: SuggestionExpectation;
  note?: string;
}

export const ERROR_V2_CASES: ErrorV2TestCase[] = [
  // ============================================================================
  // GROUP A — Year Out of Range (route-level, deterministic, hint PRESENT)
  // ============================================================================
  {
    id: "A1",
    group: "year_out_of_range",
    query: "Tonelaje en 2023",
    description: "Year before 2024 — route pre-flight blocks before LLM",
    deterministic: true,
    expectedError: true,
    expectedHint: "present",
    expectedSuggestions: "absent",
  },
  {
    id: "A2",
    group: "year_out_of_range",
    query: "Show production data for 2025",
    description: "Year after 2024 (English)",
    deterministic: true,
    expectedError: true,
    expectedHint: "present",
    expectedSuggestions: "absent",
  },
  {
    id: "A3",
    group: "year_out_of_range",
    query: "Costos de Cerro Rojo en 2022",
    description: "Year out of range with valid mine name",
    deterministic: true,
    expectedError: true,
    expectedHint: "present",
    expectedSuggestions: "absent",
  },
  {
    id: "A4",
    group: "year_out_of_range",
    query: "Tonelaje 2019",
    description: "Very old year — pre-flight fires",
    deterministic: true,
    expectedError: true,
    expectedHint: "present",
    expectedSuggestions: "absent",
  },
  {
    id: "A5",
    group: "year_out_of_range",
    query: "Cost per tonne 2026",
    description: "Future year (English)",
    deterministic: true,
    expectedError: true,
    expectedHint: "present",
    expectedSuggestions: "absent",
  },

  // ============================================================================
  // GROUP B — Char Counter (client-side, no API call)
  // ============================================================================
  {
    id: "B1",
    group: "char_counter",
    query: "A".repeat(399),
    description: "399 chars — counter NOT shown (below WARN_AT=400)",
    deterministic: true,
    expectedError: false,
    expectedHint: "n/a",
    expectedSuggestions: "n/a",
    note: "Counter hidden below 400",
  },
  {
    id: "B2",
    group: "char_counter",
    query: "A".repeat(401),
    description: "401 chars — counter shown in yellow",
    deterministic: true,
    expectedError: false,
    expectedHint: "n/a",
    expectedSuggestions: "n/a",
    note: "Counter visible, yellow class",
  },
  {
    id: "B3",
    group: "char_counter",
    query: "A".repeat(450),
    description: "450 chars — counter shows 450/500",
    deterministic: true,
    expectedError: false,
    expectedHint: "n/a",
    expectedSuggestions: "n/a",
    note: "Counter text = '450/500'",
  },
  {
    id: "B4",
    group: "char_counter",
    query: "A".repeat(499),
    description: "499 chars — counter shows 499/500, yellow",
    deterministic: true,
    expectedError: false,
    expectedHint: "n/a",
    expectedSuggestions: "n/a",
    note: "Counter text = '499/500', yellow",
  },
  {
    id: "B5",
    group: "char_counter",
    query: "A".repeat(500),
    description: "500 chars — counter shows 500/500 in red",
    deterministic: true,
    expectedError: false,
    expectedHint: "n/a",
    expectedSuggestions: "n/a",
    note: "Counter text = '500/500', red class",
  },

  // ============================================================================
  // GROUP C — Mine Not Found + Suggestions (hint PRESENT, Levenshtein-based)
  // ============================================================================
  {
    id: "C1",
    group: "mine_suggestions",
    query: "Tonelaje de Cerro Roja en 2024",
    description: "Typo of 'Cerro Rojo' (distance=1) — suggestion should appear",
    deterministic: false,
    expectedError: true,
    expectedHint: "present",
    expectedSuggestions: "present",
    note: "Levenshtein('cerro roja','cerro rojo')=1 ≤ 5",
  },
  {
    id: "C2",
    group: "mine_suggestions",
    query: "Tonelaje de Veta Morada en 2024",
    description: "'Veta Morada' — different word, distance=1 from 'Veta Dorada' — suggestion should appear",
    deterministic: false,
    expectedError: true,
    expectedHint: "present",
    expectedSuggestions: "present",
    note: "Levenshtein('veta morada','veta dorada')=1 ≤ 5; 'morada' (purple) is a real Spanish word, not a typo — LLM won't autocorrect it to 'dorada' (golden)",
  },
  {
    id: "C3",
    group: "mine_suggestions",
    query: "Costo en Loma Grands 2024",
    description: "Typo of 'Loma Grande' (distance=2) — suggestion should appear",
    deterministic: false,
    expectedError: true,
    expectedHint: "present",
    expectedSuggestions: "present",
    note: "Levenshtein('loma grands','loma grande')=2 ≤ 5",
  },
  {
    id: "C4",
    group: "mine_suggestions",
    query: "Costo de MegaMina SuperGold 2024",
    description: "Completely fictional mine (distance >5) — NO suggestions",
    deterministic: false,
    expectedError: true,
    expectedHint: "present",
    expectedSuggestions: "absent",
    note: "Distance too large — no suggestion shown",
  },

  // ============================================================================
  // GROUP D — Hint Present (LLM-dependent errors that include a hint)
  // ============================================================================
  {
    id: "D1",
    group: "hint_present",
    query: "@#$%^&*()",
    description: "Special chars — parse_failure → hint shown",
    deterministic: false,
    expectedError: true,
    expectedHint: "present",
    expectedSuggestions: "absent",
  },
  {
    id: "D2",
    group: "hint_present",
    query: "Lorem ipsum dolor sit amet",
    description: "Latin placeholder text — parse_failure or out_of_scope → hint shown",
    deterministic: false,
    expectedError: true,
    expectedHint: "present",
    expectedSuggestions: "absent",
  },
  {
    id: "D3",
    group: "hint_present",
    query: "¿Cuál es la capital de Argentina?",
    description: "Geography question — out_of_scope → hint shown",
    deterministic: false,
    expectedError: true,
    expectedHint: "present",
    expectedSuggestions: "absent",
  },
  {
    id: "D4",
    group: "hint_present",
    query: "Tell me about the weather forecast",
    description: "Weather — out_of_scope → hint shown",
    deterministic: false,
    expectedError: true,
    expectedHint: "present",
    expectedSuggestions: "absent",
  },
  {
    id: "D5",
    group: "hint_present",
    query: "Tonelaje de Mina Nonexistente en 2024",
    description: "Clearly non-existent mine — mine_not_found → hint shown",
    deterministic: false,
    expectedError: true,
    expectedHint: "present",
    expectedSuggestions: "absent",
    note: "No close match — hint shown, no suggestions",
  },
  {
    id: "D6",
    group: "hint_present",
    query: "║═╬╰┃┌┐└┘─▄▀",
    description: "Box-drawing chars — parse_failure → hint shown",
    deterministic: false,
    expectedError: true,
    expectedHint: "present",
    expectedSuggestions: "absent",
  },

  // ============================================================================
  // GROUP E — Mixed: some hint_present (LLM returns out_of_scope), some no_hint
  // E1/E2/E5/E6 → LLM classifies as out_of_scope (has hint in getHintKey)
  // E3/E4 → overlapping_period guard (no hint key) — kept in no_hint group
  // ============================================================================
  {
    id: "E1",
    group: "hint_present",
    query: "¿Cuál fue el costo?",
    description: "Vague query — LLM returns out_of_scope → hint shown",
    deterministic: false,
    expectedError: true,
    expectedHint: "present",
    expectedSuggestions: "absent",
    note: "LLM classifies as out_of_scope, not ambiguous_query; out_of_scope has a hint key",
  },
  {
    id: "E2",
    group: "hint_present",
    query: "Show me the numbers",
    description: "Vague English query — LLM returns out_of_scope → hint shown",
    deterministic: false,
    expectedError: true,
    expectedHint: "present",
    expectedSuggestions: "absent",
    note: "LLM classifies as out_of_scope; out_of_scope has a hint key",
  },
  {
    id: "E3",
    group: "no_hint",
    query: "Tonelaje de Cerro Rojo en el primer trimestre y en febrero de 2024",
    description: "Dual period (quarter + month) — overlapping_period → NO hint",
    deterministic: false,
    expectedError: true,
    expectedHint: "absent",
    expectedSuggestions: "absent",
    note: "Explicit Q1 + February forces LLM to set both period fields; overlapping_period has no hint key",
  },
  {
    id: "E4",
    group: "no_hint",
    query: "Show Cerro Rojo tonnage in Q1 and in February 2024",
    description: "Dual period English (Q1 + February) — overlapping_period → NO hint",
    deterministic: false,
    expectedError: true,
    expectedHint: "absent",
    expectedSuggestions: "absent",
    note: "Explicit Q1 + February forces LLM to set both period fields; overlapping_period has no hint key",
  },
  {
    id: "E5",
    group: "hint_present",
    query: "¿Cuál fue el margen de ganancia en 2024?",
    description: "Profit margin — LLM returns out_of_scope → hint shown",
    deterministic: false,
    expectedError: true,
    expectedHint: "present",
    expectedSuggestions: "absent",
    note: "LLM classifies as out_of_scope (not a mining metric); out_of_scope has a hint key",
  },
  {
    id: "E6",
    group: "hint_present",
    query: "What is the stock price of mining company XYZ?",
    description: "Stock price — deterministically out_of_scope → hint shown",
    deterministic: false,
    expectedError: true,
    expectedHint: "present",
    expectedSuggestions: "absent",
    note: "Stock price is unambiguously out_of_scope for a mining cost ERP; out_of_scope has a hint key",
  },

  // ============================================================================
  // GROUP F — Stats Endpoint Validation
  // ============================================================================
  {
    id: "F1",
    group: "stats",
    query: "GET /api/text-query/stats",
    description: "Stats endpoint returns valid JSON structure",
    deterministic: true,
    expectedError: false,
    expectedHint: "n/a",
    expectedSuggestions: "n/a",
    note: "Direct API call — no UI",
  },
  {
    id: "F2",
    group: "stats",
    query: "Stats windowMs should be 60000",
    description: "60-second sliding window confirmed in response",
    deterministic: true,
    expectedError: false,
    expectedHint: "n/a",
    expectedSuggestions: "n/a",
    note: "Direct API call",
  },
  {
    id: "F3",
    group: "stats",
    query: "Stats total increases after errors",
    description: "After triggering errors, stats.total > 0",
    deterministic: true,
    expectedError: false,
    expectedHint: "n/a",
    expectedSuggestions: "n/a",
    note: "Depends on prior test runs within 60s window",
  },

  // ============================================================================
  // GROUP G — UI Interaction & Controlled Mode
  // ============================================================================
  {
    id: "G1",
    group: "ui_interaction",
    query: "Tonelaje en 2023",
    description: "Error clears when new query is submitted",
    deterministic: true,
    expectedError: true,
    expectedHint: "present",
    expectedSuggestions: "absent",
    note: "Submit error query, then valid query — error disappears",
  },
  {
    id: "G2",
    group: "ui_interaction",
    query: "Tonelaje de Cerro Roja en 2024",
    description: "Click suggestion fills input (controlled mode)",
    deterministic: false,
    expectedError: true,
    expectedHint: "present",
    expectedSuggestions: "present",
    note: "After suggestion appears, click fills input value",
  },
  {
    id: "G3",
    group: "ui_interaction",
    query: "Tonelaje en 2023",
    description: "Error element has role=alert",
    deterministic: true,
    expectedError: true,
    expectedHint: "present",
    expectedSuggestions: "absent",
    note: "ARIA role=alert must be present on error container",
  },
];

// Total: 32 test cases (5+5+4+10+2+3+3)
// hint_present: D1-D6 (6) + E1/E2/E5/E6 (4) = 10
// no_hint: E3/E4 (2) — overlapping_period has no hint key
export const V2_GROUP_DISTRIBUTION = {
  year_out_of_range: 5,
  char_counter: 5,
  mine_suggestions: 4,
  hint_present: 10,
  no_hint: 2,
  stats: 3,
  ui_interaction: 3,
};
