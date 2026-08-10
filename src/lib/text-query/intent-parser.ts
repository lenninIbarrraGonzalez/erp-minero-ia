import "server-only";
import { ParsedIntentSchema } from "./intent-schema";
import type { ParsedIntent } from "./types";
import type { LLMProvider } from "@/lib/llm/types";
import { LLMProviderError } from "@/lib/llm/types";
import { makeError, GENERIC_MINE_TERMS } from "./errors";

// ---------------------------------------------------------------------------
// Intent Parser — converts a natural-language question into a ParsedIntent
// ---------------------------------------------------------------------------

const SCHEMA_DESCRIPTION = `{
  "metric": "cost_per_tonne" | "tonnage" | "cost_by_driver",
  "mineName": string (optional — use for exactly ONE specific mine),
  "mineNames": string[] (optional — use ONLY when comparing 2 or more mines, e.g. ["Cerro Rojo", "Veta Dorada"]),
  "driverFilter": "fuel" | "supplies" | "equipment" | "labor" (optional — use when the user asks about a specific cost driver),
  "period": { "year": number, "month": 1-12 (optional), "quarter": 1-4 (optional) } (optional),
  "groupBy": "mine" | "driver" | "month" (optional)
}`;

function buildPrompt(question: string): string {
  return `You are a mining ERP query parser. This system only handles queries about mining operations: costs, tonnage, production, and cost drivers (fuel, supplies, equipment, labor).

If the question is completely unrelated to mining operations, respond with ONLY: {"out_of_scope": true}

Otherwise, extract the intent and respond with ONLY a JSON object matching this schema:

${SCHEMA_DESCRIPTION}

Rules:
- metric must be exactly one of: "cost_per_tonne", "tonnage", "cost_by_driver"
- Convert any date mentions (e.g. "March 2024", "marzo 2024") to year/month numbers
- For quarter mentions (primer/segundo/tercer/cuarto trimestre, Q1–Q4), set period.quarter (1–4) and period.year. Do NOT set period.month for quarters. Quarter 1 = months 1–3, Quarter 2 = months 4–6, Quarter 3 = months 7–9, Quarter 4 = months 10–12
- If the user compares or lists 2 or more mines, use "mineNames" (array) and omit "mineName"
- If the user mentions exactly one specific mine, use "mineName" (string) and omit "mineNames"
- If no specific mine is mentioned, omit both mineName and mineNames. Phrases like "all mines", "todas las minas", "todas" mean no specific mine
- Only set "driverFilter" when the user names ONE specific driver explicitly (e.g. "fuel", "combustible", "insumos", "equipos", "mano de obra"). Do NOT set driverFilter when the user asks for a general breakdown, "all drivers", "all categories", "desglose", "todas las categorías", or a full cost breakdown — in those cases omit driverFilter entirely.
- Set "driverFilter": "fuel" for fuel/combustible, "supplies" for insumos/supplies/reagentes, "equipment" for equipos/equipment/maquinaria, "labor" for mano de obra/labor/personal.
- If the user asks about "each mine", "all mines separately", "por mina", "cada mina", "qué mina tuvo el mayor/menor", "which mine had the most/least", or wants a per-mine ranking or breakdown, set groupBy: "mine"
- If the user asks about monthly evolution or trend — using phrases like "mensual", "mes por mes", "mes a mes", "monthly", "monthly trend", "monthly evolution", "evolución mensual", "tendencia mensual", "month by month", "how did ... change month" — set groupBy: "month". This applies to ALL metrics (tonnage, cost_per_tonne, cost_by_driver). For cost_by_driver with groupBy:month, driverFilter must also be set.
- If the user asks about "costo de combustible", "costo de insumos", "costo de equipos", "costo de mano de obra" (the cost OF a specific driver) WITHOUT saying "por tonelada", use metric: "cost_by_driver" with the appropriate driverFilter — do NOT use "cost_per_tonne" in this case. Example: "evolución del costo de combustible" → metric: "cost_by_driver", driverFilter: "fuel"
- For questions asking which cost driver is most or least expensive — e.g. "qué driver fue el más caro", "cuál driver es el más costoso", "qué categoría es la más cara", "which driver costs the most", "most expensive driver" — use metric: "cost_by_driver" WITHOUT driverFilter so all 4 drivers are returned for comparison
- If no time period is mentioned, omit period entirely (do not set year or month to null)
- Respond with ONLY valid JSON, no explanation, no markdown, no code blocks

User question: ${question}`;
}

export async function parseIntent(
  question: string,
  llm: LLMProvider
): Promise<ParsedIntent> {
  const MAX_QUESTION_LENGTH = 500;
  if (question.length > MAX_QUESTION_LENGTH) question = question.slice(0, MAX_QUESTION_LENGTH);

  let text: string;

  try {
    const response = await llm.complete(buildPrompt(question), {
      maxTokens: 200,
      temperature: 0,
    });
    text = response.text.trim();
  } catch (err) {
    if (err instanceof LLMProviderError) {
      const code =
        err.kind === "rate_limit" ? "llm_rate_limit" :
        err.kind === "timeout"    ? "llm_timeout"    :
        err.kind === "auth_error" ? "llm_auth_error" :
        "llm_error";
      throw makeError(code, `LLM provider failed: ${err.message}`);
    }
    throw makeError("llm_error", "Unknown LLM error");
  }

  // Strip markdown code fences if the model wraps the JSON
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error("[text-query] LLM returned invalid JSON:", cleaned);
    throw makeError("parse_failure", `LLM returned invalid JSON: ${cleaned}`);
  }

  // Reject out-of-scope questions before schema validation
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    (parsed as Record<string, unknown>).out_of_scope === true
  ) {
    throw makeError("out_of_scope", "Question is not related to mining operations");
  }

  // Some models return null for optional fields instead of omitting them.
  // Strip null/undefined values, empty objects, AND empty arrays so Zod optional() works correctly.
  function stripNulls(obj: unknown): unknown {
    if (obj === null || obj === undefined) return undefined;
    if (Array.isArray(obj)) return obj.length === 0 ? undefined : obj;
    if (typeof obj !== "object") return obj;
    const entries = Object.entries(obj as Record<string, unknown>)
      .map(([k, v]) => [k, stripNulls(v)] as [string, unknown])
      .filter(([, v]) => v !== undefined);
    if (entries.length === 0) return undefined;
    return Object.fromEntries(entries);
  }

  // Normalize mineNames before Zod validation to handle LLM hallucinations:
  // - mineNames with 0 or 1 elements cannot be a multi-mine comparison (schema requires min 2)
  // - When a single element is a generic term ("all mines", "cada mina") → no mine filter
  // - When a single element looks like a year or non-mine token → strip it (LLM confusion)
  // - When a single element looks like a real mine name → promote to mineName
  if (
    typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
  ) {
    const p = parsed as Record<string, unknown>;
    if (Array.isArray(p.mineNames)) {
      const names = p.mineNames as unknown[];

      if (names.length === 0) {
        // Empty array → no mine filter
        delete p.mineNames;
      } else if (names.length === 1) {
        const sole = names[0];
        const soleStr = typeof sole === "string" ? sole.trim() : "";
        const isGeneric = GENERIC_MINE_TERMS.has(soleStr.toLowerCase());
        const isNumeric = /^\d+$/.test(soleStr); // year or other number crept in

        if (isGeneric || isNumeric || soleStr === "") {
          // Generic or nonsensical single element → no mine filter
          delete p.mineNames;
        } else {
          // Looks like a real mine name — promote to mineName (single-mine path)
          // Only if mineName is not already set
          if (!p.mineName) p.mineName = soleStr;
          delete p.mineNames;
        }
      } else {
        // ≥2 elements: check if ALL are generic (e.g. ["all mines", "todas"])
        const allGeneric = names.every(
          (n) => typeof n === "string" && GENERIC_MINE_TERMS.has(n.toLowerCase().trim())
        );
        if (allGeneric) delete p.mineNames;
      }
    }
  }

  const cleaned2 = stripNulls(parsed);
  const result = ParsedIntentSchema.safeParse(cleaned2);
  if (!result.success) {
    const raw = parsed as Record<string, unknown>;
    const knownMetrics = ["cost_per_tonne", "tonnage", "cost_by_driver"];
    if (typeof raw?.metric === "string" && !knownMetrics.includes(raw.metric)) {
      console.error("[text-query] Unsupported metric from LLM:", raw.metric, "| raw:", JSON.stringify(raw));
      throw makeError("unsupported_metric", `Unsupported metric: ${raw.metric}`);
    }
    const detail = JSON.stringify(result.error.issues ?? result.error);
    console.error("[text-query] Schema validation failed | raw LLM JSON:", JSON.stringify(raw), "| zod issues:", detail);
    throw makeError("parse_failure", `Intent does not match expected schema: ${detail}`);
  }

  const intentData = result.data as ParsedIntent;
  const qLower = question.toLowerCase();

  // P9: Reject contradictory temporal constraints — quarter and month cannot both be set.
  // query-builder cannot resolve "Q1 AND March" into a single unambiguous time window.
  if (intentData.period?.quarter !== undefined && intentData.period?.month !== undefined) {
    throw makeError(
      "overlapping_period",
      `Contradictory period: quarter=${intentData.period.quarter} and month=${intentData.period.month} both set`
    );
  }

  // P2: Force groupBy:mine when the question asks for per-mine breakdown/ranking
  // but the LLM missed it. Only applies when no specific mine is already targeted.
  if (!intentData.groupBy && !intentData.mineNames && !intentData.mineName) {
    const PER_MINE_TRIGGERS = [
      "por mina", "cada mina", "por cada mina",
      "for each mine", "for every mine", "each mine", "every mine",
      "between all mines",
      // comparative "which mine" patterns (I3 fix)
      "qué mina", "cuál mina", "cuál fue la mina", "cuál es la mina",
      "which mine", "what mine",
    ];
    if (PER_MINE_TRIGGERS.some((p) => qLower.includes(p))) {
      (intentData as unknown as Record<string, unknown>).groupBy = "mine";
    }
  }

  // P3: Fix I1 — when question uses monthly keywords for tonnage/CPT:
  //   a) Clear spurious groupBy:mine (which returns 1 row per mine, not 12 months)
  //   b) Clear spurious period.month if no specific month name appears in question
  //      (e.g. "tonelaje mensual en 2024" should not resolve to a single month)
  const MONTHLY_KEYWORDS = [
    "mensual", "mes por mes", "mes a mes", "monthly",
    "evolución mensual", "tendencia mensual", "month by month",
  ];
  const MONTH_NAMES = [
    "enero","febrero","marzo","abril","mayo","junio",
    "julio","agosto","septiembre","octubre","noviembre","diciembre",
    "january","february","march","april","may","june",
    "july","august","september","october","november","december",
  ];
  const hasMonthlyKeyword = MONTHLY_KEYWORDS.some((kw) => qLower.includes(kw));
  const hasSpecificMonth = MONTH_NAMES.some((m) => qLower.includes(m));

  if (hasMonthlyKeyword && intentData.metric !== "cost_by_driver") {
    // a) Clear groupBy:mine — monthly means time-series, not per-mine aggregation
    if (intentData.groupBy === "mine") {
      delete (intentData as unknown as Record<string, unknown>).groupBy;
    }
    // b) Clear spurious period.month when the question only mentions a year
    if (!hasSpecificMonth && intentData.period?.month !== undefined) {
      delete (intentData.period as unknown as Record<string, unknown>).month;
    }
  }

  // P6: Clear groupBy:mine for cost_by_driver when a specific mine is already targeted.
  // A single-mine query with groupBy:mine routes to queryCostByDriverByMine which
  // ignores the mine filter and returns all 5 mines — incorrect for a single-mine question.
  if (
    intentData.metric === "cost_by_driver" &&
    intentData.mineName &&
    intentData.groupBy === "mine"
  ) {
    delete (intentData as unknown as Record<string, unknown>).groupBy;
  }

  // P7: Force driverFilter when an explicit driver keyword appears anywhere in the
  // question for cost_by_driver metric — not just at the start (extends P4).
  if (intentData.metric === "cost_by_driver" && !intentData.driverFilter) {
    const DRIVER_ANYWHERE_MAP: Array<[string, "fuel" | "supplies" | "equipment" | "labor"]> = [
      ["mano de obra", "labor"],
      ["combustible", "fuel"],
      ["insumos", "supplies"],
      ["equipos", "equipment"],
    ];
    for (const [keyword, driver] of DRIVER_ANYWHERE_MAP) {
      if (qLower.includes(keyword)) {
        (intentData as unknown as Record<string, unknown>).driverFilter = driver;
        break;
      }
    }
  }

  // P8: Force groupBy:mine for ranking/per-mine requests that P2 missed:
  //   - "ranking" in question → user wants per-mine ranking
  //   - "todas las minas" + specific driverFilter → user wants breakdown by mine for that driver
  if (!intentData.groupBy && !intentData.mineName && !intentData.mineNames) {
    const needsPerMine =
      qLower.includes("ranking") ||
      (qLower.includes("todas las minas") && !!intentData.driverFilter);
    if (needsPerMine) {
      (intentData as unknown as Record<string, unknown>).groupBy = "mine";
    }
  }

  // P5: Fix I2 — if LLM returned cost_per_tonne but question contains an explicit
  // driver keyword WITHOUT "por tonelada", the user is asking for cost_by_driver.
  // Example: "evolución mensual del costo de combustible" → cost_by_driver + fuel.
  if (intentData.metric === "cost_per_tonne" && !qLower.includes("por tonelada")) {
    const DRIVER_KEYWORD_MAP: Array<[string, "fuel" | "supplies" | "equipment" | "labor"]> = [
      ["combustible", "fuel"],
      ["insumos", "supplies"],
      ["equipos", "equipment"],
      ["mano de obra", "labor"],
    ];
    for (const [keyword, driver] of DRIVER_KEYWORD_MAP) {
      if (qLower.includes(keyword)) {
        (intentData as unknown as Record<string, unknown>).metric = "cost_by_driver";
        (intentData as unknown as Record<string, unknown>).driverFilter = driver;
        break;
      }
    }
  }

  // P4: Force driverFilter when the question STARTS with a driver keyword
  // (e.g. "Mano de obra de Cerro Rojo en Q1" → driverFilter: "labor")
  if (intentData.metric === "cost_by_driver" && !intentData.driverFilter) {
    const DRIVER_START_MAP: Array<[string, string]> = [
      ["mano de obra", "labor"],
      ["insumos", "supplies"],
      ["combustible", "fuel"],
      ["equipos", "equipment"],
    ];
    for (const [prefix, driver] of DRIVER_START_MAP) {
      if (qLower.startsWith(prefix + " ") || qLower.startsWith(prefix + ",")) {
        (intentData as unknown as Record<string, unknown>).driverFilter = driver;
        break;
      }
    }
  }

  // P10: Safety guard — if metric is still falsy after all post-parse rules, the query
  // is too ambiguous to execute. Fires only when schema relaxation or unexpected LLM
  // output bypasses the Zod required-metric check.
  if (!intentData.metric) {
    throw makeError("ambiguous_query", "No metric could be determined after all post-parse rules");
  }

  return intentData;
}
