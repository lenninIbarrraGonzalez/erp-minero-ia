import { test, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import {
  TEXT_QUERY_QUESTIONS_100,
  type QuestionFixture100,
} from "./fixtures/text-query-questions-100";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

interface QuestionScore {
  id: number;
  category: string;
  question: string;
  score: number;
  maxScore: number;
  checks: CheckResult[];
  bonusChecks: CheckResult[];
  llmDependent: boolean;
}

const allScores: QuestionScore[] = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function submitQuestion(page: Page, question: string) {
  const input = page.locator('input[type="text"]').first();
  await input.fill(question);
  await page.locator('button[type="submit"]').first().click();
}

async function waitForResult(page: Page, timeoutMs = 35_000): Promise<boolean> {
  try {
    await page.waitForSelector(
      '[data-testid="query-results"], [data-testid="query-error"]',
      { timeout: timeoutMs }
    );
    return true;
  } catch {
    return false;
  }
}

async function scoreQuestion(
  page: Page,
  fixture: QuestionFixture100
): Promise<QuestionScore> {
  const checks: CheckResult[] = [];
  const bonusChecks: CheckResult[] = [];

  await page.goto("/");
  await submitQuestion(page, fixture.question);

  // Check 1: Response received within timeout
  const received = await waitForResult(page);
  checks.push({
    name: "response_received",
    passed: received,
    detail: received ? "ok" : "timeout after 35s",
  });

  if (!received) {
    return buildScore(fixture, checks, bonusChecks);
  }

  // Check 2: Error state matches expectation
  const errorVisible = await page.locator('[data-testid="query-error"]').isVisible();
  const resultsVisible = await page.locator('[data-testid="query-results"]').isVisible();

  if (fixture.expectError) {
    checks.push({
      name: "error_shown",
      passed: errorVisible,
      detail: errorVisible ? `error shown (expected ${fixture.expectError})` : "no error shown",
    });
  } else {
    checks.push({
      name: "results_shown",
      passed: resultsVisible && !errorVisible,
      detail: resultsVisible && !errorVisible
        ? "results visible, no error"
        : errorVisible
          ? "unexpected error shown"
          : "neither results nor error visible",
    });
  }

  if (fixture.expectError) {
    // Remaining checks are N/A for error questions — auto-pass
    checks.push({ name: "row_count", passed: true, detail: "n/a (error expected)" });
    checks.push({ name: "chart_type", passed: true, detail: "n/a (error expected)" });
    checks.push({ name: "insight", passed: true, detail: "n/a (error expected)" });
    return buildScore(fixture, checks, bonusChecks);
  }

  // Check 3: Row count
  const table = page.locator('[data-testid="query-table"]');
  const tableVisible = await table.isVisible();

  if (tableVisible) {
    const rowCount = await table.locator("tbody tr").count();
    const rowOk = rowCount >= fixture.expectedMinRows && rowCount <= fixture.expectedMaxRows;
    checks.push({
      name: "row_count",
      passed: rowOk,
      detail: `${rowCount} rows (expected ${fixture.expectedMinRows}–${fixture.expectedMaxRows})`,
    });
  } else {
    checks.push({ name: "row_count", passed: false, detail: "table not visible" });
  }

  // Check 4: Chart type
  if (fixture.expectedChart === "any") {
    checks.push({ name: "chart_type", passed: true, detail: "any chart accepted" });
  } else if (fixture.expectedChart === "line") {
    const lineVisible = await page.locator('[data-testid="query-chart-line"]').isVisible();
    checks.push({
      name: "chart_type",
      passed: lineVisible,
      detail: lineVisible ? "line chart visible" : "line chart not found",
    });
  } else if (fixture.expectedChart === "bar") {
    const barVisible = await page.locator('[data-testid="query-chart-bar"]').isVisible();
    checks.push({
      name: "chart_type",
      passed: barVisible,
      detail: barVisible ? "bar chart visible" : "bar chart not found",
    });
  } else {
    // "none"
    const lineCount = await page.locator('[data-testid="query-chart-line"]').count();
    const barCount = await page.locator('[data-testid="query-chart-bar"]').count();
    const noChart = lineCount === 0 && barCount === 0;
    checks.push({
      name: "chart_type",
      passed: noChart,
      detail: noChart
        ? "no chart (correct)"
        : `unexpected chart: line=${lineCount} bar=${barCount}`,
    });
  }

  // Check 5: Insight text
  if (fixture.expectInsight) {
    const insight = page.locator('[data-testid="query-insight"]');
    const insightVisible = await insight.isVisible();
    if (insightVisible) {
      const text = (await insight.textContent()) ?? "";
      const insightOk = text.trim().length > 30;
      checks.push({
        name: "insight",
        passed: insightOk,
        detail: insightOk
          ? `insight length ${text.trim().length} chars`
          : `insight too short (${text.trim().length} chars)`,
      });
    } else {
      checks.push({ name: "insight", passed: false, detail: "insight element not visible" });
    }
  } else {
    checks.push({ name: "insight", passed: true, detail: "n/a (insight not required)" });
  }

  // Bonus: data value spot-checks
  if (fixture.dataChecks && tableVisible) {
    const headers = await table.locator("thead th").allTextContents();
    for (const dc of fixture.dataChecks) {
      const row = table.locator(`tbody tr:nth-child(${dc.rowIndex + 1})`);
      const cells = await row.locator("td").allTextContents();
      const colIdx = headers.findIndex((h) => h === dc.column);
      if (colIdx >= 0 && colIdx < cells.length) {
        const raw = cells[colIdx].replace(/,/g, "").replace(/\s/g, "");
        const val = parseFloat(raw);
        let passed = false;
        switch (dc.op) {
          case "gt":  passed = val > dc.value;  break;
          case "lt":  passed = val < dc.value;  break;
          case "gte": passed = val >= dc.value; break;
          case "lte": passed = val <= dc.value; break;
          case "eq":  passed = val === dc.value; break;
        }
        bonusChecks.push({
          name: `data:${dc.column}[row${dc.rowIndex}] ${dc.op} ${dc.value}`,
          passed,
          detail: `actual value: ${val}`,
        });
      } else {
        bonusChecks.push({
          name: `data:${dc.column}[row${dc.rowIndex}]`,
          passed: false,
          detail: `column "${dc.column}" not found in headers: [${headers.join(", ")}]`,
        });
      }
    }
  }

  return buildScore(fixture, checks, bonusChecks);
}

function buildScore(
  fixture: QuestionFixture100,
  checks: CheckResult[],
  bonusChecks: CheckResult[]
): QuestionScore {
  return {
    id: fixture.id,
    category: fixture.category,
    question: fixture.question,
    score: checks.filter((c) => c.passed).length,
    maxScore: 5,
    checks,
    bonusChecks,
    llmDependent: !!fixture.llmDependent,
  };
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

function grade(pct: number): string {
  if (pct >= 90) return "A";
  if (pct >= 80) return "B";
  if (pct >= 70) return "C";
  if (pct >= 60) return "D";
  return "F";
}

function buildImprovementPlan(
  byCategory: Record<string, { pct: number }>
): object[] {
  const plan: object[] = [];

  const catD = byCategory["D-timeseries"]?.pct ?? 100;
  const catE = byCategory["E-all-mines"]?.pct ?? 100;
  const catH = byCategory["H-complex"]?.pct ?? 100;
  const catJ = byCategory["J-error"]?.pct ?? 100;
  const catG = byCategory["G-anomaly"]?.pct ?? 100;

  plan.push({
    id: "I7",
    issue: `Category D (time-series) scored ${catD.toFixed(1)}%`,
    impact: catD < 70 ? "CRITICAL" : catD < 80 ? "HIGH" : "MEDIUM",
    root_cause:
      "LLM inconsistency: 'mes a mes', 'monthly trend', 'evolución mensual' trigger groupBy:month unreliably — sometimes returning a 1-row aggregate instead of 12-row time-series.",
    fix: "Harden intent-parser prompt: add explicit few-shot examples mapping these phrases to groupBy:month. Add post-parse rule: if driverFilter is set AND question contains 'mes a mes'/'monthly', enforce groupBy:month.",
    priority: 1,
  });

  plan.push({
    id: "I6",
    issue: `Category E (all-mines grouped) scored ${catE.toFixed(1)}%`,
    impact: catE < 70 ? "CRITICAL" : catE < 80 ? "HIGH" : "MEDIUM",
    root_cause:
      "LLM inconsistency: 'cada mina', 'por mina', 'every mine' trigger groupBy:mine unreliably — sometimes returning a time-series instead of 5-row per-mine grouping.",
    fix: "Add post-parse rule: if mineNames is empty/generic AND question contains 'por mina'/'cada mina'/'every mine', enforce groupBy:mine. Add 3 few-shot examples to intent-parser prompt.",
    priority: 2,
  });

  plan.push({
    id: "I8",
    issue: `Category A/B (cost breakdown) LLM sometimes injects driverFilter spuriously`,
    impact: "HIGH",
    root_cause:
      "When the question asks for 'desglose' or 'breakdown by category' without naming a specific driver, the LLM occasionally sets driverFilter to a specific driver, returning 1 row instead of the full 4-row breakdown.",
    fix: "Strengthen prompt: clarify that driverFilter should ONLY be set if the user names exactly one driver. Add negative few-shot example where 'desglose de costos' maps to no driverFilter.",
    priority: 3,
  });

  if (catJ < 100) {
    plan.push({
      id: "J-scope",
      issue: `Category J (out-of-scope/errors) scored ${catJ.toFixed(1)}% — some error queries not rejected`,
      impact: "HIGH",
      root_cause:
        "Out-of-scope guard not triggering consistently for all off-topic queries (FX rates, HR data, commodity prices).",
      fix: "Expand out-of-scope keyword list and few-shot examples. Add domain guard: if no mine/cost/tonnage intent detected AND no mine name matched, treat as out-of-scope.",
      priority: 4,
    });
  }

  if (catG < 80) {
    plan.push({
      id: "G-anomaly",
      issue: `Category G (anomaly detection) scored ${catG.toFixed(1)}%`,
      impact: "MEDIUM",
      root_cause:
        "Anomaly queries (fuel shock, operational stoppage) may fail if the insight generator doesn't highlight the anomaly, or if data-check values are outside expected ranges due to seed noise.",
      fix: "Review seed data noise bounds. Ensure insight-generator prompt explicitly mentions known anomalies (fuel shock months 8–12, Quebrada Sur June stoppage) in context.",
      priority: 5,
    });
  }

  const lowCats = Object.entries(byCategory)
    .filter(([, v]) => v.pct < 70)
    .map(([k]) => k);
  if (lowCats.length > 0) {
    plan.push({
      id: "CRITICAL-CATS",
      issue: `Categories below 70%: ${lowCats.join(", ")}`,
      impact: "CRITICAL",
      root_cause: "Multiple checks failing across basic query categories.",
      fix: "Run failing queries manually. Check LLM prompt, Zod schema validation, and query builder for the specific category patterns.",
      priority: 0,
    });
  }

  return plan.sort((a: any, b: any) => a.priority - b.priority);
}

function writeReport() {
  const totalPoints = allScores.reduce((s, q) => s + q.score, 0);
  const maxPoints = allScores.reduce((s, q) => s + q.maxScore, 0);
  const qualityPct = maxPoints > 0 ? (totalPoints / maxPoints) * 100 : 0;

  const byCategory: Record<string, { questions: number; points: number; maxPoints: number; pct: number }> = {};
  for (const q of allScores) {
    if (!byCategory[q.category]) {
      byCategory[q.category] = { questions: 0, points: 0, maxPoints: 0, pct: 0 };
    }
    byCategory[q.category].questions++;
    byCategory[q.category].points += q.score;
    byCategory[q.category].maxPoints += q.maxScore;
  }
  for (const cat of Object.values(byCategory)) {
    cat.pct = cat.maxPoints > 0 ? (cat.points / cat.maxPoints) * 100 : 0;
  }

  const byCategoryPct: Record<string, { pct: number }> = {};
  for (const [k, v] of Object.entries(byCategory)) {
    byCategoryPct[k] = { pct: v.pct };
  }

  const report = {
    timestamp: new Date().toISOString(),
    totalQuestions: allScores.length,
    totalPoints,
    maxPoints,
    qualityPct: Math.round(qualityPct * 10) / 10,
    grade: grade(qualityPct),
    byCategory,
    questions: allScores.map((q) => ({
      id: q.id,
      category: q.category,
      question: q.question,
      score: q.score,
      maxScore: q.maxScore,
      pct: Math.round((q.score / q.maxScore) * 100),
      llmDependent: q.llmDependent,
      failures: q.checks.filter((c) => !c.passed).map((c) => `${c.name}: ${c.detail}`),
      bonusChecks: q.bonusChecks,
    })),
    improvementPlan: buildImprovementPlan(byCategoryPct),
  };

  const imgDir = path.resolve("playwright_img");
  if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

  const reportPath = path.join(imgDir, "quality-report-100.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");

  // Console summary
  console.log("\n" + "=".repeat(60));
  console.log("  TEXT QUERY — 100-QUESTION QUALITY REPORT");
  console.log("=".repeat(60));
  console.log(`  Overall: ${totalPoints}/${maxPoints} pts — ${qualityPct.toFixed(1)}% — Grade ${grade(qualityPct)}`);
  console.log("\n  By category:");
  for (const [cat, data] of Object.entries(byCategory)) {
    const bar = "█".repeat(Math.round(data.pct / 10)).padEnd(10, "░");
    console.log(`    ${cat.padEnd(20)} ${bar} ${data.pct.toFixed(1)}% (${data.points}/${data.maxPoints})`);
  }

  const bonusPassed = allScores.flatMap((q) => q.bonusChecks).filter((b) => b.passed).length;
  const bonusTotal = allScores.flatMap((q) => q.bonusChecks).length;
  if (bonusTotal > 0) {
    console.log(`\n  Bonus data-checks: ${bonusPassed}/${bonusTotal} passed`);
  }

  console.log(`\n  Report written to: ${reportPath}`);
  console.log("=".repeat(60) + "\n");
}

// Persistent score file — survives worker restarts caused by test timeouts
const SCORES_FILE = path.resolve("playwright_img/scores-100-partial.json");

function persistScore(s: QuestionScore) {
  let existing: QuestionScore[] = [];
  try {
    if (fs.existsSync(SCORES_FILE)) {
      existing = JSON.parse(fs.readFileSync(SCORES_FILE, "utf-8"));
    }
  } catch {}
  existing = existing.filter((e) => e.id !== s.id);
  existing.push(s);
  existing.sort((a, b) => a.id - b.id);
  fs.writeFileSync(SCORES_FILE, JSON.stringify(existing, null, 2), "utf-8");
  return existing;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe("Text Query — 100-question quality suite", () => {
  test.afterAll(() => {
    // Read all persisted scores (survives worker restarts)
    try {
      if (fs.existsSync(SCORES_FILE)) {
        const persisted: QuestionScore[] = JSON.parse(fs.readFileSync(SCORES_FILE, "utf-8"));
        // Merge with in-memory (in-memory takes precedence for this worker)
        const ids = new Set(allScores.map((s) => s.id));
        for (const s of persisted) {
          if (!ids.has(s.id)) allScores.push(s);
        }
        allScores.sort((a, b) => a.id - b.id);
      }
    } catch {}
    if (allScores.length > 0) writeReport();
  });

  for (const fixture of TEXT_QUERY_QUESTIONS_100) {
    test(`Q${String(fixture.id).padStart(3, "0")} [${fixture.category}] ${fixture.question.slice(0, 55)}`, async ({
      page,
    }) => {
      test.setTimeout(60_000);

      const result = await scoreQuestion(page, fixture);
      allScores.push(result);
      persistScore(result);

      const scoreStr = `${result.score}/${result.maxScore}`;
      const failures = result.checks.filter((c) => !c.passed).map((c) => c.name);
      console.log(
        `  Q${String(fixture.id).padStart(3, "0")} ${scoreStr} ${failures.length > 0 ? `FAIL[${failures.join(",")}]` : "PASS"}`
      );

      try {
        await page.screenshot({
          path: `playwright_img/100-q${String(fixture.id).padStart(3, "0")}.png`,
          fullPage: false,
        });
      } catch {
        // Page may be closed after timeout — screenshot is optional
      }
    });
  }
});
