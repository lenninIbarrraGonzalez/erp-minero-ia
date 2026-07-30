import "server-only";
import { GroqAdapter } from "@/lib/llm/adapters/groq";
import { OpenRouterAdapter } from "@/lib/llm/adapters/openrouter";
import { GeminiAdapter } from "@/lib/llm/adapters/gemini";
import { FallbackChain } from "@/lib/llm/fallback-chain";
import type { LLMProvider } from "@/lib/llm/types";

export function createLlmChain(): LLMProvider {
  return new FallbackChain([
    new GroqAdapter(process.env.GROQ_API_KEY),
    new OpenRouterAdapter(process.env.OPENROUTER_API_KEY),
    new GeminiAdapter(process.env.GEMINI_API_KEY),
  ]);
}
