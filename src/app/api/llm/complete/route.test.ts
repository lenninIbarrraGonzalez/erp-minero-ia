import { describe, it, expect, vi, beforeEach } from "vitest";
import { LLMProviderError } from "@/lib/llm/types";

vi.mock("@/lib/llm/create-llm-provider", () => ({
  createLlmChain: vi.fn(),
}));

import { createLlmChain } from "@/lib/llm/create-llm-provider";
import { POST } from "./route";

const mockCreateLlmChain = vi.mocked(createLlmChain);

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/llm/complete", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/llm/complete", () => {
  it("returns 400 when body has no prompt", async () => {
    const req = makeRequest({});
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 when prompt is empty string", async () => {
    const req = makeRequest({ prompt: "" });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 200 with text, provider, model on success", async () => {
    mockCreateLlmChain.mockReturnValue({
      name: "fallback-chain",
      complete: vi.fn().mockResolvedValue({
        text: "some answer",
        provider: "groq",
        model: "llama-3.3-70b-versatile",
      }),
    });

    const req = makeRequest({ prompt: "Explain variance" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe("some answer");
    expect(body.provider).toBe("groq");
    expect(body.model).toBe("llama-3.3-70b-versatile");
  });

  it("returns 503 when chain throws LLMProviderError", async () => {
    mockCreateLlmChain.mockReturnValue({
      name: "fallback-chain",
      complete: vi
        .fn()
        .mockRejectedValue(
          new LLMProviderError("all", "All providers failed")
        ),
    });

    const req = makeRequest({ prompt: "Explain variance" });
    const res = await POST(req);

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
