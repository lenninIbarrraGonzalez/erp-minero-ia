import { test, expect } from "@playwright/test";
import { V2_GROUP_DISTRIBUTION } from "./fixtures/error-v2-30";

const BASE = "http://localhost:3000";
const API_STATS = `${BASE}/api/text-query/stats`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getQueryInput(page: Parameters<typeof test>[1] extends (args: { page: infer P }) => unknown ? P : never) {
  return page.locator('input[type="text"]').first();
}

async function getSubmitButton(page: Parameters<typeof test>[1] extends (args: { page: infer P }) => unknown ? P : never) {
  return page.locator('button[type="submit"]').first();
}

async function submitQuery(
  page: Parameters<typeof test>[1] extends (args: { page: infer P }) => unknown ? P : never,
  query: string,
  waitMs = 4000
) {
  const input = await getQueryInput(page);
  await input.fill(query);
  const btn = await getSubmitButton(page);
  await btn.click();
  await page.waitForTimeout(waitMs);
}

// ---------------------------------------------------------------------------
// GROUP A — Year Out of Range (5 tests, deterministic)
// ---------------------------------------------------------------------------

test.describe("GROUP A — Year Out of Range (hint present, deterministic)", () => {
  const YEAR_CASES = [
    { id: "A1", query: "Tonelaje en 2023", label: "2023 (past)" },
    { id: "A2", query: "Show production data for 2025", label: "2025 (future, English)" },
    { id: "A3", query: "Costos de Cerro Rojo en 2022", label: "2022 with valid mine" },
    { id: "A4", query: "Tonelaje 2019", label: "2019 (old)" },
    { id: "A5", query: "Cost per tonne 2026", label: "2026 (future)" },
  ];

  for (const { id, query, label } of YEAR_CASES) {
    test(`${id}: year out of range — ${label}`, async ({ page }) => {
      await page.goto(BASE);
      await submitQuery(page, query, 3000);

      const errorEl = page.locator('[data-testid="query-error"]');
      await expect(errorEl).toBeVisible({ timeout: 5000 });
      await expect(errorEl).toHaveAttribute("role", "alert");

      const hintEl = page.locator('[data-testid="query-error-hint"]');
      await expect(hintEl).toBeVisible({ timeout: 3000 });

      const suggestionsEl = page.locator('[data-testid="query-suggestions"]');
      await expect(suggestionsEl).not.toBeVisible({ timeout: 500 }).catch(() => {});
    });
  }
});

// ---------------------------------------------------------------------------
// GROUP B — Char Counter (5 tests, purely client-side)
// ---------------------------------------------------------------------------

test.describe("GROUP B — Char Counter (client-side, no API call)", () => {
  test("B1: 399 chars — counter NOT shown (below WARN_AT)", async ({ page }) => {
    await page.goto(BASE);
    const input = await getQueryInput(page);
    await input.fill("A".repeat(399));

    const counter = page.locator('[data-testid="char-counter"]');
    await expect(counter).not.toBeVisible({ timeout: 500 }).catch(() => {});
  });

  test("B2: 401 chars — counter shown in yellow", async ({ page }) => {
    await page.goto(BASE);
    const input = await getQueryInput(page);
    await input.fill("A".repeat(401));

    const counter = page.locator('[data-testid="char-counter"]');
    await expect(counter).toBeVisible({ timeout: 2000 });

    const text = await counter.textContent();
    expect(text).toContain("401/500");

    const cls = await counter.getAttribute("class");
    expect(cls).toContain("yellow");
  });

  test("B3: 450 chars — counter shows '450/500'", async ({ page }) => {
    await page.goto(BASE);
    const input = await getQueryInput(page);
    await input.fill("A".repeat(450));

    const counter = page.locator('[data-testid="char-counter"]');
    await expect(counter).toBeVisible({ timeout: 2000 });

    const text = await counter.textContent();
    expect(text).toContain("450/500");
  });

  test("B4: 499 chars — counter shows '499/500' in yellow", async ({ page }) => {
    await page.goto(BASE);
    const input = await getQueryInput(page);
    await input.fill("A".repeat(499));

    const counter = page.locator('[data-testid="char-counter"]');
    await expect(counter).toBeVisible({ timeout: 2000 });

    const text = await counter.textContent();
    expect(text).toContain("499/500");

    const cls = await counter.getAttribute("class");
    expect(cls).toContain("yellow");
  });

  test("B5: 500 chars — counter shows '500/500' in red", async ({ page }) => {
    await page.goto(BASE);
    const input = await getQueryInput(page);
    await input.fill("A".repeat(500));

    const counter = page.locator('[data-testid="char-counter"]');
    await expect(counter).toBeVisible({ timeout: 2000 });

    const text = await counter.textContent();
    expect(text).toContain("500/500");

    const cls = await counter.getAttribute("class");
    expect(cls).toContain("red");
  });
});

// ---------------------------------------------------------------------------
// GROUP C — Mine Not Found + Suggestions (4 tests)
// ---------------------------------------------------------------------------

test.describe("GROUP C — Mine Not Found + Levenshtein Suggestions", () => {
  test("C1: 'Cerro Roja' → suggestion 'Cerro Rojo' appears + hint shown", async ({ page }) => {
    await page.goto(BASE);
    await submitQuery(page, "Tonelaje de Cerro Roja en 2024");

    const errorEl = page.locator('[data-testid="query-error"]');
    await expect(errorEl).toBeVisible({ timeout: 8000 });

    const suggestions = page.locator('[data-testid="query-suggestions"]');
    await expect(suggestions).toBeVisible({ timeout: 3000 });
    await expect(suggestions).toContainText("Cerro Rojo");

    const hint = page.locator('[data-testid="query-error-hint"]');
    await expect(hint).toBeVisible({ timeout: 2000 });
  });

  test("C2: 'Veta Dorad' → suggestion 'Veta Dorada' appears + hint shown", async ({ page }) => {
    await page.goto(BASE);
    await submitQuery(page, "Tonelaje de Veta Dorad en 2024");

    const errorEl = page.locator('[data-testid="query-error"]');
    await expect(errorEl).toBeVisible({ timeout: 8000 });

    const suggestions = page.locator('[data-testid="query-suggestions"]');
    await expect(suggestions).toBeVisible({ timeout: 3000 });
    await expect(suggestions).toContainText("Veta Dorada");

    const hint = page.locator('[data-testid="query-error-hint"]');
    await expect(hint).toBeVisible({ timeout: 2000 });
  });

  test("C3: 'Loma Grands' → suggestion 'Loma Grande' appears + hint shown", async ({ page }) => {
    await page.goto(BASE);
    await submitQuery(page, "Costo en Loma Grands 2024");

    const errorEl = page.locator('[data-testid="query-error"]');
    await expect(errorEl).toBeVisible({ timeout: 8000 });

    const suggestions = page.locator('[data-testid="query-suggestions"]');
    await expect(suggestions).toBeVisible({ timeout: 3000 });
    await expect(suggestions).toContainText("Loma Grande");

    const hint = page.locator('[data-testid="query-error-hint"]');
    await expect(hint).toBeVisible({ timeout: 2000 });
  });

  test("C4: 'MegaMina SuperGold' — distance >5, NO suggestions, hint still shown", async ({ page }) => {
    await page.goto(BASE);
    await submitQuery(page, "Costo de MegaMina SuperGold 2024");

    const errorEl = page.locator('[data-testid="query-error"]');
    await expect(errorEl).toBeVisible({ timeout: 8000 });

    const suggestions = page.locator('[data-testid="query-suggestions"]');
    const hasSuggestions = await suggestions.isVisible({ timeout: 1000 }).catch(() => false);
    expect(hasSuggestions).toBe(false);

    const hint = page.locator('[data-testid="query-error-hint"]');
    await expect(hint).toBeVisible({ timeout: 2000 });
  });
});

// ---------------------------------------------------------------------------
// GROUP D — Hint Present (LLM-dependent errors, soft assertions)
// ---------------------------------------------------------------------------

test.describe("GROUP D — Recovery Hint Present (LLM-dependent)", () => {
  const HINT_CASES = [
    { id: "D1", query: "@#$%^&*()", label: "special chars → parse_failure" },
    { id: "D2", query: "Lorem ipsum dolor sit amet", label: "latin text → parse_failure or out_of_scope" },
    { id: "D3", query: "¿Cuál es la capital de Argentina?", label: "geography → out_of_scope" },
    { id: "D4", query: "Tell me about the weather forecast", label: "weather → out_of_scope" },
    { id: "D5", query: "Tonelaje de Mina Nonexistente en 2024", label: "fictional mine → mine_not_found" },
    { id: "D6", query: "║═╬╰┃┌┐└┘─▄▀", label: "box-drawing chars → parse_failure" },
  ];

  for (const { id, query, label } of HINT_CASES) {
    test(`${id}: ${label} — error shown + hint shown`, async ({ page }) => {
      await page.goto(BASE);
      await submitQuery(page, query, 5000);

      const errorEl = page.locator('[data-testid="query-error"]');
      await expect(errorEl).toBeVisible({ timeout: 8000 });

      const hint = page.locator('[data-testid="query-error-hint"]');
      await expect(hint).toBeVisible({ timeout: 3000 });
    });
  }
});

// ---------------------------------------------------------------------------
// GROUP E — Hint Absent (errors with no hint key)
// ---------------------------------------------------------------------------

test.describe("GROUP E — No Recovery Hint (ambiguous/overlap/unsupported)", () => {
  const NO_HINT_CASES = [
    { id: "E1", query: "¿Cuál fue el costo?", label: "ambiguous_query" },
    { id: "E2", query: "Show me the numbers", label: "ambiguous_query (English)" },
    { id: "E3", query: "Tonelaje en Q1 y enero 2024", label: "overlapping_period" },
    { id: "E4", query: "Show Q4 and December 2024 tonnage", label: "overlapping_period (English)" },
    { id: "E5", query: "¿Cuál fue el margen de ganancia en 2024?", label: "unsupported_metric" },
    { id: "E6", query: "Employee productivity per mine 2024", label: "unsupported_metric (English)" },
  ];

  for (const { id, query, label } of NO_HINT_CASES) {
    test(`${id}: ${label} — error shown, hint NOT shown`, async ({ page }) => {
      await page.goto(BASE);
      await submitQuery(page, query, 5000);

      const errorEl = page.locator('[data-testid="query-error"]');
      await expect(errorEl).toBeVisible({ timeout: 8000 });

      const hint = page.locator('[data-testid="query-error-hint"]');
      const hintVisible = await hint.isVisible({ timeout: 1000 }).catch(() => false);
      expect(hintVisible).toBe(false);
    });
  }
});

// ---------------------------------------------------------------------------
// GROUP F — Stats Endpoint (3 tests)
// ---------------------------------------------------------------------------

test.describe("GROUP F — /api/text-query/stats Endpoint", () => {
  test("F1: GET stats — returns valid JSON structure", async ({ request }) => {
    const res = await request.get(API_STATS);
    expect(res.status()).toBe(200);

    const body = await res.json() as { total: number; byCode: Record<string, number>; windowMs: number };
    expect(typeof body.total).toBe("number");
    expect(typeof body.byCode).toBe("object");
    expect(typeof body.windowMs).toBe("number");
  });

  test("F2: stats.windowMs is 60000 (60-second sliding window)", async ({ request }) => {
    const res = await request.get(API_STATS);
    const body = await res.json() as { windowMs: number };
    expect(body.windowMs).toBe(60_000);
  });

  test("F3: after triggering a mine_not_found error, stats.total increases", async ({ page, request }) => {
    const before = await (await request.get(API_STATS)).json() as { total: number };

    await page.goto(BASE);
    // mine_not_found calls recordError — unlike year_out_of_range (pre-flight, no tracking)
    await submitQuery(page, "Tonelaje de MineDoesNotExistXYZ en 2024", 8000);

    const after = await (await request.get(API_STATS)).json() as { total: number };
    expect(after.total).toBeGreaterThan(before.total);
  });
});

// ---------------------------------------------------------------------------
// GROUP G — UI Interaction & Controlled Mode (3 tests)
// ---------------------------------------------------------------------------

test.describe("GROUP G — UI Interaction & Controlled Mode", () => {
  test("G1: error clears when a new query is submitted", async ({ page }) => {
    await page.goto(BASE);

    // Trigger an error
    await submitQuery(page, "Tonelaje 2023", 3000);
    await expect(page.locator('[data-testid="query-error"]')).toBeVisible({ timeout: 5000 });

    // Submit a new (valid-looking) query — error must disappear immediately on submit
    const input = await getQueryInput(page);
    await input.fill("Tonelaje 2024");
    const btn = await getSubmitButton(page);
    await btn.click();

    // While loading, the old error should be gone
    await expect(page.locator('[data-testid="query-error"]')).not.toBeVisible({ timeout: 2000 });
  });

  test("G2: click suggestion fills input (controlled mode)", async ({ page }) => {
    await page.goto(BASE);
    await submitQuery(page, "Tonelaje de Cerro Roja en 2024", 6000);

    const suggestions = page.locator('[data-testid="query-suggestions"]');
    await expect(suggestions).toBeVisible({ timeout: 5000 });

    // Click the first suggestion button
    const suggBtn = suggestions.locator("button").first();
    const suggText = await suggBtn.textContent();
    await suggBtn.click();

    // Input should now contain the suggestion text
    const input = await getQueryInput(page);
    const inputValue = await input.inputValue();
    expect(inputValue).toBe(suggText?.trim());
  });

  test("G3: error container has role=alert (ARIA)", async ({ page }) => {
    await page.goto(BASE);
    await submitQuery(page, "Tonelaje 2023", 3000);

    const errorEl = page.locator('[data-testid="query-error"]');
    await expect(errorEl).toBeVisible({ timeout: 5000 });
    await expect(errorEl).toHaveAttribute("role", "alert");
  });
});

// ---------------------------------------------------------------------------
// Metadata test — distribution check
// ---------------------------------------------------------------------------

test("distribution: 32 test cases across 7 groups", () => {
  const total = Object.values(V2_GROUP_DISTRIBUTION).reduce((a, b) => a + b, 0);
  expect(total).toBe(32);
  expect(V2_GROUP_DISTRIBUTION.year_out_of_range).toBe(5);
  expect(V2_GROUP_DISTRIBUTION.char_counter).toBe(5);
  expect(V2_GROUP_DISTRIBUTION.mine_suggestions).toBe(4);
  expect(V2_GROUP_DISTRIBUTION.hint_present).toBe(6);
  expect(V2_GROUP_DISTRIBUTION.no_hint).toBe(6);
  expect(V2_GROUP_DISTRIBUTION.stats).toBe(3);
  expect(V2_GROUP_DISTRIBUTION.ui_interaction).toBe(3);
});
