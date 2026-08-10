import { describe, it, expect } from "vitest";
import { makeError, GENERIC_MINE_TERMS } from "./errors";

describe("makeError", () => {
  it("returns an object with the given code", () => {
    const err = makeError("parse_failure", "something went wrong");
    expect(err.code).toBe("parse_failure");
  });

  it("returns an instance of Error", () => {
    const err = makeError("parse_failure", "msg");
    expect(err).toBeInstanceOf(Error);
  });

  it("sets the message on the error", () => {
    const err = makeError("llm_error", "LLM failed");
    expect(err.message).toBe("LLM failed");
  });

  it("round-trips all valid code values including granular LLM and DB codes", () => {
    const codes = [
      "parse_failure",
      "unsupported_metric",
      "mine_not_found",
      "empty_result",
      "llm_error",
      "llm_timeout",
      "llm_rate_limit",
      "llm_auth_error",
      "db_error",
      "db_connection_error",
      "db_timeout",
      "out_of_scope",
      "year_out_of_range",
      "ambiguous_query",
      "overlapping_period",
    ] as const;
    for (const code of codes) {
      expect(makeError(code, "m").code).toBe(code);
    }
  });

  it("accepts optional context and exposes it on the error", () => {
    const err = makeError("mine_not_found", "not found", { attempted: "Serro Rojo" });
    expect((err as unknown as { context: Record<string, unknown> }).context).toEqual({
      attempted: "Serro Rojo",
    });
  });

  it("context is undefined when not provided", () => {
    const err = makeError("parse_failure", "msg");
    expect((err as unknown as { context?: unknown }).context).toBeUndefined();
  });
});

describe("GENERIC_MINE_TERMS", () => {
  it("contains 'cada mina'", () => {
    expect(GENERIC_MINE_TERMS.has("cada mina")).toBe(true);
  });

  it("contains terms from the original intent-parser set", () => {
    expect(GENERIC_MINE_TERMS.has("all")).toBe(true);
    expect(GENERIC_MINE_TERMS.has("todas")).toBe(true);
    expect(GENERIC_MINE_TERMS.has("todas las minas")).toBe(true);
    expect(GENERIC_MINE_TERMS.has("all mines")).toBe(true);
    expect(GENERIC_MINE_TERMS.has("minas")).toBe(true);
    expect(GENERIC_MINE_TERMS.has("mines")).toBe(true);
    expect(GENERIC_MINE_TERMS.has("every mine")).toBe(true);
    expect(GENERIC_MINE_TERMS.has("each mine")).toBe(true);
    expect(GENERIC_MINE_TERMS.has("cualquier mina")).toBe(true);
  });

  it("is a Set (not an array)", () => {
    expect(GENERIC_MINE_TERMS).toBeInstanceOf(Set);
  });

  it("does not contain arbitrary strings", () => {
    expect(GENERIC_MINE_TERMS.has("Cerro Rojo")).toBe(false);
    expect(GENERIC_MINE_TERMS.has("La Escondida")).toBe(false);
  });
});
