// Quality evaluation — 30 fresh questions with scoring + report generation
// Scores each question 0–5 (5 mandatory checks) + bonus data-value checks
// Writes quality-eval-30-report.json to project root on completion.

import { test, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import {
  QUALITY_EVAL_30,
  type QualityFixture,
} from "./fixtures/quality-eval-30";

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
  grade: string;
  score: number;
  maxScore: number;
  pct: number;
  checks: CheckResult[];
  bonusChecks: CheckResult[];
  llmDependent: boolean;
  screenshot?: string;
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

async function waitForResult(page: Page, timeoutMs = 38_000): Promise<boolean> {
  try {
    await page.waitForSelector(
      '[data-testid="query-results"], [data-testid="query-error"], [data-testid="query-empty"]',
      { timeout: timeoutMs }
    );
    return true;
  } catch {
    return false;
  }
}

function letterGrade(pct: number): string {
  if (pct >= 95) return "A+";
  if (pct >= 90) return "A";
  if (pct >= 80) return "B";
  if (pct >= 70) return "C";
  if (pct >= 60) return "D";
  return "F";
}

async function scoreQuestion(
  page: Page,
  fixture: QualityFixture
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
    detail: received ? "ok — response within 38s" : "TIMEOUT after 38s",
  });

  if (!received) {
    return buildScore(fixture, checks, bonusChecks);
  }

  // Check 2: Error state matches expectation
  const errorVisible = await page.locator('[data-testid="query-error"]').isVisible();
  const resultsVisible = await page.locator('[data-testid="query-results"]').isVisible();

  // Handle expectEmpty: query-empty testid should be visible, no error
  if (fixture.expectEmpty) {
    const emptyVisible = await page.locator('[data-testid="query-empty"]').isVisible();
    checks.push({
      name: "empty_shown",
      passed: emptyVisible && !errorVisible,
      detail: emptyVisible && !errorVisible
        ? "empty state shown (correct)"
        : errorVisible
          ? "unexpected error shown"
          : "FAIL — empty state not rendered",
    });
    checks.push({ name: "row_count",  passed: true, detail: "n/a (empty expected)" });
    checks.push({ name: "chart_type", passed: true, detail: "n/a (empty expected)" });
    checks.push({ name: "insight",    passed: true, detail: "n/a (empty expected)" });
    return buildScore(fixture, checks, bonusChecks);
  }

  if (fixture.expectError) {
    checks.push({
      name: "error_shown",
      passed: errorVisible,
      detail: errorVisible ? "error shown as expected" : "FAIL — no error shown for out-of-scope query",
    });
    // Remaining checks N/A
    checks.push({ name: "row_count",   passed: true, detail: "n/a (error expected)" });
    checks.push({ name: "chart_type",  passed: true, detail: "n/a (error expected)" });
    checks.push({ name: "insight",     passed: true, detail: "n/a (error expected)" });
    return buildScore(fixture, checks, bonusChecks);
  }

  checks.push({
    name: "results_shown",
    passed: resultsVisible && !errorVisible,
    detail: resultsVisible && !errorVisible
      ? "results visible, no error"
      : errorVisible
        ? "FAIL — unexpected error shown"
        : "FAIL — neither results nor error visible",
  });

  // Check 3: Row count
  const table = page.locator('[data-testid="query-table"]');
  const tableVisible = await table.isVisible();

  if (tableVisible) {
    const rowCount = await table.locator("tbody tr").count();
    const rowOk =
      rowCount >= fixture.expectedMinRows && rowCount <= fixture.expectedMaxRows;
    checks.push({
      name: "row_count",
      passed: rowOk,
      detail: `${rowCount} rows (expected ${fixture.expectedMinRows}–${fixture.expectedMaxRows})`,
    });

    // Check columns
    const headers = await table.locator("thead th").allTextContents();
    const missingCols = fixture.expectedColumns.filter((c) => !headers.includes(c));
    const columnsOk = missingCols.length === 0;

    // Bonus: data value spot-checks
    if (fixture.dataChecks) {
      for (const dc of fixture.dataChecks) {
        const row = table.locator(`tbody tr:nth-child(${dc.rowIndex + 1})`);
        const cells = await row.locator("td").allTextContents();
        const colIdx = headers.findIndex((h) => h === dc.column);
        if (colIdx >= 0 && colIdx < cells.length) {
          const raw = cells[colIdx].replace(/,/g, "").replace(/\s/g, "").replace(/\$/g, "");
          const val = parseFloat(raw);
          let passed = false;
          switch (dc.op) {
            case "gt":  passed = val > dc.value;  break;
            case "lt":  passed = val < dc.value;  break;
            case "gte": passed = val >= dc.value; break;
            case "lte": passed = val <= dc.value; break;
            case "eq":  passed = Math.abs(val - dc.value) < 0.01; break;
          }
          bonusChecks.push({
            name: `data:${dc.column}[row${dc.rowIndex}] ${dc.op} ${dc.value}`,
            passed,
            detail: `actual=${val}`,
          });
        } else {
          bonusChecks.push({
            name: `data:${dc.column}[row${dc.rowIndex}]`,
            passed: false,
            detail: `column "${dc.column}" not found — headers: [${headers.join(", ")}]`,
          });
        }
      }
    }

    // Columns check pushed after data checks so IDs are stable
    checks.push({
      name: "columns",
      passed: columnsOk,
      detail: columnsOk
        ? `all expected columns present: [${fixture.expectedColumns.join(", ")}]`
        : `FAIL — missing: [${missingCols.join(", ")}] | got: [${headers.join(", ")}]`,
    });
  } else {
    checks.push({ name: "row_count", passed: false, detail: "FAIL — table not visible" });
    checks.push({ name: "columns",   passed: false, detail: "FAIL — table not visible" });
  }

  // Check 4: Chart type
  if (fixture.expectedChart === "any") {
    checks.push({ name: "chart_type", passed: true, detail: "any chart accepted" });
  } else if (fixture.expectedChart === "line") {
    const lineVisible = await page.locator('[data-testid="query-chart-line"]').isVisible();
    checks.push({
      name: "chart_type",
      passed: lineVisible,
      detail: lineVisible ? "line chart visible ✓" : "FAIL — line chart not found",
    });
  } else if (fixture.expectedChart === "bar") {
    const barVisible = await page.locator('[data-testid="query-chart-bar"]').isVisible();
    checks.push({
      name: "chart_type",
      passed: barVisible,
      detail: barVisible ? "bar chart visible ✓" : "FAIL — bar chart not found",
    });
  } else {
    const lineCount = await page.locator('[data-testid="query-chart-line"]').count();
    const barCount  = await page.locator('[data-testid="query-chart-bar"]').count();
    const noChart   = lineCount === 0 && barCount === 0;
    checks.push({
      name: "chart_type",
      passed: noChart,
      detail: noChart
        ? "no chart (correct) ✓"
        : `FAIL — unexpected chart: line=${lineCount} bar=${barCount}`,
    });
  }

  // Check 5: Insight
  if (fixture.expectInsight) {
    const insight = page.locator('[data-testid="query-insight"]');
    const insightVisible = await insight.isVisible();
    if (insightVisible) {
      const text = (await insight.textContent()) ?? "";
      const trimmed = text.trim();
      const insightOk = trimmed.length >= 40;
      checks.push({
        name: "insight",
        passed: insightOk,
        detail: insightOk
          ? `insight ${trimmed.length} chars ✓`
          : `FAIL — insight too short (${trimmed.length} chars, need ≥40)`,
      });
    } else {
      checks.push({ name: "insight", passed: false, detail: "FAIL — insight element not visible" });
    }
  } else {
    checks.push({ name: "insight", passed: true, detail: "n/a" });
  }

  return buildScore(fixture, checks, bonusChecks);
}

function buildScore(
  fixture: QualityFixture,
  checks: CheckResult[],
  bonusChecks: CheckResult[]
): QuestionScore {
  const score = checks.filter((c) => c.passed).length;
  const maxScore = checks.length;
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  return {
    id: fixture.id,
    category: fixture.category,
    question: fixture.question,
    grade: letterGrade(pct),
    score,
    maxScore,
    pct,
    checks,
    bonusChecks,
    llmDependent: !!fixture.llmDependent,
  };
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

function buildReport(scores: QuestionScore[]) {
  const totalScore = scores.reduce((s, q) => s + q.score, 0);
  const totalMax   = scores.reduce((s, q) => s + q.maxScore, 0);
  const overallPct = Math.round((totalScore / totalMax) * 100);

  const byCategory: Record<string, { total: number; max: number; count: number; questions: number[] }> = {};
  for (const q of scores) {
    if (!byCategory[q.category]) {
      byCategory[q.category] = { total: 0, max: 0, count: 0, questions: [] };
    }
    byCategory[q.category].total += q.score;
    byCategory[q.category].max   += q.maxScore;
    byCategory[q.category].count += 1;
    byCategory[q.category].questions.push(q.id);
  }

  const categoryReport = Object.entries(byCategory).map(([cat, d]) => ({
    category: cat,
    pct: Math.round((d.total / d.max) * 100),
    grade: letterGrade(Math.round((d.total / d.max) * 100)),
    passedChecks: d.total,
    totalChecks: d.max,
    questions: d.questions,
  }));

  const failures = scores
    .filter((q) => q.pct < 100)
    .map((q) => ({
      id: q.id,
      category: q.category,
      question: q.question.slice(0, 80),
      pct: q.pct,
      grade: q.grade,
      llmDependent: q.llmDependent,
      failedChecks: q.checks.filter((c) => !c.passed).map((c) => `${c.name}: ${c.detail}`),
      failedDataChecks: q.bonusChecks.filter((c) => !c.passed).map((c) => `${c.name}: ${c.detail}`),
    }));

  const improvementPlan = buildImprovementPlan(
    overallPct,
    categoryReport,
    failures,
    scores
  );

  return {
    meta: {
      suite: "quality-eval-30",
      date: new Date().toISOString().slice(0, 10),
      totalQuestions: scores.length,
      overallPct,
      overallGrade: letterGrade(overallPct),
    },
    summary: {
      passedAll: scores.filter((q) => q.pct === 100).length,
      gradeA: scores.filter((q) => q.pct >= 90).length,
      gradeB: scores.filter((q) => q.pct >= 80 && q.pct < 90).length,
      gradeC: scores.filter((q) => q.pct >= 70 && q.pct < 80).length,
      gradeD: scores.filter((q) => q.pct >= 60 && q.pct < 70).length,
      gradeF: scores.filter((q) => q.pct < 60).length,
    },
    categoryBreakdown: categoryReport.sort((a, b) => a.pct - b.pct),
    failures,
    improvementPlan,
    allScores: scores.map((q) => ({
      id: q.id,
      category: q.category,
      grade: q.grade,
      pct: q.pct,
      score: `${q.score}/${q.maxScore}`,
      llmDependent: q.llmDependent,
      bonusPassed: q.bonusChecks.filter((c) => c.passed).length,
      bonusTotal: q.bonusChecks.length,
    })),
  };
}

function buildImprovementPlan(
  overallPct: number,
  categories: Array<{ category: string; pct: number }>,
  failures: Array<{ id: number; category: string; failedChecks: string[]; failedDataChecks: string[]; llmDependent: boolean }>,
  scores: QuestionScore[]
): object[] {
  const plan: object[] = [];
  const catMap = Object.fromEntries(categories.map((c) => [c.category, c.pct]));

  // I1: LLM time-series
  const timeseriesFailures = failures.filter(
    (f) => f.llmDependent && (f.failedChecks.some((c) => c.includes("row_count")) || f.failedChecks.some((c) => c.includes("chart")))
  );
  if (timeseriesFailures.length > 0) {
    plan.push({
      id: "I1",
      priority: 1,
      impact: timeseriesFailures.length >= 3 ? "CRITICAL" : "HIGH",
      title: "LLM groupBy:month inconsistency in time-series queries",
      affected: timeseriesFailures.map((f) => `Q${f.id}`),
      root_cause:
        "intent-parser LLM sometimes returns a 1-row aggregate instead of 12-row time-series for 'mes a mes', 'evolución mensual', 'monthly trend' phrasings.",
      fix: "Add 3 few-shot examples to intent-parser prompt mapping these phrases to groupBy:month. Add post-parse rule: if question contains monthly-trend keywords AND no month/quarter is specified, enforce groupBy:month.",
    });
  }

  // I2: Quarter parsing
  const quarterFailures = failures.filter((f) => f.category === "E-quarter");
  if (quarterFailures.length > 0) {
    plan.push({
      id: "I2",
      priority: 2,
      impact: quarterFailures.length >= 2 ? "HIGH" : "MEDIUM",
      title: "Quarter-period parsing yields inconsistent row counts",
      affected: quarterFailures.map((f) => `Q${f.id}`),
      root_cause:
        "LLM may interpret Q1/Q2/Q3/Q4 or 'primer trimestre' returning either 1 aggregate row or 3 monthly rows — inconsistent behavior.",
      fix: "Harden intent-parser: 'trimestre' or Q[1-4] MUST set period.quarter. Add Zod post-validation: if quarter set, expectedRows = 3. Document expected shape in prompt few-shot.",
    });
  }

  // I3: Error handling
  const errorFailures = failures.filter((f) => f.category === "G-edge");
  if (errorFailures.length > 0) {
    plan.push({
      id: "I3",
      priority: 3,
      impact: "HIGH",
      title: "Error handling gaps — vague or out-of-scope queries not rejected",
      affected: errorFailures.map((f) => `Q${f.id}`),
      root_cause:
        "Vague queries like 'dame la información' or queries for unsupported years may slip past the parse_failure guard and return garbled or empty results instead of a clean user-facing error.",
      fix: "Add domain guard in route.ts: if intent.mineName is missing AND no mine keyword found in question → return 422 parse_failure. Expand Zod schema to reject year < 2024 before DB hit.",
    });
  }

  // I4: Global groupBy:mine
  const globalFailures = failures.filter((f) => f.category === "F-global");
  if (globalFailures.length > 0) {
    plan.push({
      id: "I4",
      priority: 4,
      impact: "HIGH",
      title: "All-mines global analysis (groupBy:mine) not reliably triggered",
      affected: globalFailures.map((f) => `Q${f.id}`),
      root_cause:
        "Questions like 'cuánto gastó cada mina' or 'costo total de mano de obra de todas las minas' should trigger groupBy:mine but LLM may return a per-period time-series instead.",
      fix: "Add post-parse rule: if question contains 'cada mina', 'todas las minas', 'por mina', 'every mine' → enforce groupBy:mine. Add 2 few-shot examples.",
    });
  }

  // I5: Driver breakdown spurious driverFilter
  const driverBreakdownFailures = failures.filter(
    (f) => f.category === "C-driver" && f.failedChecks.some((c) => c.includes("row_count"))
  );
  if (driverBreakdownFailures.length > 0) {
    plan.push({
      id: "I5",
      priority: 5,
      impact: "MEDIUM",
      title: "Spurious driverFilter on breakdown queries reduces rows from 4→1",
      affected: driverBreakdownFailures.map((f) => `Q${f.id}`),
      root_cause:
        "When question asks 'desglose de costos' or 'breakdown by category' without naming a specific driver, LLM occasionally sets driverFilter, collapsing 4-row breakdown to 1 row.",
      fix: "Strengthen prompt: driverFilter ONLY if user names exactly one driver. Add negative few-shot: 'desglose de costos por categoría' → no driverFilter.",
    });
  }

  // I6: Multi-mine comparison chart
  const multimineFailures = failures.filter(
    (f) => f.category === "D-multimine" && f.failedChecks.some((c) => c.includes("chart"))
  );
  if (multimineFailures.length > 0) {
    plan.push({
      id: "I6",
      priority: 6,
      impact: "MEDIUM",
      title: "Bar chart not shown for multi-mine comparison results",
      affected: multimineFailures.map((f) => `Q${f.id}`),
      root_cause:
        "chart-heuristic may not classify multi-mine results as bar chart — missing the 'mine' column key check.",
      fix: "Update chart-heuristic: if rows have 'mine' column and result is a ranking/comparison, always return bar chart.",
    });
  }

  // I7: Insight quality
  const insightFailures = scores.filter(
    (q) => q.checks.find((c) => c.name === "insight" && !c.passed)
  );
  if (insightFailures.length >= 2) {
    plan.push({
      id: "I7",
      priority: 7,
      impact: "MEDIUM",
      title: "Insight text too short or missing for some queries",
      affected: insightFailures.map((q) => `Q${q.id}`),
      root_cause:
        "insight-generator may output fewer than 40 chars for simple single-row queries or when the LLM produces terse output.",
      fix: "Require minimum 2 sentences in insight-generator prompt. Add post-generation truncation/length guard: if output < 50 chars, retry once with expanded context.",
    });
  }

  if (plan.length === 0) {
    plan.push({
      id: "PERFECT",
      priority: 0,
      impact: "NONE",
      title: "No improvements needed — all checks passed",
      affected: [],
      root_cause: "n/a",
      fix: "Maintain current implementation.",
    });
  }

  return plan;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe("Quality Eval — 30 questions", () => {
  for (const fixture of QUALITY_EVAL_30) {
    test(
      `Q${String(fixture.id).padStart(2, "0")} [${fixture.category}] ${fixture.question.slice(0, 65)}`,
      async ({ page }) => {
        const result = await scoreQuestion(page, fixture);
        allScores.push(result);

        const imgDir = path.join(__dirname, "..", "playwright_img");
        if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
        await page.screenshot({
          path: path.join(imgDir, `qe30-q${String(fixture.id).padStart(2, "0")}.png`),
          fullPage: false,
        });

        // Print per-question result in test output
        const failedChecks = result.checks.filter((c) => !c.passed);
        const failedBonus  = result.bonusChecks.filter((c) => !c.passed);
        const statusLine = `[Q${String(fixture.id).padStart(2, "0")}] ${result.grade} (${result.pct}%) — ${result.score}/${result.maxScore}`;
        if (failedChecks.length > 0) {
          console.warn(statusLine + " ⚠ FAILS: " + failedChecks.map((c) => c.name).join(", "));
        } else {
          console.log(statusLine + " ✓");
        }
        if (failedBonus.length > 0) {
          console.warn(`       data-check FAIL: ${failedBonus.map((c) => `${c.name}=${c.detail}`).join(" | ")}`);
        }
      }
    );
  }

  // After all: emit report
  test.afterAll(async () => {
    if (allScores.length === 0) return;
    const report = buildReport(allScores);

    const reportPath = path.join(__dirname, "..", "quality-eval-30-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");

    // Human-readable summary in console
    const sep = "─".repeat(72);
    console.log("\n" + sep);
    console.log("QUALITY EVAL — 30 QUESTIONS REPORT");
    console.log(sep);
    console.log(`Overall: ${report.meta.overallGrade}  (${report.meta.overallPct}%)  |  ${report.summary.passedAll}/30 perfect`);
    console.log(`Grades: A=${report.summary.gradeA}  B=${report.summary.gradeB}  C=${report.summary.gradeC}  D=${report.summary.gradeD}  F=${report.summary.gradeF}`);
    console.log(sep);
    console.log("Category breakdown:");
    for (const cat of report.categoryBreakdown) {
      const bar = "█".repeat(Math.round(cat.pct / 10)) + "░".repeat(10 - Math.round(cat.pct / 10));
      console.log(`  ${cat.category.padEnd(15)} ${bar}  ${cat.grade}  ${cat.pct}%`);
    }
    console.log(sep);
    if (report.failures.length > 0) {
      console.log("Failures:");
      for (const f of report.failures) {
        console.log(`  Q${String(f.id).padStart(2, "0")} [${f.category}] ${f.grade} ${f.pct}%  ${f.question.slice(0, 55)}`);
        for (const fc of f.failedChecks) console.log(`       ✗ ${fc}`);
        for (const fc of f.failedDataChecks) console.log(`       ✗ data: ${fc}`);
      }
      console.log(sep);
    }
    console.log(`Improvement plan: ${report.improvementPlan.length} item(s)`);
    for (const item of report.improvementPlan as Array<{ id: string; priority: number; impact: string; title: string }>) {
      console.log(`  [${item.impact.padEnd(8)}] ${item.id}: ${item.title}`);
    }
    console.log(sep);
    console.log(`Full report: quality-eval-30-report.json`);
    console.log(sep + "\n");
  });
});
