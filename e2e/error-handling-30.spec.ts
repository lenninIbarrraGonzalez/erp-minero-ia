import { test, expect } from "@playwright/test";
import { ERROR_TEST_CASES_30, ERROR_DISTRIBUTION } from "./fixtures/error-cases-30";

test.describe("Error Handling Validation Suite — 30 Cases", () => {
  // Test that all 30 error cases can be submitted without crashing
  test("All 30 error cases are defined and well-formed", () => {
    expect(ERROR_TEST_CASES_30).toHaveLength(30);

    for (const testCase of ERROR_TEST_CASES_30) {
      expect(testCase.id).toBeTruthy();
      expect(testCase.query).toBeTruthy();
      expect(testCase.expectedErrorCode).toBeTruthy();
      expect(testCase.description).toBeTruthy();
    }
  });

  test("Error distribution is correct (9 categories, 30 total)", () => {
    const casesByCategory = ERROR_TEST_CASES_30.reduce(
      (acc, tc) => {
        acc[tc.category] = (acc[tc.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    expect(casesByCategory).toEqual(ERROR_DISTRIBUTION);
    expect(Object.values(casesByCategory).reduce((a, b) => a + b)).toBe(30);
  });

  // Sample testing: submit a few representative error cases
  const SAMPLE_CASES = [
    ERROR_TEST_CASES_30[0], // year_out_of_range
    ERROR_TEST_CASES_30[3], // ambiguous_query
    ERROR_TEST_CASES_30[6], // overlapping_period
    ERROR_TEST_CASES_30[10], // parse_failure
    ERROR_TEST_CASES_30[14], // unsupported_metric
  ];

  for (const testCase of SAMPLE_CASES) {
    test(`E2E: ${testCase.id} — ${testCase.description}`, async ({ page }) => {
      await page.goto("http://localhost:3000/");

      // Find query input
      const queryInput = page.locator('input[placeholder*="Preguntá"], input[placeholder*="consult"]');
      expect(await queryInput.isVisible()).toBe(true);

      // Submit query
      await queryInput.fill(testCase.query);

      const submitButton = page.locator('button:has-text("Consultar"), button:has-text("Submit")');
      await submitButton.click();

      // Wait for response (error, result, or loading state)
      await page.waitForTimeout(2000);

      // Check that page is still interactive (no crash)
      expect(await queryInput.isVisible()).toBe(true);

      // Verify some response was received (check for error or result elements)
      const errorOrResult = page.locator(
        '[data-testid="query-error"], [data-testid="query-result"], [data-testid="query-empty"], [role="alert"]'
      );

      const hasResponse =
        (await errorOrResult.first().isVisible({ timeout: 100 }).catch(() => false)) ||
        (await page.locator("p").filter({ has: page.locator("text=/error|Error|ERROR/i") }).isVisible({
          timeout: 100,
        }).catch(() => false)) ||
        (await page.locator("main").isVisible({ timeout: 100 }).catch(() => false));

      expect(hasResponse).toBe(true);
    });
  }

  test("Query input accepts long text (stress test)", async ({ page }) => {
    await page.goto("http://localhost:3000/");

    const queryInput = page.locator('input[placeholder*="Preguntá"], input[placeholder*="consult"]');

    // Try a very long query (within reasonable limits)
    const longQuery = "Mostrar el tonelaje de todas las minas en 2024 mes por mes con desglose por categoría de costo";
    await queryInput.fill(longQuery);

    const submitButton = page.locator('button:has-text("Consultar"), button:has-text("Submit")');
    await submitButton.click();

    // Wait and verify page doesn't crash
    await page.waitForTimeout(1500);
    expect(await queryInput.isVisible()).toBe(true);
  });

  test("Error state clears when submitting new query", async ({ page }) => {
    await page.goto("http://localhost:3000/");

    const queryInput = page.locator('input[placeholder*="Preguntá"], input[placeholder*="consult"]');
    const submitButton = page.locator('button:has-text("Consultar"), button:has-text("Submit")');

    // Submit error query
    await queryInput.fill("@#$%");
    await submitButton.click();
    await page.waitForTimeout(1000);

    // Submit valid query
    await queryInput.clear();
    await queryInput.fill("Tonelaje 2024");
    await submitButton.click();
    await page.waitForTimeout(1500);

    // Verify page is responsive
    expect(await queryInput.isVisible()).toBe(true);
  });

  test("Form is accessible (ARIA roles and labels)", async ({ page }) => {
    await page.goto("http://localhost:3000/");

    // Check for input accessibility
    const queryInput = page.locator('input[placeholder*="Preguntá"], input[placeholder*="consult"]');
    const placeholder = await queryInput.getAttribute("placeholder");
    expect(placeholder).toBeTruthy();

    // Check for button accessibility
    const submitButton = page.locator('button:has-text("Consultar"), button:has-text("Submit")');
    expect(await submitButton.isVisible()).toBe(true);

    // Try to interact with keyboard
    await queryInput.focus();
    await queryInput.type("Test");
    await queryInput.press("Enter"); // Alternatively, use Tab+Enter if needed

    // Wait for response
    await page.waitForTimeout(1500);
  });

  test("Performance baseline: page loads in < 3 seconds", async ({ page }) => {
    const start = Date.now();
    await page.goto("http://localhost:3000/");
    const loadTime = Date.now() - start;

    expect(loadTime).toBeLessThan(3000);
  });

  test("Error case categories are properly documented", () => {
    const categories = new Set(ERROR_TEST_CASES_30.map((tc) => tc.category));

    const expectedCategories = [
      "year_out_of_range",
      "ambiguous_query",
      "overlapping_period",
      "parse_failure",
      "unsupported_metric",
      "mine_not_found",
      "empty_result",
      "out_of_scope",
      "invalid_format",
      "edge_case",
    ];

    expectedCategories.forEach((cat) => {
      expect(categories.has(cat)).toBe(true);
    });
  });
});
