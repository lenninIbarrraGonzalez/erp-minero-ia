// 30 error test cases for text-query error handling validation
// Each case is designed to trigger a specific error code and verify proper UI feedback

export const ERROR_TEST_CASES_30 = [
  // ============================================================================
  // CATEGORY 1: Year Out of Range (3 cases)
  // Expected error code: year_out_of_range
  // ============================================================================
  {
    id: "E1-YO1",
    category: "year_out_of_range",
    query: "¿Cuál fue el tonelaje total en 2023?",
    description: "Year before 2024",
    expectedErrorCode: "year_out_of_range",
    expectedMessageKey: "textQuery.error.yearOutOfRange",
  },
  {
    id: "E2-YO2",
    category: "year_out_of_range",
    query: "Show me 2025 production data",
    description: "Year after 2024 (English)",
    expectedErrorCode: "year_out_of_range",
    expectedMessageKey: "textQuery.error.yearOutOfRange",
  },
  {
    id: "E3-YO3",
    category: "year_out_of_range",
    query: "Tonelaje en 2020",
    description: "Multiple years before 2024",
    expectedErrorCode: "year_out_of_range",
    expectedMessageKey: "textQuery.error.yearOutOfRange",
  },

  // ============================================================================
  // CATEGORY 2: Ambiguous Query (3 cases)
  // Expected error code: ambiguous_query
  // ============================================================================
  {
    id: "E4-AQ1",
    category: "ambiguous_query",
    query: "¿Cuál fue el costo?",
    description: "No metric specified — cost ambiguous (cost_per_tonne vs cost_by_driver)",
    expectedErrorCode: "ambiguous_query",
    expectedMessageKey: "textQuery.error.ambiguousQuery",
  },
  {
    id: "E5-AQ2",
    category: "ambiguous_query",
    query: "Show me the numbers",
    description: "Too vague, no clear metric",
    expectedErrorCode: "ambiguous_query",
    expectedMessageKey: "textQuery.error.ambiguousQuery",
  },
  {
    id: "E6-AQ3",
    category: "ambiguous_query",
    query: "¿Data de 2024?",
    description: "No metric and no mine specified",
    expectedErrorCode: "ambiguous_query",
    expectedMessageKey: "textQuery.error.ambiguousQuery",
  },

  // ============================================================================
  // CATEGORY 3: Overlapping Period (3 cases)
  // Expected error code: overlapping_period
  // ============================================================================
  {
    id: "E7-OP1",
    category: "overlapping_period",
    query: "Tonelaje en Q1 y enero 2024",
    description: "Quarter and month overlap",
    expectedErrorCode: "overlapping_period",
    expectedMessageKey: "textQuery.error.overlappingPeriod",
  },
  {
    id: "E8-OP2",
    category: "overlapping_period",
    query: "Costo en Q2 y mayo 2024",
    description: "Quarter and overlapping month",
    expectedErrorCode: "overlapping_period",
    expectedMessageKey: "textQuery.error.overlappingPeriod",
  },
  {
    id: "E9-OP3",
    category: "overlapping_period",
    query: "Show Q4 and December 2024 cost per tonne",
    description: "Quarter and month overlap (English)",
    expectedErrorCode: "overlapping_period",
    expectedMessageKey: "textQuery.error.overlappingPeriod",
  },

  // ============================================================================
  // CATEGORY 4: Parse Failure (4 cases)
  // Expected error code: parse_failure
  // ============================================================================
  {
    id: "E10-PF1",
    category: "parse_failure",
    query: "@#$%^&*() !@#$",
    description: "Completely invalid characters",
    expectedErrorCode: "parse_failure",
    expectedMessageKey: "textQuery.error.parseFailure",
  },
  {
    id: "E11-PF2",
    category: "parse_failure",
    query: "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua",
    description: "Nonsensical long text",
    expectedErrorCode: "parse_failure",
    expectedMessageKey: "textQuery.error.parseFailure",
  },
  {
    id: "E12-PF3",
    category: "parse_failure",
    query: "xyz abc 123 qwe rty",
    description: "Random words no structure",
    expectedErrorCode: "parse_failure",
    expectedMessageKey: "textQuery.error.parseFailure",
  },
  {
    id: "E13-PF4",
    category: "parse_failure",
    query: "║═╬╰╯┃┄┊┋┌┐└┘─ ▄▀",
    description: "Box drawing characters",
    expectedErrorCode: "parse_failure",
    expectedMessageKey: "textQuery.error.parseFailure",
  },

  // ============================================================================
  // CATEGORY 5: Unsupported Metric (4 cases)
  // Expected error code: unsupported_metric
  // ============================================================================
  {
    id: "E14-UM1",
    category: "unsupported_metric",
    query: "¿Cuál fue el margen de ganancia en 2024?",
    description: "Metric not in scope (profit margin)",
    expectedErrorCode: "unsupported_metric",
    expectedMessageKey: "textQuery.error.unsupportedMetric",
  },
  {
    id: "E15-UM2",
    category: "unsupported_metric",
    query: "Show me the environmental impact in Cerro Rojo",
    description: "Unsupported metric (environmental)",
    expectedErrorCode: "unsupported_metric",
    expectedMessageKey: "textQuery.error.unsupportedMetric",
  },
  {
    id: "E16-UM3",
    category: "unsupported_metric",
    query: "Productividad por trabajador en 2024",
    description: "Productivity metric not supported",
    expectedErrorCode: "unsupported_metric",
    expectedMessageKey: "textQuery.error.unsupportedMetric",
  },
  {
    id: "E17-UM4",
    category: "unsupported_metric",
    query: "Revenue per mine in Q1 2024",
    description: "Revenue metric not supported",
    expectedErrorCode: "unsupported_metric",
    expectedMessageKey: "textQuery.error.unsupportedMetric",
  },

  // ============================================================================
  // CATEGORY 6: Mine Not Found (3 cases)
  // Expected error code: mine_not_found
  // ============================================================================
  {
    id: "E18-MNF1",
    category: "mine_not_found",
    query: "¿Cuál fue el tonelaje de Mina Inexistente en 2024?",
    description: "Non-existent mine name",
    expectedErrorCode: "mine_not_found",
    expectedMessageKey: "textQuery.error.mineNotFound",
  },
  {
    id: "E19-MNF2",
    category: "mine_not_found",
    query: "Cost per tonne for Mount Unknown in 2024",
    description: "English mine name doesn't exist",
    expectedErrorCode: "mine_not_found",
    expectedMessageKey: "textQuery.error.mineNotFound",
  },
  {
    id: "E20-MNF3",
    category: "mine_not_found",
    query: "Costo de SuperMina en enero 2024",
    description: "Fictional Spanish mine name",
    expectedErrorCode: "mine_not_found",
    expectedMessageKey: "textQuery.error.mineNotFound",
  },

  // ============================================================================
  // CATEGORY 7: Empty Result (3 cases)
  // Expected error code: empty_result (renders as empty state)
  // ============================================================================
  {
    id: "E21-ER1",
    category: "empty_result",
    query: "Tonelaje de Cerro Rojo en diciembre de 2025",
    description: "Valid query but year outside data range (2025)",
    expectedErrorCode: "empty_result",
    expectedMessageKey: "textQuery.emptyResult",
  },
  {
    id: "E22-ER2",
    category: "empty_result",
    query: "Cost by labor in July 2024",
    description: "Valid metric but no data matches",
    expectedErrorCode: "empty_result",
    expectedMessageKey: "textQuery.emptyResult",
  },
  {
    id: "E23-ER3",
    category: "empty_result",
    query: "¿Tonelaje de una mina que ya cerró?",
    description: "Mine exists but no data for that period",
    expectedErrorCode: "empty_result",
    expectedMessageKey: "textQuery.emptyResult",
  },

  // ============================================================================
  // CATEGORY 8: Out of Scope (2 cases)
  // Expected error code: out_of_scope
  // ============================================================================
  {
    id: "E24-OS1",
    category: "out_of_scope",
    query: "¿Cuál es la capital de Argentina?",
    description: "Completely out of mining domain",
    expectedErrorCode: "out_of_scope",
    expectedMessageKey: "textQuery.error.outOfScope",
  },
  {
    id: "E25-OS2",
    category: "out_of_scope",
    query: "Tell me about the weather in 2024",
    description: "Weather data not in scope",
    expectedErrorCode: "out_of_scope",
    expectedMessageKey: "textQuery.error.outOfScope",
  },

  // ============================================================================
  // CATEGORY 9: Invalid Input Format (2 cases)
  // Expected error code: parse_failure (malformed input)
  // ============================================================================
  {
    id: "E26-IF1",
    category: "invalid_format",
    query: ".",
    description: "Minimal invalid query (single character)",
    expectedErrorCode: "parse_failure",
    expectedMessageKey: "textQuery.error.parseFailure",
  },
  {
    id: "E27-IF2",
    category: "invalid_format",
    query: "? ? ?",
    description: "Only question marks (no semantic content)",
    expectedErrorCode: "parse_failure",
    expectedMessageKey: "textQuery.error.parseFailure",
  },

  // ============================================================================
  // CATEGORY 10: Edge Case Combinations (3 cases)
  // Expected error codes: various
  // ============================================================================
  {
    id: "E28-EC1",
    category: "edge_case",
    query: "¿Costo en Q1 y marzo y enero 2020?",
    description: "Multiple overlapping periods + year out of range",
    expectedErrorCode: "year_out_of_range", // year_out_of_range takes precedence
    expectedMessageKey: "textQuery.error.yearOutOfRange",
  },
  {
    id: "E29-EC2",
    category: "edge_case",
    query: "Cost",
    description: "Single word, too ambiguous",
    expectedErrorCode: "ambiguous_query",
    expectedMessageKey: "textQuery.error.ambiguousQuery",
  },
  {
    id: "E30-EC3",
    category: "edge_case",
    query: "Show tonelaje for MineNotExist in Q2 and May 2024",
    description: "Mine not found + overlapping period",
    expectedErrorCode: "mine_not_found", // mine_not_found typically takes precedence in parsing
    expectedMessageKey: "textQuery.error.mineNotFound",
  },
];

// Summary of distribution
export const ERROR_DISTRIBUTION = {
  year_out_of_range: 3,
  ambiguous_query: 3,
  overlapping_period: 3,
  parse_failure: 4,
  unsupported_metric: 4,
  mine_not_found: 3,
  empty_result: 3,
  out_of_scope: 2,
  invalid_format: 2,
  edge_case: 3,
};
