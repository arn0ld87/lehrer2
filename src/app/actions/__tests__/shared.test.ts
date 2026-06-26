import { describe, it, expect } from "vitest";
import { parseConstraints } from "../shared";

describe("parseConstraints", () => {
  it("parst ein JSON-Array und dedupliziert/trimmt", () => {
    expect(parseConstraints('["45 Minuten"," LRS-Unterstützung ","45 Minuten"]')).toEqual([
      "45 Minuten",
      "LRS-Unterstützung",
    ]);
  });

  it("fällt bei Nicht-JSON auf Semikolon-Trennung zurück", () => {
    expect(parseConstraints("Doppelstunde; Inklusion ; ")).toEqual([
      "Doppelstunde",
      "Inklusion",
    ]);
  });

  it("liefert [] für undefined/leer", () => {
    expect(parseConstraints(undefined)).toEqual([]);
    expect(parseConstraints("")).toEqual([]);
  });

  it("begrenzt defensiv auf 12 Einträge", () => {
    const many = JSON.stringify(Array.from({ length: 20 }, (_, i) => `c${i}`));
    expect(parseConstraints(many)).toHaveLength(12);
  });
});
