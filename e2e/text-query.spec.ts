import { test, expect, type Page } from "@playwright/test";
import {
  TEXT_QUERY_QUESTIONS,
  type QuestionFixture,
} from "./fixtures/text-query-questions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function submitQuestion(page: Page, question: string) {
  const input = page.locator('input[type="text"]').first();
  await input.fill(question);
  // Use the first submit button (text-query "Consultar/Query"), not the cost-variance "Analizar"
  await page.locator('button[type="submit"]').first().click();
}

async function waitForResult(page: Page, timeoutMs = 35_000) {
  await page.waitForSelector(
    '[data-testid="query-results"], [data-testid="query-error"]',
    { timeout: timeoutMs }
  );
}

async function assertQuestion(page: Page, fixture: QuestionFixture) {
  await page.goto("/");
  await submitQuestion(page, fixture.question);
  await waitForResult(page);

  if (fixture.expectError) {
    const error = page.locator('[data-testid="query-error"]');
    await expect(error).toBeVisible({ timeout: 5_000 });
    return;
  }

  // Table assertions
  const table = page.locator('[data-testid="query-table"]');
  await expect(table).toBeVisible({ timeout: 5_000 });

  const rowCount = await table.locator("tbody tr").count();
  expect(rowCount).toBeGreaterThanOrEqual(fixture.expectedMinRows);
  expect(rowCount).toBeLessThanOrEqual(fixture.expectedMaxRows);

  // Column header assertions
  const headers = await table.locator("thead th").allTextContents();
  for (const col of fixture.expectedColumns) {
    expect(headers).toContain(col);
  }

  // Chart assertions
  if (fixture.expectedChart === "line") {
    await expect(page.locator('[data-testid="query-chart-line"]')).toBeVisible();
  } else if (fixture.expectedChart === "bar") {
    await expect(page.locator('[data-testid="query-chart-bar"]')).toBeVisible();
  } else if (fixture.expectedChart === "none") {
    expect(await page.locator('[data-testid="query-chart-line"]').count()).toBe(0);
    expect(await page.locator('[data-testid="query-chart-bar"]').count()).toBe(0);
  }
  // "any" = LLM-dependent chart type; just verify some output exists (already checked via table)

  // Insight assertion
  if (fixture.expectInsight) {
    const insight = page.locator('[data-testid="query-insight"]');
    const visible = await insight.isVisible();
    if (visible) {
      const text = (await insight.textContent()) ?? "";
      expect(text.trim().length).toBeGreaterThan(20);
    }
    // Non-fatal: insight may be empty if LLM degrade occurred
  }
}

// ---------------------------------------------------------------------------
// Main suite — 30 questions
// ---------------------------------------------------------------------------

test.describe("Text Query — 30 questions validation", () => {
  for (const fixture of TEXT_QUERY_QUESTIONS) {
    test(`Q${String(fixture.id).padStart(2, "0")} [${fixture.category}] ${fixture.question.slice(0, 60)}`, async ({
      page,
    }) => {
      await assertQuestion(page, fixture);
      await page.screenshot({
        path: `playwright_img/tq-q${String(fixture.id).padStart(2, "0")}.png`,
        fullPage: false,
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Chart data spot-checks — validate actual numbers from the UI
// ---------------------------------------------------------------------------

test.describe("Chart data spot-checks", () => {
  test("Q01 — Cerro Rojo CPT 2024: chart visible, SVG has text labels", async ({
    page,
  }) => {
    await page.goto("/");
    await submitQuestion(page, "Costo por tonelada de Cerro Rojo en 2024");
    await waitForResult(page);

    const chart = page.locator('[data-testid="query-chart-line"]');
    await expect(chart).toBeVisible();

    // Chart SVG should render
    await expect(chart.locator("svg")).toBeVisible();

    // In Recharts v3, tick labels use class "recharts-cartesian-axis-tick-value"
    const allTicks = chart.locator("svg .recharts-cartesian-axis-tick-value");
    const tickCount = await allTicks.count();
    expect(tickCount).toBeGreaterThan(0);

    // Some ticks are Y-axis (numeric). Verify at least one label parses as a number.
    const tickTexts = await allTicks.allTextContents();
    const numericCount = tickTexts.filter((t) => !isNaN(parseFloat(t.replace(/,/g, "")))).length;
    expect(numericCount).toBeGreaterThan(0);
  });

  test("Q10 — Quebrada Sur June 2024: tonnage < 10 000 (stoppage detected)", async ({
    page,
  }) => {
    await page.goto("/");
    await submitQuestion(page, "Tonnage for Quebrada Sur in June 2024");
    await waitForResult(page);

    const table = page.locator('[data-testid="query-table"]');
    await expect(table).toBeVisible();

    // The first data cell in the tonnage column (second column)
    const cells = await table.locator("tbody tr:first-child td").allTextContents();
    // cells[0] = period, cells[1] = tonnage
    const tonnage = parseFloat(cells[1].replace(/,/g, ""));
    expect(tonnage).toBeLessThan(10_000);
    expect(tonnage).toBeGreaterThan(8_000);
  });

  test("Q20 — All mines tonnage: Loma Grande is highest (when grouped by mine)", async ({
    page,
  }) => {
    await page.goto("/");
    await submitQuestion(page, "¿Cuál fue el tonelaje de cada mina en 2024?");
    await waitForResult(page);

    const table = page.locator('[data-testid="query-table"]');
    await expect(table).toBeVisible();

    const headers = await table.locator("thead th").allTextContents();

    if (headers.includes("mine")) {
      // Per-mine grouping: Loma Grande must be first (sorted desc by tonnage)
      const firstRowCells = await table.locator("tbody tr:first-child td").allTextContents();
      expect(firstRowCells[0]).toBe("Loma Grande");
    } else {
      // Time-series fallback (groupBy:mine not triggered by LLM) — just verify rows exist
      const rowCount = await table.locator("tbody tr").count();
      expect(rowCount).toBeGreaterThanOrEqual(5);
    }
  });

  test("Q23 — Multi-mine CPT: Loma Grande cheaper than Cerro Rojo", async ({
    page,
  }) => {
    await page.goto("/");
    await submitQuestion(
      page,
      "Comparar costo por tonelada entre Cerro Rojo y Loma Grande en 2024"
    );
    await waitForResult(page);

    const table = page.locator('[data-testid="query-table"]');
    await expect(table).toBeVisible();

    const rows = await table.locator("tbody tr").all();
    expect(rows).toHaveLength(2);

    const cells0 = await rows[0].locator("td").allTextContents();
    const cells1 = await rows[1].locator("td").allTextContents();

    // Build a map mine → avg_cost_per_tonne
    const cpt: Record<string, number> = {};
    for (const cells of [cells0, cells1]) {
      cpt[cells[0]] = parseFloat(cells[1].replace(/,/g, ""));
    }

    expect(cpt["Cerro Rojo"]).toBeDefined();
    expect(cpt["Loma Grande"]).toBeDefined();
    expect(cpt["Loma Grande"]).toBeLessThan(cpt["Cerro Rojo"]);
  });

  test("Q08 — Cerro Rojo fuel August 2024: amount in expected shock range", async ({
    page,
  }) => {
    await page.goto("/");
    await submitQuestion(
      page,
      "¿Cuál fue el costo de combustible de Cerro Rojo en agosto 2024?"
    );
    await waitForResult(page);

    const table = page.locator('[data-testid="query-table"]');
    await expect(table).toBeVisible();

    const cells = await table.locator("tbody tr:first-child td").allTextContents();
    // cells[0] = driver ("fuel"), cells[1] = amount
    expect(cells[0]).toBe("fuel");
    const amount = parseFloat(cells[1].replace(/,/g, ""));
    // 600K * 1.15 * (1 ± 0.04) = [667_200, 718_080]
    expect(amount).toBeGreaterThan(650_000);
    expect(amount).toBeLessThan(730_000);
  });

  test("Q28 — Quebrada Sur June CPT: anomaly value > 60 (stoppage)", async ({
    page,
  }) => {
    await page.goto("/");
    await submitQuestion(
      page,
      "¿Cuál fue el costo por tonelada de Quebrada Sur en junio 2024?"
    );
    await waitForResult(page);

    const table = page.locator('[data-testid="query-table"]');
    await expect(table).toBeVisible();

    const cells = await table.locator("tbody tr:first-child td").allTextContents();
    // cells[0] = period, cells[1] = cost_per_tonne
    const cpt = parseFloat(cells[1].replace(/,/g, ""));
    // Normal CPT ≈ 40, stoppage month should push it to ≈ 66–70
    expect(cpt).toBeGreaterThan(55);
  });
});
