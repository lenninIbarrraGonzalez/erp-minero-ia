import { describe, it, expect, vi } from "vitest";
import { FallbackChain } from "./fallback-chain";
import { LLMProviderError } from "./types";
import type { LLMProvider, LLMResponse } from "./types";

function makeProvider(
  name: string,
  result: LLMResponse | Error
): LLMProvider {
  return {
    name,
    complete: vi.fn().mockImplementation(() => {
      if (result instanceof Error) return Promise.reject(result);
      return Promise.resolve(result);
    }),
  };
}

const successResponse = (provider: string): LLMResponse => ({
  text: "Hello from " + provider,
  provider,
  model: "test-model",
});

describe("FallbackChain", () => {
  it("returns response from first provider on success", async () => {
    const first = makeProvider("first", successResponse("first"));
    const second = makeProvider("second", successResponse("second"));
    const chain = new FallbackChain([first, second]);

    const result = await chain.complete("test prompt");

    expect(result.provider).toBe("first");
    expect(result.text).toBe("Hello from first");
    expect(second.complete).not.toHaveBeenCalled();
  });

  it("skips first provider on error and returns second provider response", async () => {
    const first = makeProvider(
      "first",
      new LLMProviderError("first", "unavailable")
    );
    const second = makeProvider("second", successResponse("second"));
    const chain = new FallbackChain([first, second]);

    const result = await chain.complete("test prompt");

    expect(result.provider).toBe("second");
    expect(first.complete).toHaveBeenCalledOnce();
    expect(second.complete).toHaveBeenCalledOnce();
  });

  it("throws LLMProviderError with provider 'all' when all providers fail", async () => {
    const first = makeProvider(
      "first",
      new LLMProviderError("first", "fail")
    );
    const second = makeProvider(
      "second",
      new LLMProviderError("second", "fail")
    );
    const third = makeProvider(
      "third",
      new LLMProviderError("third", "fail")
    );
    const chain = new FallbackChain([first, second, third]);

    await expect(chain.complete("test prompt")).rejects.toThrow(
      LLMProviderError
    );

    await chain.complete("test prompt").catch((err: LLMProviderError) => {
      expect(err.provider).toBe("all");
    });
  });

  it("passes options through to each provider attempted", async () => {
    const opts = { maxTokens: 100, temperature: 0.5 };
    const first = makeProvider(
      "first",
      new LLMProviderError("first", "fail")
    );
    const second = makeProvider("second", successResponse("second"));
    const chain = new FallbackChain([first, second]);

    await chain.complete("test prompt", opts);

    expect(first.complete).toHaveBeenCalledWith("test prompt", opts);
    expect(second.complete).toHaveBeenCalledWith("test prompt", opts);
  });
});
