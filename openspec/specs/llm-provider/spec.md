# LLM Provider Specification

## Purpose

Server-side infrastructure for LLM access: a hexagonal port interface, three raw-fetch adapters
(Groq, OpenRouter, Gemini), a fallback chain, a server-only factory, and a POST completion
route. No UI, no domain logic, no database access.

---

## Requirements

### Requirement: Port Interface

The system MUST expose a `LLMProvider` interface with `name: string` and
`complete(prompt: string, opts?: CompletionOptions): Promise<LLMResponse>`.
`CompletionOptions` MUST define `maxTokens?: number` and `temperature?: number`.
`LLMResponse` MUST define `text: string`, `provider: string`, and `model: string`.
`LLMProviderError` MUST extend `Error` and carry `provider: string` and `cause: unknown`.
All types MUST live in `src/lib/llm/types.ts`.

#### Scenario: Successful completion

- GIVEN a valid `LLMProvider` implementation
- WHEN `complete(prompt, opts)` resolves
- THEN it returns an `LLMResponse` with non-empty `text`, `provider`, and `model`

#### Scenario: Typed error surfaced

- GIVEN any adapter that detects a failure
- WHEN it throws
- THEN the thrown value is an `LLMProviderError` with a non-empty `provider` field

---

### Requirement: Adapter — Missing or Empty API Key

Each adapter (`GroqAdapter`, `OpenRouterAdapter`, `GeminiAdapter`) MUST accept
`apiKey: string | undefined` in its constructor and MUST throw `LLMProviderError`
synchronously when `apiKey` is `undefined` or an empty string.

#### Scenario: Undefined key

- GIVEN an adapter instantiated with `apiKey: undefined`
- WHEN `complete(prompt)` is called
- THEN it throws `LLMProviderError` with `provider` set to the adapter name

#### Scenario: Empty string key

- GIVEN an adapter instantiated with `apiKey: ""`
- WHEN `complete(prompt)` is called
- THEN it throws `LLMProviderError` with `provider` set to the adapter name

---

### Requirement: Adapter — HTTP Transport

Each adapter MUST use the global `fetch` function (no SDK imports) to call the
provider API. Each MUST parse the provider-specific response shape into `LLMResponse`.
Each MUST throw `LLMProviderError` when the HTTP response status is not 2xx.
Default models: Groq → `llama-3.3-70b-versatile`,
OpenRouter → `meta-llama/llama-3.3-70b-instruct:free`,
Gemini → `gemini-2.0-flash`.

#### Scenario: Successful HTTP call

- GIVEN a valid API key and a mocked `fetch` returning status 200
- WHEN `complete(prompt)` is called
- THEN it returns `LLMResponse` with `text` from the parsed body and correct `provider`/`model`

#### Scenario: Non-2xx HTTP response

- GIVEN a valid API key and a mocked `fetch` returning status 500
- WHEN `complete(prompt)` is called
- THEN it throws `LLMProviderError` with `provider` set to the adapter name

---

### Requirement: FallbackChain

`FallbackChain` MUST accept an ordered list of `LLMProvider` instances at construction.
It MUST call each provider in insertion order (Groq → OpenRouter → Gemini).
It MUST catch any error from a provider and proceed to the next.
It MUST return the first successful `LLMResponse`.
It MUST throw `LLMProviderError` with `provider: "all"` when every provider fails.
`FallbackChain` MUST live in `src/lib/llm/fallback-chain.ts`.

#### Scenario: First provider succeeds

- GIVEN a chain of three providers where the first resolves
- WHEN `complete(prompt)` is called
- THEN it returns the first provider's `LLMResponse` without calling the others

#### Scenario: First provider fails, second succeeds

- GIVEN a chain where the first throws and the second resolves
- WHEN `complete(prompt)` is called
- THEN it returns the second provider's `LLMResponse`

#### Scenario: All providers fail

- GIVEN a chain where every provider throws
- WHEN `complete(prompt)` is called
- THEN it throws `LLMProviderError` with `provider: "all"`

---

### Requirement: Server-Only Factory

`createLlmChain()` in `src/lib/llm/create-llm-provider.ts` MUST import `"server-only"`
as its first import to prevent client-bundle inclusion.
It MUST read `GROQ_API_KEY`, `OPENROUTER_API_KEY`, and `GEMINI_API_KEY` from
`process.env` and construct adapters with those values.
It MUST return a `FallbackChain` with adapters in Groq → OpenRouter → Gemini order.

#### Scenario: Factory builds chain

- GIVEN all three env keys are set
- WHEN `createLlmChain()` is called
- THEN it returns a `FallbackChain` with three adapters in the declared order

#### Scenario: Client import blocked

- GIVEN the factory module is imported in a client context
- WHEN the Next.js build processes it
- THEN the build MUST fail due to `"server-only"` guard

---

### Requirement: POST /api/llm/complete Route

The route handler at `src/app/api/llm/complete/route.ts` MUST NOT contain `"use client"`.
It MUST accept POST requests with JSON body `{ prompt: string }`.
It MUST return HTTP 400 with an i18n error key if `prompt` is missing or empty.
It MUST return HTTP 200 with `{ text, provider, model }` on success.
It MUST return HTTP 503 with an i18n error key if all providers fail (`LLMProviderError` with `provider: "all"`).
It MUST NOT include API keys or raw error internals in any response body.

#### Scenario: Valid prompt

- GIVEN a POST request with `{ "prompt": "Explain variance" }`
- WHEN the chain resolves
- THEN the response is 200 with `{ text, provider, model }`

#### Scenario: Missing prompt

- GIVEN a POST request with an empty body or `{ "prompt": "" }`
- WHEN the handler validates input
- THEN the response is 400 with a JSON error referencing `llm.error.invalidPrompt`

#### Scenario: All providers fail

- GIVEN a POST request with a valid prompt and all adapters throw
- WHEN the chain throws `LLMProviderError(provider: "all")`
- THEN the response is 503 with a JSON error referencing `llm.error.allProvidersFailed`

---

### Requirement: i18n Keys

Both `messages/es.json` and `messages/en.json` MUST define:
- `llm.error.allProvidersFailed`
- `llm.error.invalidPrompt`

The existing parity test at `src/i18n/messages.test.ts` MUST pass with these keys present.

#### Scenario: Keys present in both locales

- GIVEN the two message files each contain `llm.error.allProvidersFailed` and `llm.error.invalidPrompt`
- WHEN the parity test runs
- THEN it passes with no missing-key failures

#### Scenario: Key missing in one locale

- GIVEN one message file is missing a `llm.*` key
- WHEN the parity test runs
- THEN it fails, blocking the build
