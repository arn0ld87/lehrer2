/**
 * eval.test.ts — deterministische Vitest-Tests für die RAG-Evaluierungs-Suite
 *
 * Kein DB/Docker/Netzwerk — alle Retrieval-Ergebnisse werden über einen
 * Fake-RetrieveFn deterministisch gesteuert.
 */

import { describe, it, expect } from "vitest";
import { precisionAtK, recallAtK, reciprocalRank } from "../metrics";
import { runEvaluation } from "../run-eval";
import { detectDrift, DEFAULT_DRIFT_THRESHOLD } from "../drift";
import { parseGoldenQuestions } from "../golden-questions";
import type { GoldenQuestion } from "../golden-questions";
import type { RetrievedHit, EvalSummary } from "../run-eval";
import type { MetricBaseline } from "../drift";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FIXED_TIMESTAMP = "2026-06-26T10:00:00.000Z";

/** Baut eine GoldenQuestion-Fixture mit Defaults (kein YAML-Load). */
function makeQuestion(overrides: Partial<GoldenQuestion> & { id: string }): GoldenQuestion {
  return {
    id: overrides.id,
    domain: overrides.domain ?? "DEUTSCH",
    confessionContext: overrides.confessionContext ?? "NICHT_ANWENDBAR",
    competenceArea: overrides.competenceArea ?? "Lesen",
    gradeRange: overrides.gradeRange ?? "5-6",
    query: overrides.query ?? `Frage zu ${overrides.id}`,
    expectedSourceIds: overrides.expectedSourceIds ?? ["src-001"],
    expectedSection: overrides.expectedSection ?? "S. 1",
    rationale: overrides.rationale ?? "Standardtest",
    status: overrides.status ?? "active",
  };
}

// ── precisionAtK ──────────────────────────────────────────────────────────────

describe("precisionAtK", () => {
  it("berechnet P@3 korrekt wenn alle top-3 relevant sind", () => {
    expect(precisionAtK(["a", "b", "c", "d"], ["a", "b", "c"], 3)).toBeCloseTo(1.0);
  });

  it("berechnet P@3 korrekt bei 1 relevantem von 3", () => {
    expect(precisionAtK(["a", "x", "y"], ["a", "b"], 3)).toBeCloseTo(1 / 3);
  });

  it("berechnet P@5 wenn weniger als 5 retrieved → behandelt fehlende als nicht-relevant", () => {
    // 2 retrieved, k=5: 1 relevant → 1/5
    expect(precisionAtK(["a", "x"], ["a", "b"], 5)).toBeCloseTo(1 / 5);
  });

  it("gibt 0 zurück wenn expectedSourceIds leer", () => {
    expect(precisionAtK(["a", "b"], [], 3)).toBe(0);
  });

  it("gibt 0 zurück wenn retrievedSourceIds leer", () => {
    expect(precisionAtK([], ["a"], 3)).toBe(0);
  });

  it("gibt 0 zurück wenn k <= 0", () => {
    expect(precisionAtK(["a"], ["a"], 0)).toBe(0);
    expect(precisionAtK(["a"], ["a"], -1)).toBe(0);
  });

  it("gibt 0 zurück wenn kein Treffer relevant ist", () => {
    expect(precisionAtK(["x", "y", "z"], ["a", "b"], 3)).toBe(0);
  });
});

// ── recallAtK ────────────────────────────────────────────────────────────────

describe("recallAtK", () => {
  it("berechnet R@5 korrekt: 2 von 3 expected in top-5", () => {
    expect(recallAtK(["a", "b", "x", "y", "z"], ["a", "b", "c"], 5)).toBeCloseTo(2 / 3);
  });

  it("berechnet R@10 = 1.0 wenn alle expected in top-10", () => {
    expect(recallAtK(["a", "b", "c"], ["a", "b", "c"], 10)).toBeCloseTo(1.0);
  });

  it("gibt 0 zurück wenn expectedSourceIds leer", () => {
    expect(recallAtK(["a", "b"], [], 5)).toBe(0);
  });

  it("gibt 0 zurück wenn retrievedSourceIds leer", () => {
    expect(recallAtK([], ["a"], 5)).toBe(0);
  });

  it("gibt 0 zurück wenn k <= 0", () => {
    expect(recallAtK(["a"], ["a"], 0)).toBe(0);
  });

  it("berücksichtigt nur die ersten k Einträge", () => {
    // "a" ist an Position 4 (0-basiert), k=3 → nicht erfasst
    expect(recallAtK(["x", "y", "z", "a"], ["a"], 3)).toBe(0);
  });
});

// ── reciprocalRank ────────────────────────────────────────────────────────────

describe("reciprocalRank", () => {
  it("gibt 1/1 = 1 wenn erster Treffer relevant ist", () => {
    expect(reciprocalRank(["a", "b", "c"], ["a"])).toBe(1);
  });

  it("gibt 1/2 wenn zweiter Treffer relevant ist", () => {
    expect(reciprocalRank(["x", "a", "c"], ["a"])).toBeCloseTo(1 / 2);
  });

  it("gibt 1/3 wenn dritter Treffer relevant ist", () => {
    expect(reciprocalRank(["x", "y", "a"], ["a"])).toBeCloseTo(1 / 3);
  });

  it("gibt 0 wenn kein Treffer relevant ist", () => {
    expect(reciprocalRank(["x", "y", "z"], ["a"])).toBe(0);
  });

  it("gibt 0 wenn retrievedSourceIds leer ist", () => {
    expect(reciprocalRank([], ["a"])).toBe(0);
  });

  it("gibt 0 wenn expectedSourceIds leer ist", () => {
    expect(reciprocalRank(["a"], [])).toBe(0);
  });

  it("wählt den ersten relevanten Treffer wenn mehrere relevant sind", () => {
    // "b" ist an Rang 2, "a" an Rang 3 — aber "a" ist einzige expected-Quelle
    expect(reciprocalRank(["x", "b", "a"], ["a"])).toBeCloseTo(1 / 3);
    // "a" und "b" beide expected: erster relevanter Treffer ist "b" bei Rang 2
    expect(reciprocalRank(["x", "b", "a"], ["a", "b"])).toBeCloseTo(1 / 2);
  });
});

// ── runEvaluation ─────────────────────────────────────────────────────────────

describe("runEvaluation", () => {
  // Fake-RetrieveFn: liefert feste Hits je nach Query-Präfix
  async function fakeRetrieve(query: string): Promise<RetrievedHit[]> {
    if (query.startsWith("Deutsch-")) {
      return [{ sourceId: "de-001" }, { sourceId: "de-002" }, { sourceId: "x-001" }];
    }
    if (query.startsWith("Religion-")) {
      return [{ sourceId: "rel-001" }, { sourceId: "x-001" }];
    }
    return [];
  }

  const activeQuestions: GoldenQuestion[] = [
    makeQuestion({
      id: "GQ-DE-001",
      domain: "DEUTSCH",
      query: "Deutsch-Lesen Grundlagen",
      expectedSourceIds: ["de-001", "de-002"],
    }),
    makeQuestion({
      id: "GQ-DE-002",
      domain: "DEUTSCH",
      query: "Deutsch-Schreiben Kompetenz",
      expectedSourceIds: ["de-001"],
    }),
    makeQuestion({
      id: "GQ-REL-001",
      domain: "RELIGION",
      confessionContext: "evangelisch",
      query: "Religion-Evangelisch Ethik",
      expectedSourceIds: ["rel-001"],
    }),
  ];

  const blockedQuestion = makeQuestion({
    id: "GQ-BLOCKED-001",
    status: "blocked-no-registered-source",
    query: "Deutsch-Blockiert",
    expectedSourceIds: ["missing-src"],
  });

  it("berechnet Metriken für alle aktiven Fragen und überspringt blockierte", async () => {
    const { perQuestion, summary } = await runEvaluation({
      retrieve: fakeRetrieve,
      questions: [...activeQuestions, blockedQuestion],
      generatedAt: FIXED_TIMESTAMP,
    });

    expect(summary.total).toBe(4); // 3 aktiv + 1 blockiert
    expect(summary.skippedBlocked).toBe(1);
    expect(perQuestion).toHaveLength(3);
  });

  it("verwendet generatedAt aus Parameter (kein Date.now())", async () => {
    const { summary } = await runEvaluation({
      retrieve: fakeRetrieve,
      questions: activeQuestions,
      generatedAt: FIXED_TIMESTAMP,
    });

    expect(summary.generatedAt).toBe(FIXED_TIMESTAMP);
  });

  it("berechnet byDomain-Aggregation korrekt", async () => {
    const { summary } = await runEvaluation({
      retrieve: fakeRetrieve,
      questions: activeQuestions,
      generatedAt: FIXED_TIMESTAMP,
    });

    expect(summary.byDomain["DEUTSCH"]).toBeDefined();
    expect(summary.byDomain["DEUTSCH"]!.count).toBe(2);
    expect(summary.byDomain["RELIGION"]).toBeDefined();
    expect(summary.byDomain["RELIGION"]!.count).toBe(1);
  });

  it("berechnet P@5 für GQ-DE-001 korrekt: beide expected in top-3 von 5", async () => {
    const { perQuestion } = await runEvaluation({
      retrieve: fakeRetrieve,
      questions: [activeQuestions[0]!],
      generatedAt: FIXED_TIMESTAMP,
    });

    // retrieved: ["de-001", "de-002", "x-001"], expected: ["de-001", "de-002"]
    // P@5 = 2/5 = 0.4
    expect(perQuestion[0]!.precisionAt5).toBeCloseTo(2 / 5);
    // R@10 = 2/2 = 1.0
    expect(perQuestion[0]!.recallAt10).toBeCloseTo(1.0);
    // RR = 1/1 = 1.0 (de-001 an Rang 1)
    expect(perQuestion[0]!.reciprocalRank).toBeCloseTo(1.0);
  });

  it("gibt leere perQuestion und 0-Metriken zurück wenn alle Fragen blockiert sind", async () => {
    const { perQuestion, summary } = await runEvaluation({
      retrieve: fakeRetrieve,
      questions: [blockedQuestion],
      generatedAt: FIXED_TIMESTAMP,
    });

    expect(perQuestion).toHaveLength(0);
    expect(summary.skippedBlocked).toBe(1);
    expect(summary.meanPrecisionAt5).toBe(0);
    expect(summary.meanRecallAt10).toBe(0);
    expect(summary.meanReciprocalRank).toBe(0);
    expect(summary.byDomain).toEqual({});
  });

  it("übergibt ID und confessionContext korrekt in perQuestion", async () => {
    const { perQuestion } = await runEvaluation({
      retrieve: fakeRetrieve,
      questions: [activeQuestions[2]!], // GQ-REL-001
      generatedAt: FIXED_TIMESTAMP,
    });

    expect(perQuestion[0]!.id).toBe("GQ-REL-001");
    expect(perQuestion[0]!.confessionContext).toBe("evangelisch");
  });
});

// ── detectDrift ───────────────────────────────────────────────────────────────

describe("detectDrift", () => {
  function makeSummary(overrides: Partial<EvalSummary> = {}): EvalSummary {
    return {
      generatedAt: FIXED_TIMESTAMP,
      total: 3,
      skippedBlocked: 0,
      meanPrecisionAt5: overrides.meanPrecisionAt5 ?? 0.8,
      meanRecallAt10: overrides.meanRecallAt10 ?? 0.75,
      meanReciprocalRank: overrides.meanReciprocalRank ?? 0.9,
      byDomain: {},
    };
  }

  function makeBaseline(overrides: Partial<MetricBaseline> = {}): MetricBaseline {
    return {
      generatedAt: "2026-06-01T00:00:00.000Z",
      meanPrecisionAt5: overrides.meanPrecisionAt5 ?? 0.8,
      meanRecallAt10: overrides.meanRecallAt10 ?? 0.75,
      meanReciprocalRank: overrides.meanReciprocalRank ?? 0.9,
    };
  }

  it("gibt hasDrift=false und leere regressions zurück wenn baseline null", () => {
    const result = detectDrift(makeSummary(), null);
    expect(result.hasDrift).toBe(false);
    expect(result.regressions).toHaveLength(0);
  });

  it("gibt hasDrift=false zurück wenn alle Metriken innerhalb des Thresholds liegen", () => {
    // current == baseline → kein Drift
    const result = detectDrift(makeSummary(), makeBaseline());
    expect(result.hasDrift).toBe(false);
    expect(result.regressions).toHaveLength(0);
  });

  it("gibt hasDrift=false zurück wenn Regression exakt dem Threshold entspricht (nicht >)", () => {
    // Regression genau DEFAULT_DRIFT_THRESHOLD (0.05): kein Drift, da > nicht >=
    const current = makeSummary({ meanPrecisionAt5: 0.8 - DEFAULT_DRIFT_THRESHOLD });
    const result = detectDrift(current, makeBaseline({ meanPrecisionAt5: 0.8 }));
    expect(result.hasDrift).toBe(false);
  });

  it("erkennt Regression bei P@5 (delta > threshold)", () => {
    const current = makeSummary({ meanPrecisionAt5: 0.8 - 0.06 }); // 0.74, delta=-0.06
    const result = detectDrift(current, makeBaseline({ meanPrecisionAt5: 0.8 }));

    expect(result.hasDrift).toBe(true);
    expect(result.regressions).toHaveLength(1);
    expect(result.regressions[0]!.metric).toBe("meanPrecisionAt5");
    expect(result.regressions[0]!.baseline).toBeCloseTo(0.8);
    expect(result.regressions[0]!.current).toBeCloseTo(0.74);
    expect(result.regressions[0]!.delta).toBeCloseTo(-0.06);
  });

  it("erkennt mehrere Regressionen gleichzeitig", () => {
    const current = makeSummary({
      meanPrecisionAt5: 0.7, // Regression: 0.8 - 0.7 = 0.1 > 0.05
      meanRecallAt10: 0.6,   // Regression: 0.75 - 0.6 = 0.15 > 0.05
      meanReciprocalRank: 0.9, // kein Drift
    });
    const result = detectDrift(current, makeBaseline());

    expect(result.hasDrift).toBe(true);
    expect(result.regressions).toHaveLength(2);
    const metrics = result.regressions.map((r) => r.metric);
    expect(metrics).toContain("meanPrecisionAt5");
    expect(metrics).toContain("meanRecallAt10");
    expect(metrics).not.toContain("meanReciprocalRank");
  });

  it("erkennt keine Regression bei Verbesserung (current > baseline)", () => {
    const current = makeSummary({ meanPrecisionAt5: 0.95 }); // Verbesserung
    const result = detectDrift(current, makeBaseline({ meanPrecisionAt5: 0.8 }));
    expect(result.hasDrift).toBe(false);
  });

  it("respektiert benutzerdefinierten Threshold", () => {
    // Mit threshold=0.15: Regression von 0.1 gilt nicht mehr als Drift
    const current = makeSummary({ meanPrecisionAt5: 0.7 }); // delta = -0.1
    const strictResult = detectDrift(current, makeBaseline(), 0.05);
    expect(strictResult.hasDrift).toBe(true);

    const lenientResult = detectDrift(current, makeBaseline(), 0.15);
    expect(lenientResult.hasDrift).toBe(false);
  });
});

// ── parseGoldenQuestions ──────────────────────────────────────────────────────

describe("parseGoldenQuestions", () => {
  const validRaw = {
    golden_questions: [
      {
        id: "GQ-DE-001",
        domain: "DEUTSCH",
        confession_context: "NICHT_ANWENDBAR",
        competence_area: "Lesen",
        grade_range: "5-6",
        query: "Was sind die Lernziele im Bereich Lesen?",
        expected_source_ids: ["lp-de-001"],
        expected_section: "S. 12",
        rationale: "Grundlegende Lesekompetenz",
        status: "active",
      },
    ],
  };

  it("parst ein valides Objekt erfolgreich", () => {
    const result = parseGoldenQuestions(validRaw);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("GQ-DE-001");
    expect(result[0]!.confessionContext).toBe("NICHT_ANWENDBAR");
    expect(result[0]!.competenceArea).toBe("Lesen");
    expect(result[0]!.gradeRange).toBe("5-6");
    expect(result[0]!.expectedSourceIds).toEqual(["lp-de-001"]);
    expect(result[0]!.status).toBe("active");
  });

  it("mappt snake_case korrekt auf camelCase", () => {
    const result = parseGoldenQuestions(validRaw);
    expect(result[0]).toHaveProperty("confessionContext");
    expect(result[0]).toHaveProperty("competenceArea");
    expect(result[0]).toHaveProperty("gradeRange");
    expect(result[0]).toHaveProperty("expectedSourceIds");
    expect(result[0]).toHaveProperty("expectedSection");
    // snake_case-Felder dürfen nicht durchdringen
    expect(result[0]).not.toHaveProperty("confession_context");
    expect(result[0]).not.toHaveProperty("competence_area");
  });

  it("akzeptiert status blocked-no-registered-source", () => {
    const raw = {
      golden_questions: [
        { ...validRaw.golden_questions[0], id: "GQ-BLOCKED", status: "blocked-no-registered-source" },
      ],
    };
    const result = parseGoldenQuestions(raw);
    expect(result[0]!.status).toBe("blocked-no-registered-source");
  });

  it("akzeptiert alle erlaubten confessionContext-Werte", () => {
    const contexts = ["NICHT_ANWENDBAR", "evangelisch", "katholisch", "uebergreifend"] as const;
    for (const ctx of contexts) {
      const raw = {
        golden_questions: [
          { ...validRaw.golden_questions[0], id: `GQ-${ctx}`, confession_context: ctx },
        ],
      };
      expect(() => parseGoldenQuestions(raw)).not.toThrow();
    }
  });

  it("wirft bei fehlendem Pflichtfeld (id)", () => {
    const raw = {
      golden_questions: [{ ...validRaw.golden_questions[0], id: "" }],
    };
    expect(() => parseGoldenQuestions(raw)).toThrow(/id/);
  });

  it("wirft bei ungültigem domain-Wert", () => {
    const raw = {
      golden_questions: [{ ...validRaw.golden_questions[0], domain: "MATHE" }],
    };
    expect(() => parseGoldenQuestions(raw)).toThrow(/domain/);
  });

  it("wirft bei ungültigem confessionContext-Wert", () => {
    const raw = {
      golden_questions: [
        { ...validRaw.golden_questions[0], confession_context: "EVANGELISCH" }, // Großschreibung nicht erlaubt
      ],
    };
    expect(() => parseGoldenQuestions(raw)).toThrow(/confession_context/);
  });

  it("wirft wenn expected_source_ids kein Array ist", () => {
    const raw = {
      golden_questions: [{ ...validRaw.golden_questions[0], expected_source_ids: "lp-001" }],
    };
    expect(() => parseGoldenQuestions(raw)).toThrow(/expected_source_ids/);
  });

  it("wirft wenn golden_questions fehlt", () => {
    expect(() => parseGoldenQuestions({ other_key: [] })).toThrow(/golden_questions/);
  });

  it("wirft wenn raw kein Objekt ist", () => {
    expect(() => parseGoldenQuestions("kein objekt")).toThrow();
    expect(() => parseGoldenQuestions(null)).toThrow();
  });
});
