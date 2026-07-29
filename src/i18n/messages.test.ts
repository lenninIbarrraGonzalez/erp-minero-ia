import { describe, it, expect } from "vitest";
import es from "../../messages/es.json";
import en from "../../messages/en.json";

type Json = Record<string, unknown>;

function flatKeys(obj: Json, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === "object" && !Array.isArray(value)
      ? flatKeys(value as Json, path)
      : [path];
  });
}

describe("i18n message catalogs", () => {
  it("es and en expose the exact same key set", () => {
    expect(flatKeys(es).sort()).toEqual(flatKeys(en).sort());
  });
});
