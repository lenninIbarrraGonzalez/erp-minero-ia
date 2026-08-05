# Tasks: Etapa 3 — Server-side LLM Provider Infrastructure

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~620 (additions + deletions) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: types + 3 adapters + 3 adapter tests (~340 lines) → PR 2: fallback-chain + tests + factory + route + route test + i18n (~280 lines) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | types.ts + GroqAdapter + OpenRouterAdapter + GeminiAdapter (each with RED+GREEN tests) | PR 1 | `pnpm test src/lib/llm/adapters/` | N/A — adapters are server-side only; no browser/dev-server harness for isolated units | Delete `src/lib/llm/types.ts` and `src/lib/llm/adapters/` — no dependents yet |
| 2 | FallbackChain + factory + POST route + i18n keys (RED+GREEN tests for chain and route) | PR 2 | `pnpm test src/lib/llm/ src/app/api/llm/ src/i18n/` | N/A — POST route callable via `curl` locally but requires env keys; unit tests are the primary gate | Delete `src/lib/llm/fallback-chain.ts`, `src/lib/llm/create-llm-provider.ts`, `src/app/api/llm/`, revert two `llm.error.*` keys from both message files |

---

## Phase 1: Foundation — Types and Port Interface

- [x] 1.1 Create `src/lib/llm/types.ts` — define `CompletionOptions`, `LLMResponse`, `LLMProvider` interface, and `LLMProviderError extends Error` with `provider: string` and `cause: unknown`. No test file (pure types + error class). Satisfies **Requirement: Port Interface**.

---

## Phase 2: Groq Adapter (RED → GREEN)

- [x] 2.1 **RED** — Create `src/lib/llm/adapters/groq.test.ts`:
  - Test: constructor throws `LLMProviderError` when `apiKey` is `undefined`. (Spec: Adapter — Missing or Empty API Key / Scenario: Undefined key)
  - Test: constructor throws `LLMProviderError` when `apiKey` is `""`. (Spec: Scenario: Empty string key)
  - Test: `complete()` calls `fetch` with correct URL (`api.groq.com/openai/v1/chat/completions`), method POST, `Authorization: Bearer` header, and body `{model, messages:[{role:"user",content:prompt}]}`. (Spec: Adapter — HTTP Transport / Scenario: Successful HTTP call)
  - Test: `complete()` returns `LLMResponse` with `provider: "groq"` and `model: "llama-3.3-70b-versatile"` on fetch mock returning status 200. (Spec: Scenario: Successful HTTP call)
  - Test: `complete()` throws `LLMProviderError` when fetch mock returns status 500. (Spec: Scenario: Non-2xx HTTP response)
  - Run `pnpm test src/lib/llm/adapters/groq.test.ts` — expect RED (file under test does not exist).

- [x] 2.2 **GREEN** — Create `src/lib/llm/adapters/groq.ts`: implement `GroqAdapter` satisfying all groq.test.ts cases. `vi.spyOn(global, "fetch")` strategy. Run `pnpm test src/lib/llm/adapters/groq.test.ts` — expect GREEN.

---

## Phase 3: OpenRouter Adapter (RED → GREEN)

- [x] 3.1 **RED** — Create `src/lib/llm/adapters/openrouter.test.ts`:
  - Test: constructor throws `LLMProviderError` on `undefined`/`""` `apiKey`. (Spec: Adapter — Missing or Empty API Key)
  - Test: `complete()` calls `fetch` with URL `openrouter.ai/api/v1/chat/completions`, includes `HTTP-Referer` header, and parses `choices[0].message.content`. (Spec: Adapter — HTTP Transport / Scenario: Successful HTTP call)
  - Test: `complete()` returns `LLMResponse` with `provider: "openrouter"` and `model: "meta-llama/llama-3.3-70b-instruct:free"`.
  - Test: `complete()` throws `LLMProviderError` on non-2xx status. (Spec: Scenario: Non-2xx HTTP response)
  - Run `pnpm test src/lib/llm/adapters/openrouter.test.ts` — expect RED.

- [x] 3.2 **GREEN** — Create `src/lib/llm/adapters/openrouter.ts`: implement `OpenRouterAdapter`. Run `pnpm test src/lib/llm/adapters/openrouter.test.ts` — expect GREEN.

---

## Phase 4: Gemini Adapter (RED → GREEN)

- [x] 4.1 **RED** — Create `src/lib/llm/adapters/gemini.test.ts`:
  - Test: constructor throws `LLMProviderError` on `undefined`/`""` `apiKey`. (Spec: Adapter — Missing or Empty API Key)
  - Test: `complete()` calls `fetch` with URL `generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={apiKey}`, body `{contents:[{parts:[{text:prompt}]}]}`, and parses `candidates[0].content.parts[0].text`. (Spec: Adapter — HTTP Transport / Scenario: Successful HTTP call)
  - Test: `complete()` returns `LLMResponse` with `provider: "gemini"` and `model: "gemini-2.0-flash"`.
  - Test: `complete()` throws `LLMProviderError` on non-2xx status. (Spec: Scenario: Non-2xx HTTP response)
  - Run `pnpm test src/lib/llm/adapters/gemini.test.ts` — expect RED.

- [x] 4.2 **GREEN** — Create `src/lib/llm/adapters/gemini.ts`: implement `GeminiAdapter`. Run `pnpm test src/lib/llm/adapters/gemini.test.ts` — expect GREEN.

> Work Unit 1 (PR 1) boundary: all tasks 1.1–4.2 are complete and GREEN. Run `pnpm test src/lib/llm/adapters/` before creating PR 1.

---

## Phase 5: FallbackChain (RED → GREEN)

- [x] 5.1 **RED** — Create `src/lib/llm/fallback-chain.test.ts`:
  - Test: first provider resolves → returns its `LLMResponse`; second and third are never called. (Spec: FallbackChain / Scenario: First provider succeeds)
  - Test: first provider throws → second resolves → returns second's `LLMResponse`; third is never called. (Spec: Scenario: First provider fails, second succeeds)
  - Test: all three providers throw → `FallbackChain.complete()` throws `LLMProviderError` with `provider: "all"`. (Spec: Scenario: All providers fail)
  - Test: providers are called in insertion order (Groq → OpenRouter → Gemini). (Spec: ordered list, Groq → OpenRouter → Gemini)
  - Run `pnpm test src/lib/llm/fallback-chain.test.ts` — expect RED.

- [x] 5.2 **GREEN** — Create `src/lib/llm/fallback-chain.ts`: implement `FallbackChain` implementing `LLMProvider`. Run `pnpm test src/lib/llm/fallback-chain.test.ts` — expect GREEN.

---

## Phase 6: Server-Only Factory

- [x] 6.1 Create `src/lib/llm/create-llm-provider.ts`:
  - First line: `import "server-only"`.
  - Read `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY` from `process.env`.
  - Construct `GroqAdapter`, `OpenRouterAdapter`, `GeminiAdapter` with those env values.
  - Return `new FallbackChain([groq, openRouter, gemini])`.
  - No test file (server-only; Next.js build enforces client-bundle exclusion at compile time). Satisfies **Requirement: Server-Only Factory**.

---

## Phase 7: POST Route (RED → GREEN)

- [x] 7.1 **RED** — Create `src/app/api/llm/complete/route.test.ts`:
  - Mock `src/lib/llm/create-llm-provider` module.
  - Test: POST `{ prompt: "Explain variance" }` → mock chain resolves `{text,provider,model}` → response is HTTP 200 with `{ text, provider, model }`. (Spec: POST /api/llm/complete / Scenario: Valid prompt)
  - Test: POST `{}` (missing prompt) → response is HTTP 400 with JSON `{ error: "llm.error.invalidPrompt" }`. (Spec: Scenario: Missing prompt)
  - Test: POST `{ prompt: "" }` → response is HTTP 400 with JSON `{ error: "llm.error.invalidPrompt" }`. (Spec: Scenario: Missing prompt)
  - Test: POST valid prompt and chain throws `LLMProviderError({ provider: "all" })` → response is HTTP 503 with JSON `{ error: "llm.error.allProvidersFailed" }`. (Spec: Scenario: All providers fail)
  - Test: response body never contains API key values or raw error internals. (Spec: MUST NOT include API keys or raw error internals)
  - Run `pnpm test src/app/api/llm/complete/route.test.ts` — expect RED.

- [x] 7.2 **GREEN** — Create `src/app/api/llm/complete/route.ts`:
  - No `"use client"` directive.
  - `export async function POST(request: Request)` using `NextResponse.json` from `next/server`.
  - Validate `prompt`; return 400 on missing/empty.
  - Call `createLlmChain().complete(prompt)`.
  - Return 200 on success; 503 on `LLMProviderError` with `provider: "all"`.
  - Run `pnpm test src/app/api/llm/complete/route.test.ts` — expect GREEN.

---

## Phase 8: i18n Keys

- [x] 8.1 Add `llm.error.allProvidersFailed` and `llm.error.invalidPrompt` to `messages/es.json` under a `"llm"` → `"error"` nested key. Must be done in same commit as 8.2. (Spec: Requirement: i18n Keys / Scenario: Keys present in both locales)
- [x] 8.2 Add same keys to `messages/en.json`. Run `pnpm test src/i18n/messages.test.ts` — expect GREEN (parity test passes). (Spec: Scenario: Key missing in one locale)

> Work Unit 2 (PR 2) boundary: tasks 5.1–8.2 complete and GREEN. Run `pnpm test src/lib/llm/ src/app/api/llm/ src/i18n/` before creating PR 2.

---

## Phase 9: Full Suite Verification

- [x] 9.1 Run `pnpm test` — full suite must be GREEN with no regressions in Etapas 1–2. Satisfies all spec scenarios end-to-end.
