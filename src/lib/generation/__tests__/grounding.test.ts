/**
 * grounding.test.ts — GROUNDED vs. UNSUPPORTED_DRAFT Klassifikation
 *
 * Pure Unit-Tests: kein Docker, kein Netzwerk, kein Postgres.
 * RankedCitation-Fixtures sind vollständig typisiert (alle Pflichtfelder).
 *
 * citationRefs sind 1-basiert (Prompt-Konvention):
 *   ref=1 → citations[0], ref=2 → citations[1], ref=99 → out-of-range → UNSUPPORTED_DRAFT
 */

import { describe, it, expect } from "vitest";
import { groundStatements } from "@/lib/generation/grounding";
import type { RankedCitation } from "@/lib/rag/citation";

// ── Fixture-Helpers ───────────────────────────────────────────────────────────

function makeCitation(overrides: Partial<RankedCitation> & { confidence: RankedCitation["confidence"] }): RankedCitation {
  return {
    sourceId: "src-01",
    title: "Lehrplan Deutsch Sachsen-Anhalt",
    uri: null,
    publisher: "LISA Sachsen-Anhalt",
    pageOrSection: "S. 12",
    sourceVersion: 1,
    license: "CC BY 4.0",
    retrievedAt: null,
    contentHash: "abc123",
    trustLevel: "OFFICIAL_BINDING",
    confessionContext: null,
    subject: "DEUTSCH",
    chunkText: "Kompetenzstufe 1: Texte verstehen.",
    score: 0.9,
    ...overrides,
  };
}

const GROUNDED_CITATION: RankedCitation = makeCitation({
  confidence: "GROUNDED",
  trustLevel: "OFFICIAL_BINDING",
  sourceId: "src-official",
  title: "Lehrplan Deutsch SEK I",
});

const DRAFT_CITATION: RankedCitation = makeCitation({
  confidence: "UNSUPPORTED_DRAFT",
  trustLevel: "UNVERIFIED",
  sourceId: "src-unverified",
  title: "Inoffizielle Materialsammlung",
  score: 0.5,
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("groundStatements()", () => {
  it("statement mit citationRefs:[1] auf GROUNDED-Zitation → confidence 'GROUNDED'", () => {
    const [stmt] = groundStatements(
      [{ text: "Schüler sollen Texte analysieren.", citationRefs: [1] }],
      [GROUNDED_CITATION],
    );
    expect(stmt.confidence).toBe("GROUNDED");
  });

  it("statement mit citationRefs:[] → 'UNSUPPORTED_DRAFT' (fail-closed: keine Refs)", () => {
    const [stmt] = groundStatements(
      [{ text: "Irgendeine Behauptung.", citationRefs: [] }],
      [GROUNDED_CITATION],
    );
    expect(stmt.confidence).toBe("UNSUPPORTED_DRAFT");
  });

  it("statement mit citationRefs:[1] auf UNSUPPORTED_DRAFT-Zitation → 'UNSUPPORTED_DRAFT'", () => {
    const [stmt] = groundStatements(
      [{ text: "Eine wenig fundierte Aussage.", citationRefs: [1] }],
      [DRAFT_CITATION],
    );
    expect(stmt.confidence).toBe("UNSUPPORTED_DRAFT");
  });

  it("statement mit out-of-range ref [99] → 'UNSUPPORTED_DRAFT'", () => {
    const [stmt] = groundStatements(
      [{ text: "Aussage mit ungültigem Ref.", citationRefs: [99] }],
      [GROUNDED_CITATION],
    );
    expect(stmt.confidence).toBe("UNSUPPORTED_DRAFT");
  });

  it("leere citations-Liste → alle Statements 'UNSUPPORTED_DRAFT' (0-citations fail-safe)", () => {
    const results = groundStatements(
      [
        { text: "Statement A.", citationRefs: [1] },
        { text: "Statement B.", citationRefs: [] },
        { text: "Statement C.", citationRefs: [2] },
      ],
      [], // leere citations
    );
    expect(results).toHaveLength(3);
    for (const stmt of results) {
      expect(stmt.confidence).toBe("UNSUPPORTED_DRAFT");
    }
  });

  it("GROUNDED-Statement enthält die aufgelöste Zitation in .citations", () => {
    const [stmt] = groundStatements(
      [{ text: "Textkompetenz gemäß Lehrplan.", citationRefs: [1] }],
      [GROUNDED_CITATION],
    );
    expect(stmt.citations).toHaveLength(1);
    expect(stmt.citations[0]).toEqual(GROUNDED_CITATION);
  });

  it("UNSUPPORTED_DRAFT durch leere Refs hat leeres .citations-Array", () => {
    const [stmt] = groundStatements(
      [{ text: "Ungestützte Behauptung.", citationRefs: [] }],
      [GROUNDED_CITATION],
    );
    expect(stmt.citations).toHaveLength(0);
  });

  it("Mischung: GROUNDED + UNSUPPORTED_DRAFT in einem Batch", () => {
    const results = groundStatements(
      [
        { text: "Fundiert.", citationRefs: [1] },
        { text: "Nicht fundiert.", citationRefs: [] },
        { text: "Schlechte Quelle.", citationRefs: [2] },
      ],
      [GROUNDED_CITATION, DRAFT_CITATION],
    );

    expect(results[0].confidence).toBe("GROUNDED");
    expect(results[1].confidence).toBe("UNSUPPORTED_DRAFT");
    expect(results[2].confidence).toBe("UNSUPPORTED_DRAFT");
  });

  it("Statement referenziert gemischte Refs (GROUNDED + UNSUPPORTED_DRAFT) → 'UNSUPPORTED_DRAFT'", () => {
    // Alle müssen GROUNDED sein; eine UNSUPPORTED_DRAFT-Zitation zieht das ganze Statement runter
    const [stmt] = groundStatements(
      [{ text: "Gemischte Quellen.", citationRefs: [1, 2] }],
      [GROUNDED_CITATION, DRAFT_CITATION],
    );
    expect(stmt.confidence).toBe("UNSUPPORTED_DRAFT");
  });

  it("Statement referenziert ref=2 (GROUNDED an zweiter Stelle) → 'GROUNDED'", () => {
    // Stellt sicher dass 1-basierte Indizierung korrekt aufgelöst wird
    const [stmt] = groundStatements(
      [{ text: "Quelle 2 ist amtlich.", citationRefs: [2] }],
      [DRAFT_CITATION, GROUNDED_CITATION], // citations[1] = GROUNDED
    );
    expect(stmt.confidence).toBe("GROUNDED");
    expect(stmt.citations[0].sourceId).toBe(GROUNDED_CITATION.sourceId);
  });

  it("gibt Text und citationRefs unverändert zurück", () => {
    const text = "Lernziele aus dem Lehrplan.";
    const refs = [1];
    const [stmt] = groundStatements([{ text, citationRefs: refs }], [GROUNDED_CITATION]);
    expect(stmt.text).toBe(text);
    expect(stmt.citationRefs).toEqual(refs);
  });
});
