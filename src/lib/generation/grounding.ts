/**
 * grounding.ts — Quellengebundene Statement-Klassifikation (M2 Phase 3)
 *
 * Fail-closed-Regel (AGENTS.md §LLM-Request-Fluss):
 *   Ein Statement gilt als GROUNDED GENAU DANN wenn:
 *     (a) citationRefs ist nicht leer,
 *     (b) jeder referenzierte Index existiert (1-basiert, in Bereich),
 *     (c) jede referenzierte RankedCitation hat confidence === "GROUNDED".
 *   In allen anderen Fällen: UNSUPPORTED_DRAFT.
 *
 * Pure, deterministisch, kein IO.
 */

import type { RankedCitation } from "@/lib/rag/citation";

export type StatementConfidence = "GROUNDED" | "UNSUPPORTED_DRAFT";

export interface GroundedStatement {
  text: string;
  citationRefs: number[];
  confidence: StatementConfidence;
  /** Aufgelöste RankedCitation-Objekte für die referenzierten Indizes (in-range). */
  citations: RankedCitation[];
}

/**
 * Löst einen 1-basierten citationRef-Index auf die citations-Liste auf.
 * Gibt undefined zurück, wenn der Index außerhalb des gültigen Bereichs liegt.
 *
 * Konvention: Prompt nummeriert Zitationen [1..n]; Array-Index ist [0..n-1].
 */
function resolveCitation(
  ref: number,
  citations: RankedCitation[],
): RankedCitation | undefined {
  if (!Number.isInteger(ref) || ref < 1 || ref > citations.length) {
    return undefined;
  }
  return citations[ref - 1];
}

/**
 * groundStatements — klassifiziert rohe LLM-Statements als GROUNDED oder UNSUPPORTED_DRAFT.
 *
 * @param raw       Array von {text, citationRefs} — direkt aus der LLM-Antwort (callStructured).
 *                  citationRefs sind 1-basierte Indizes in die citations-Liste.
 * @param citations Geordnete Liste der RankedCitation-Objekte, die dem Prompt übergeben wurden.
 * @returns         GroundedStatement[] — gleiche Reihenfolge wie raw.
 */
export function groundStatements(
  raw: { text: string; citationRefs: number[] }[],
  citations: RankedCitation[],
): GroundedStatement[] {
  return raw.map((stmt) => {
    // Keine Referenzen → fail-closed: UNSUPPORTED_DRAFT
    if (stmt.citationRefs.length === 0) {
      return {
        text: stmt.text,
        citationRefs: stmt.citationRefs,
        confidence: "UNSUPPORTED_DRAFT",
        citations: [],
      };
    }

    const resolvedCitations: RankedCitation[] = [];
    let allResolved = true;
    let allGrounded = true;

    for (const ref of stmt.citationRefs) {
      const resolved = resolveCitation(ref, citations);
      if (resolved === undefined) {
        // Index außerhalb des Bereichs → fail-closed
        allResolved = false;
        break;
      }
      resolvedCitations.push(resolved);
      if (resolved.confidence !== "GROUNDED") {
        allGrounded = false;
      }
    }

    // GROUNDED nur wenn: alle Refs in-range UND alle referenzierten citations GROUNDED
    const confidence: StatementConfidence =
      allResolved && allGrounded ? "GROUNDED" : "UNSUPPORTED_DRAFT";

    return {
      text: stmt.text,
      citationRefs: stmt.citationRefs,
      confidence,
      citations: resolvedCitations,
    };
  });
}
