import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LLMProviderError } from "./types";
import { classifyHttpStatus, withExponentialBackoff } from "./http-utils";

describe("classifyHttpStatus", () => {
  it("classifies 429 as rate_limit", () => {
    expect(classifyHttpStatus(429)).toBe("rate_limit");
  });
  it("classifies 401 as auth_error", () => {
    expect(classifyHttpStatus(401)).toBe("auth_error");
  });
  it("classifies 403 as auth_error", () => {
    expect(classifyHttpStatus(403)).toBe("auth_error");
  });
  it("classifies 408 as timeout", () => {
    expect(classifyHttpStatus(408)).toBe("timeout");
  });
  it("classifies 504 as timeout", () => {
    expect(classifyHttpStatus(504)).toBe("timeout");
  });
  it("classifies 500 as server_error", () => {
    expect(classifyHttpStatus(500)).toBe("server_error");
  });
  it("classifies 503 as server_error", () => {
    expect(classifyHttpStatus(503)).toBe("server_error");
  });
  it("classifies 200 as unknown", () => {
    expect(classifyHttpStatus(200)).toBe("unknown");
  });
});

describe("withExponentialBackoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns result immediately when fn succeeds on first try", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withExponentialBackoff(fn, {
      maxRetries: 2,
      baseDelayMs: 500,
      factor: 3,
      retryOn: ["rate_limit"],
    });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on rate_limit and succeeds on 2nd attempt", async () => {
    const err = new LLMProviderError("groq", "429", undefined, "rate_limit");
    const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValue("ok");

    const promise = withExponentialBackoff(fn, {
      maxRetries: 2,
      baseDelayMs: 500,
      factor: 3,
      retryOn: ["rate_limit"],
    });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry on auth_error — throws immediately", async () => {
    const err = new LLMProviderError("groq", "401", undefined, "auth_error");
    const fn = vi.fn().mockRejectedValue(err);

    await expect(
      withExponentialBackoff(fn, {
        maxRetries: 2,
        baseDelayMs: 500,
        factor: 3,
        retryOn: ["rate_limit", "timeout"],
      })
    ).rejects.toThrow(err);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws after maxRetries exhausted", async () => {
    const err = new LLMProviderError("groq", "429", undefined, "rate_limit");
    const fn = vi.fn().mockRejectedValue(err);

    const promise = withExponentialBackoff(fn, {
      maxRetries: 2,
      baseDelayMs: 500,
      factor: 3,
      retryOn: ["rate_limit"],
    }).catch((e: unknown) => e); // prevent unhandled rejection

    await vi.runAllTimersAsync();

    const result = await promise;
    expect(result).toBe(err);
    expect(fn).toHaveBeenCalledTimes(3); // 1 original + 2 retries
  });

  it("re-throws non-LLMProviderError errors immediately", async () => {
    const err = new Error("network failure");
    const fn = vi.fn().mockRejectedValue(err);

    await expect(
      withExponentialBackoff(fn, {
        maxRetries: 2,
        baseDelayMs: 500,
        factor: 3,
        retryOn: ["rate_limit"],
      })
    ).rejects.toThrow("network failure");

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
