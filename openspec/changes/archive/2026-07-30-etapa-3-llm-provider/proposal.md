# Proposal: Etapa 3 — Server-side LLM Provider Infrastructure

## Intent

Etapas 4 (text-to-query) and 5 (cost-variance explainer) need an LLM access layer, but none exists. This change delivers a hexagonal `LLMProvider` port with three raw-fetch adapters (Groq, OpenRouter, Gemini) behind a fallback chain, plus a server-only factory and a `POST /api/llm/complete` route. Pure infrastructure — no UI, no domain logic, no DB access.

## Scope

### In Scope
- Port interface in `src/lib/llm/types.ts`: `LLMProvider`, `CompletionOptions`, `LLMResponse`, `LLMProviderError`.
- Three raw-fetch adapters (no SDK): `GroqAdapter`, `OpenRouterAdapter`, `GeminiAdapter`; each takes `apiKey: string | undefined`, throws `LLMProviderError` on missing key or HTTP error.
- Default models: Groq `llama-3.3-70b-versatile`, OpenRouter `meta-llama/llama-3.3-70b-instruct:free`, Gemini `gemini-2.0-flash`.
- `FallbackChain`: iterates Groq→OpenRouter→Gemini, catches errors, throws when all fail.
- Server-only factory `createLlmChain()` in `src/lib/llm/create-llm-provider.ts` (reads env keys, `import "server-only"`).
- `POST /api/llm/complete`: input `{ prompt }`, output `{ text, provider, model }`.
- i18n `llm.*` error keys in `messages/es.json` + `messages/en.json` (parity test enforced).

### Out of Scope
- Text-to-query (Etapa 4) and cost-variance explainer (Etapa 5) consumers.
- Streaming responses, token/cost accounting, retries with backoff, rate limiting.
- Any UI, client component, or DB query.

## Capabilities

### New Capabilities
- `llm-provider`: server-side LLM port, provider adapters, fallback chain, factory, and completion route handler.

### Modified Capabilities
- None.

## Approach

Follow the Etapa 2 DI + server-only patterns. Adapters implement the `LLMProvider` port and take `apiKey` as a constructor arg (injectable, mockable). Tests mock transport via `vi.spyOn(global, 'fetch')` — no SDK, zero new runtime deps. `createLlmChain()` is the only env-reading, `server-only`-guarded seam; adapters stay pure. The route handler validates `{ prompt }`, calls the chain, maps `LLMProviderError` to a JSON error using `llm.*` i18n keys. Strict TDD: RED test per adapter, chain, factory, and route before GREEN.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/llm/types.ts` | New | Port + error types |
| `src/lib/llm/adapters/*.ts` | New | Groq, OpenRouter, Gemini adapters |
| `src/lib/llm/fallback-chain.ts` | New | Ordered fallback chain |
| `src/lib/llm/create-llm-provider.ts` | New | Server-only env factory |
| `src/app/api/llm/complete/route.ts` | New | POST completion handler |
| `messages/{es,en}.json` | Modified | `llm.*` error keys |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Provider API contract drift | Med | Isolated per-adapter; swap without touching port |
| API key leak to client | Low | `import "server-only"` on factory; route-only access |
| Missing/invalid env keys at runtime | Med | Adapter throws `LLMProviderError`; chain falls through |

## Rollback Plan

Delete `src/lib/llm/`, `src/app/api/llm/`, and the `llm.*` keys from both message files. No DB migrations, no shared modules touched — removal is fully isolated and leaves Etapas 1–2 intact.

## Dependencies

- Env keys already in `env.example`: `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`.
- Read `node_modules/next/dist/docs/` for Route Handler conventions before coding.

## Success Criteria

- [x] Each adapter unit-tested (success, missing key, HTTP error) with mocked `fetch`.
- [x] `FallbackChain` falls through on failure and throws when all providers fail.
- [x] `POST /api/llm/complete` returns `{ text, provider, model }` and maps errors via `llm.*` keys.
- [x] `createLlmChain()` guarded by `import "server-only"`; no client bundle exposure.
- [x] es/en parity test passes with new `llm.*` keys.
