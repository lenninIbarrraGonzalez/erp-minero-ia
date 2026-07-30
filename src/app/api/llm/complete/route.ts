import { NextResponse } from "next/server";
import { createLlmChain } from "@/lib/llm/create-llm-provider";
import { LLMProviderError } from "@/lib/llm/types";

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "llm.error.invalidPrompt" },
      { status: 400 }
    );
  }

  const prompt = body.prompt;

  if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
    return NextResponse.json(
      { error: "llm.error.invalidPrompt" },
      { status: 400 }
    );
  }

  try {
    const chain = createLlmChain();
    const result = await chain.complete(prompt);
    return NextResponse.json(
      { text: result.text, provider: result.provider, model: result.model },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof LLMProviderError) {
      return NextResponse.json(
        { error: "llm.error.allProvidersFailed" },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "llm.error.allProvidersFailed" },
      { status: 503 }
    );
  }
}
