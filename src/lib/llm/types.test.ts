import { describe, it, expect } from "vitest";
import { LLMProviderError } from "./types";

describe("LLMProviderError", () => {
  it("exposes kind field when provided", () => {
    const err = new LLMProviderError("groq", "rate limited", undefined, "rate_limit");
    expect(err.kind).toBe("rate_limit");
  });

  it("defaults kind to 'unknown' when not provided", () => {
    const err = new LLMProviderError("groq", "generic error");
    expect(err.kind).toBe("unknown");
  });

  it("is still an instance of Error", () => {
    const err = new LLMProviderError("groq", "msg");
    expect(err).toBeInstanceOf(Error);
  });

  it("preserves provider and message", () => {
    const err = new LLMProviderError("openrouter", "timeout", undefined, "timeout");
    expect(err.provider).toBe("openrouter");
    expect(err.message).toBe("timeout");
    expect(err.kind).toBe("timeout");
  });
});
