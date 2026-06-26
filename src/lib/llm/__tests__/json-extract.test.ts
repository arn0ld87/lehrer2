import { describe, it, expect } from "vitest";
import { stripJsonFences, coerceToSchemaShape } from "../json-extract";

/**
 * Regressionstest für den /planung- und /arbeitsblaetter-Bug (2026-06-26):
 * gpt-oss (über Ollama-Cloud) ignoriert `strict: true json_schema` und liefert
 * bei Single-Property-Wrapper-Schemata ein BARE ARRAY statt des Objekts.
 * Beispiel: `[{text,citationRefs}]` statt `{statements:[{text,citationRefs}]}`.
 * Ohne Normalisierung las die Generierung `parsed.statements` = undefined → 0 Statements.
 */

const STATEMENTS_SCHEMA = {
  type: "object",
  properties: {
    statements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          citationRefs: { type: "array", items: { type: "integer" } },
        },
        required: ["text", "citationRefs"],
      },
    },
  },
  required: ["statements"],
} as const;

describe("coerceToSchemaShape", () => {
  it("wickelt ein bare Array in die einzige Array-Property des Schemas", () => {
    const bareArray = [
      { text: "Aussage 1", citationRefs: [1] },
      { text: "Aussage 2", citationRefs: [] },
    ];
    const result = coerceToSchemaShape(bareArray, STATEMENTS_SCHEMA);
    expect(result).toEqual({ statements: bareArray });
  });

  it("lässt ein bereits korrektes Objekt unverändert", () => {
    const obj = { statements: [{ text: "x", citationRefs: [1] }] };
    expect(coerceToSchemaShape(obj, STATEMENTS_SCHEMA)).toBe(obj);
  });

  it("wickelt NICHT, wenn das Schema mehr als eine Array-Property hat (mehrdeutig)", () => {
    const schema = {
      type: "object",
      properties: { a: { type: "array" }, b: { type: "array" } },
    };
    const arr = [1, 2, 3];
    expect(coerceToSchemaShape(arr, schema)).toBe(arr);
  });

  it("wickelt NICHT, wenn das Schema kein Objekt ist", () => {
    const schema = { type: "array" };
    const arr = [1, 2];
    expect(coerceToSchemaShape(arr, schema)).toBe(arr);
  });

  it("kombiniert mit stripJsonFences: gefenctes bare Array wird geparst und eingewickelt", () => {
    const raw = '```json\n[{"text":"a","citationRefs":[1]}]\n```';
    const parsed = JSON.parse(stripJsonFences(raw));
    expect(coerceToSchemaShape(parsed, STATEMENTS_SCHEMA)).toEqual({
      statements: [{ text: "a", citationRefs: [1] }],
    });
  });
});
