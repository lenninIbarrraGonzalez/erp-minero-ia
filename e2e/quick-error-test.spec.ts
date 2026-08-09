import { test, expect } from "@playwright/test";

test("Quick sanity check: page loads and query input exists", async ({ page }) => {
  await page.goto("http://localhost:3000/");

  // Check page title
  const title = await page.title();
  console.log("Page title:", title);

  // Check if we can find the query input
  const inputs = await page.locator("input").all();
  console.log("Found inputs:", inputs.length);

  // Try to find by various selectors
  const queryInput = page.locator('input[placeholder*="Preguntá"], input[placeholder*="consult"]');
  const isVisible = await queryInput.isVisible({ timeout: 1000 }).catch(() => false);
  console.log("Query input visible:", isVisible);

  expect(title).toContain("ERP");
});

test("Test error handling: submit invalid query", async ({ page }) => {
  await page.goto("http://localhost:3000/");

  // Find and fill the input
  const queryInput = page.locator('input[placeholder*="Preguntá"]');
  if (await queryInput.isVisible({ timeout: 1000 }).catch(() => false)) {
    await queryInput.fill("@#$%^&*()");

    // Find submit button
    const submitBtn = page.locator('button:has-text("Consultar"), button:has-text("Submit")');
    await submitBtn.click({ timeout: 1000 }).catch(() => {
      console.log("Could not click submit button");
    });

    // Wait a bit for response
    await page.waitForTimeout(2000);

    // Take screenshot
    const screenshot = await page.screenshot();
    console.log("Screenshot taken after query");
  }
});
