/**
 * FakeLLMProvider — deterministischer Test-Provider
 *
 * Analog zu FakeEmbedder in src/lib/infra/ollama.ts:
 * Alle Methoden sind synchron/deterministisch — kein Netzwerk, kein State.
 *
 * callStructured gibt ein Objekt zurück, das dem Typ
 * { statements: Array<{ text: string; citationRefs: number[] }> }
 * entspricht. Die statements werden deterministisch aus dem Prompt
 * abgeleitet, sodass Tests stabile Assertions schreiben können.
 */

import { type CallContext, type JSONSchema, type LLMProvider } from "./provider";

/** Deterministic generation schema — für Tests assertierbar */
export interface FakeGenerationResult {
  statements: Array<{
    text: string;
    citationRefs: number[];
  }>;
}

export class FakeLLMProvider implements LLMProvider {
  /**
   * Gibt eine deterministisch aus dem Prompt abgeleitete Zeichenkette zurück.
   * Format: "FAKE_RESPONSE[<prompt-length>:<first-8-chars>]"
   */
  async call(prompt: string, _context?: CallContext): Promise<string> {
    const prefix = prompt.slice(0, 8).replace(/\s/g, "_");
    return `FAKE_RESPONSE[${String(prompt.length)}:${prefix}]`;
  }

  /**
   * Gibt ein deterministisches Objekt zurück, das dem generischen
   * Generation-Schema entspricht. Ableitung:
   *   - statements.length  = (prompt.length % 3) + 1  → 1, 2 oder 3
   *   - statements[i].text = "FAKE_STMT[<i>:<charCode-sum-mod-100>]"
   *   - citationRefs[i]    = [i + 1]  (stabile, assertierbare Ref-Nummern)
   *
   * Das schema-Argument wird empfangen aber nicht zur Laufzeit validiert
   * (Fake = Tests; Validierung ist Sache der echten Provider).
   */
  async callStructured<T>(
    prompt: string,
    _schema: JSONSchema,
    _context?: CallContext,
  ): Promise<T> {
    const charSum = prompt
      .split("")
      .reduce((acc, c) => acc + c.charCodeAt(0), 0);

    const count = (prompt.length % 3) + 1;
    const result: FakeGenerationResult = {
      statements: Array.from({ length: count }, (_, i) => ({
        text: `FAKE_STMT[${String(i)}:${String(charSum % 100)}]`,
        citationRefs: [i + 1],
      })),
    };

    return result as unknown as T;
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
