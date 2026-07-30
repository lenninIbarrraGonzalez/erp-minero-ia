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

describe("i18n catalog integrity", () => {
  it("es and en have identical key sets", () => {
    const esKeys = flatKeys(es as unknown as Json).sort();
    const enKeys = flatKeys(en as unknown as Json).sort();
    expect(esKeys).toEqual(enKeys);
  });

  it("neither catalog contains the orphaned home.subtitle key", () => {
    const esKeys = flatKeys(es as unknown as Json);
    const enKeys = flatKeys(en as unknown as Json);
    expect(esKeys).not.toContain("home.subtitle");
    expect(enKeys).not.toContain("home.subtitle");
  });
});
