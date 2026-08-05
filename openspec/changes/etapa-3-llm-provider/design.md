# Design: Etapa 3 — Server-side LLM Provider Infrastructure

## Technical Approach

Hexagonal port + adapters. `types.ts` defines the `LLMProvider` port; three raw-`fetch` adapters (Groq, OpenRouter, Gemini) implement it, each taking `apiKey` as a constructor arg (injectable → mockable). `FallbackChain` is an `LLMProvider` that iterates ordered providers, skipping on error. `createLlmChain()` is the only `import "server-only"` seam: it reads env keys and wires the chain. `POST /api/llm/complete` validates `{prompt}`, calls the chain, and maps `LLMProviderError` to JSON. Mirrors Etapa 2 DI + server-only patterns. Strict TDD: RED → GREEN per adapter, chain, factory, route.

## Architecture Decisions

| ID | Decision | Alternatives rejected | Rationale |
|----|----------|-----------------------|-----------|
| ADR-1 | Raw `fetch` per adapter | Vendor SDKs (groq-sdk, @google/genai) | Zero new runtime deps; trivial mocking via `vi.spyOn(global,'fetch')`; no bundler/version drift |
| ADR-2 | Separate `types.ts` module | Inline types per file; barrel export | Every module imports the port; central module avoids circular deps |
| ADR-3 | `FallbackChain` as its own class | Loop inside factory; loop inside route | Testable in isolation with stub providers; decoupled from env/factory |
| ADR-4 | Factory carries `import "server-only"` | Guard in route only; runtime `typeof window` check | Same seam as `supabase/server.ts`; compile-time client-bundle exclusion of API keys |

## Data Flow

    Client ──POST {prompt}──▶ /api/llm/complete/route.ts
                                   │ validate prompt (400 on invalid)
                                   ▼
                             createLlmChain()  [server-only, reads env]
                                   │
                                   ▼
                             FallbackChain.complete(prompt, opts)
             ┌────────────┬────────┴────────┬─────────────┐
             ▼            ▼                  ▼             (all throw)
        GroqAdapter  OpenRouterAdapter  GeminiAdapter ──▶ throw LLMProviderError
             │            │                  │                    │
             └── fetch(provider API) ────────┘              503 allProvidersFailed
                          │
                          ▼
                200 {text, provider, model}

Sequence: first adapter that returns wins; each thrown `LLMProviderError` is caught and the next is tried; exhausting all rethrows an aggregate error.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/llm/types.ts` | Create | Port `LLMProvider`, `CompletionOptions`, `LLMResponse`, `LLMProviderError` |
| `src/lib/llm/adapters/groq.ts` | Create | OpenAI-shape POST to Groq |
| `src/lib/llm/adapters/openrouter.ts` | Create | OpenAI-shape POST + `HTTP-Referer` header |
| `src/lib/llm/adapters/gemini.ts` | Create | `contents/parts` shape; key as query param |
| `src/lib/llm/fallback-chain.ts` | Create | Ordered `LLMProvider` iterator |
| `src/lib/llm/create-llm-provider.ts` | Create | `server-only` factory reading env keys |
| `src/app/api/llm/complete/route.ts` | Create | `POST` handler, 200/400/503 |
| `*.test.ts` (adapters, chain, factory, route) | Create | Vitest, mocked `fetch`/chain |
| `messages/{es,en}.json` | Modify | Add `llm.error.*` keys (parity test) |

## Interfaces / Contracts

```typescript
export interface CompletionOptions { model?: string; temperature?: number; maxTokens?: number }
export interface LLMResponse { text: string; provider: string; model: string }
export interface LLMProvider {
  readonly name: string;
  complete(prompt: string, options?: CompletionOptions): Promise<LLMResponse>;
}
export class LLMProviderError extends Error {
  constructor(readonly provider: string, message: string, readonly cause?: unknown) {
    super(message); this.name = "LLMProviderError";
  }
}
```

Provider request shapes (each adapter throws `LLMProviderError` on missing key or non-2xx):
- **Groq** `POST https://api.groq.com/openai/v1/chat/completions` — `Authorization: Bearer`; body `{model, messages:[{role:"user",content:prompt}], temperature}`; parse `choices[0].message.content`. Default `llama-3.3-70b-versatile`.
- **OpenRouter** `POST https://openrouter.ai/api/v1/chat/completions` — same OpenAI shape + `HTTP-Referer` header; parse `choices[0].message.content`. Default `meta-llama/llama-3.3-70b-instruct:free`.
- **Gemini** `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}` — body `{contents:[{parts:[{text:prompt}]}]}`; parse `candidates[0].content.parts[0].text`. Default `gemini-2.0-flash`.

Route contract: request `{prompt:string}` → `200 {text,provider,model}`; empty/non-string prompt → `400 {error: llm.error.invalidPrompt}`; all providers fail → `503 {error: llm.error.allProvidersFailed}`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (adapter ×3) | Request URL/method/headers/body shape; response parse; missing-key throw; non-2xx throw | `vi.spyOn(global,'fetch')`; assert call args + parsed `LLMResponse`; `expect(...).rejects` on error paths |
| Unit (FallbackChain) | First-success wins; skip-on-error to next; all-fail rethrows aggregate | Stub `LLMProvider`s (resolve/reject); assert call order + not-called-after-success |
| Integration (route) | 200 happy path; 400 invalid prompt; 503 all-fail | Mock `createLlmChain` import; assert status + JSON body/error keys |
| i18n | es/en key parity incl. new `llm.error.*` | Existing parity test |

## Threat Matrix

N/A — no routing rewrites, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. The route is a standard Next.js Route Handler; the only external I/O is outbound HTTPS `fetch` to fixed provider hosts.

## i18n Impact

Add to both `messages/es.json` and `messages/en.json`:
- `llm.error.allProvidersFailed`
- `llm.error.invalidPrompt`

## Migration / Rollout

No migration. Fully isolated new files; only i18n catalogs are modified (additive keys). No DB, no shared modules, no client bundle. Rollback = delete `src/lib/llm/` and `src/app/api/llm/`, revert the two `llm.error.*` keys in both message files. Etapas 1–2 untouched.

## Review Workload Forecast

Estimated ~350–400 authored lines (8 source + ~8 test files, small each). `400-line budget risk: Medium`. Natural work-unit slices if it grows: (1) `types.ts` + `FallbackChain`, (2) three adapters, (3) factory + route + i18n. Each slice is independently testable.

## Open Questions

None — provider contracts, defaults, and env keys are fixed by the proposal.
