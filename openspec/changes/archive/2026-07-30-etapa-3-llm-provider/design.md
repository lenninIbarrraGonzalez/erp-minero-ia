# Design: Etapa 3 — Server-side LLM Provider Infrastructure

## Technical Approach
Hexagonal port + adapters. types.ts defines LLMProvider port; three raw-fetch adapters (Groq, OpenRouter, Gemini) implement it, each taking apiKey as constructor arg (injectable/mockable). FallbackChain is an LLMProvider iterating ordered providers, skip-on-error. createLlmChain() is the only `import "server-only"` seam: reads env keys, wires chain. POST /api/llm/complete validates {prompt}, calls chain, maps LLMProviderError to JSON. Mirrors Etapa 2 DI + server-only patterns. Strict TDD.

## Architecture Decisions
- ADR-1 Raw fetch per adapter (reject vendor SDKs): zero runtime deps, trivial vi.spyOn(global,'fetch') mocking, no version drift.
- ADR-2 Separate types.ts (reject inline/barrel): every module imports the port; avoids circular deps.
- ADR-3 FallbackChain as own class (reject loop-in-factory/route): isolated tests with stub providers, decoupled from env.
- ADR-4 Factory carries import "server-only" (reject route-only/window check): same seam as supabase/server.ts; compile-time client-bundle key exclusion.

## Data Flow
Client POST {prompt} → /api/llm/complete/route.ts (validate, 400 on invalid) → createLlmChain() [server-only, env] → FallbackChain.complete() → Groq → OpenRouter → Gemini (first success wins; each LLMProviderError caught, next tried; all fail → 503 allProvidersFailed) → 200 {text,provider,model}.

## File Changes (all New except i18n Modify)
src/lib/llm/types.ts; adapters/groq.ts, openrouter.ts, gemini.ts; fallback-chain.ts; create-llm-provider.ts (server-only factory); src/app/api/llm/complete/route.ts (POST 200/400/503); *.test.ts per unit; messages/{es,en}.json (add llm.error.* keys, parity test).

## Interfaces
CompletionOptions {model?; temperature?; maxTokens?}
LLMResponse {text; provider; model}
LLMProvider { readonly name; complete(prompt, options?): Promise<LLMResponse> }
class LLMProviderError extends Error { constructor(provider, message, cause?) }

Provider shapes (throw LLMProviderError on missing key / non-2xx):
- Groq POST api.groq.com/openai/v1/chat/completions; Authorization: Bearer; body {model,messages:[{role:user,content:prompt}],temperature}; parse choices[0].message.content. Default llama-3.3-70b-versatile.
- OpenRouter POST openrouter.ai/api/v1/chat/completions; OpenAI shape + HTTP-Referer header; parse choices[0].message.content. Default meta-llama/llama-3.3-70b-instruct:free.
- Gemini POST generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}; body {contents:[{parts:[{text:prompt}]}]}; parse candidates[0].content.parts[0].text. Default gemini-2.0-flash.

Route: {prompt:string} → 200 {text,provider,model}; invalid → 400 {error: llm.error.invalidPrompt}; all fail → 503 {error: llm.error.allProvidersFailed}. Uses NextResponse.json from next/server (per health route convention).

## Testing Strategy
- Adapter x3 unit: vi.spyOn(global,'fetch'); assert URL/method/headers/body; parse LLMResponse; rejects on missing-key and non-2xx.
- FallbackChain: stub LLMProviders; first-success wins, skip-on-error, all-fail rethrows; assert call order + not-called-after-success.
- Route: mock createLlmChain import; assert 200/400/503 + JSON error keys.
- i18n es/en parity incl new llm.error.* keys.

## Threat Matrix
N/A — no routing rewrites, shell, subprocess, VCS/PR automation, executable-file classification, or process integration. Only external I/O is outbound HTTPS fetch to fixed provider hosts.

## i18n Impact
Add llm.error.allProvidersFailed and llm.error.invalidPrompt to messages/es.json and messages/en.json.

## Migration / Rollout
No migration. Isolated new files; i18n additive only. Rollback = delete src/lib/llm/ and src/app/api/llm/, revert two llm.error.* keys in both message files. Etapas 1-2 untouched.

## Review Workload Forecast
~350-400 authored lines. 400-line budget risk: Medium. Slices if grown: (1) types+FallbackChain, (2) three adapters, (3) factory+route+i18n. Each independently testable.

## Open Questions
None — provider contracts, defaults, env keys fixed by proposal.
