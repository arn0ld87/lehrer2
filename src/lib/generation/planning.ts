/**
 * planning.ts — Unterrichtsplanung mit quellengebundener LLM-Generierung
 *
 * Ablauf (fail-closed):
 *   1. Validierung: Religion erfordert confession; Ethik ≠ Religion-Konfession.
 *   2. Curriculum-Strang auflösen (nur ACTIVE). Fehlt er → GenerationBlockedError.
 *   3. Retrieval via retrieve() — offline-tolerant (R-offline: unavailable:true).
 *   4. Prompt bauen + callStructured — StructuredParseError → zero statements.
 *   5. groundStatements().
 *   6. DB-Transaktion: teaching_unit + lesson + generation_provenance.
 *   7. audit_log schreiben.
 *   8. Result zurückgeben.
 *
 * Datenschutz: audit_log.details enthält KEIN PII, keine Schülernamen.
 */

import { createHash } from "crypto";
import { eq, and, or, isNull, asc } from "drizzle-orm";

import type { GenerationDeps } from "./deps";
import { buildGroundedPrompt } from "./prompt";
import { groundStatements, type GroundedStatement } from "./grounding";
import { retrieve } from "@/lib/rag/retrieve";
import type { RankedCitation } from "@/lib/rag/citation";
import { uiSubjectToDb, uiConfessionToDbContexts } from "@/lib/db/repositories/mapping";
import { curriculumStrand } from "@/lib/db/schema/curriculum";
import { teachingUnit, lesson } from "@/lib/db/schema/artifacts";
import { generationProvenance } from "@/lib/db/schema/provenance";
import { StructuredParseError } from "@/lib/llm/provider";

// ── Error ─────────────────────────────────────────────────────────────────────

export class GenerationBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationBlockedError";
  }
}

// ── Typen ─────────────────────────────────────────────────────────────────────

export interface PlanningInput {
  userId: string;
  schoolId: string;
  /** UI-Fach-Wert (z. B. "deutsch", "evangelische-religion") */
  subject: string;
  /** UI-Konfession (Pflicht wenn subject Religion ist) */
  confession?: string;
  schoolForm: string;
  gradeBand: string;
  topic: string;
}

export interface PlanningResult {
  teachingUnitId: string;
  lessonId: string;
  statements: GroundedStatement[];
  citations: RankedCitation[];
  crossDenominationWarning?: boolean;
  /** true wenn Retrieval offline war — Ergebnis ist Entwurf ohne Quellenbindung */
  unavailable?: boolean;
  message?: string;
}

// ── Internes Schema für callStructured ───────────────────────────────────────

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

type LLMStatements = { statements: { text: string; citationRefs: number[] }[] };

// ── Phasen-Konvention für lesson.phasePlan ───────────────────────────────────

type Phase = "Einstieg" | "Erarbeitung" | "Sicherung" | "Hausaufgabe";

interface PhasedStatement {
  phase: Phase;
  text: string;
  citationRefs: number[];
  confidence: string;
}

/**
 * Verteilt GroundedStatements auf die vier Standard-Phasen.
 * Konvention: Statements werden der Reihe nach zugeordnet —
 * erstes Viertel Einstieg, zweites Erarbeitung, drittes Sicherung, Rest Hausaufgabe.
 * Bei weniger als vier Statements werden leere Phasen as [] dargestellt.
 */
function groupIntoPhases(statements: GroundedStatement[]): Record<Phase, PhasedStatement[]> {
  const phases: Phase[] = ["Einstieg", "Erarbeitung", "Sicherung", "Hausaufgabe"];
  const total = statements.length;
  const result: Record<Phase, PhasedStatement[]> = {
    Einstieg: [],
    Erarbeitung: [],
    Sicherung: [],
    Hausaufgabe: [],
  };

  if (total === 0) return result;

  statements.forEach((stmt, idx) => {
    // Vierteilung; letztes Segment fängt Rest auf
    const phaseIdx = Math.min(Math.floor((idx / total) * 4), 3);
    const phase = phases[phaseIdx]!;
    result[phase].push({
      phase,
      text: stmt.text,
      citationRefs: stmt.citationRefs,
      confidence: stmt.confidence,
    });
  });

  return result;
}

// ── Religion-Konfession-Label ─────────────────────────────────────────────────

/**
 * Gibt ein lesbares Konfessions-Label zurück, das im Prompt erscheint.
 * Kein Cross-Strang: Ethik erhält niemals ein Religion-Label.
 */
function confessionLabel(uiSubject: string, uiConfession?: string): string | undefined {
  if (uiSubject === "evangelische-religion" || uiConfession === "evangelische-religion") {
    return "evangelisch";
  }
  if (uiSubject === "katholische-religion" || uiConfession === "katholische-religion") {
    return "katholisch";
  }
  return undefined;
}

// ── Strand-Auflösung ──────────────────────────────────────────────────────────

/**
 * Ermittelt den aktiven Curriculum-Strang passend zu Subject + Confession + SchoolForm.
 *
 * Matching-Logik:
 *   subject:           aus uiSubjectToDb (DEUTSCH/RELIGION/ETHIK)
 *   confessionContext: aus uiConfessionToDbContexts — nimmt den ERSTEN Kontext
 *                      (z. B. EVANGELISCH für evangelische-religion). Für den
 *                      übergreifenden Kontext wird ein zweiter Lookup benötigt;
 *                      hier nehmen wir pragmatisch den primären Kontext.
 *   schoolForm:        optional — wenn vorhanden, als schoolForm-Filter.
 *   status:            ACTIVE (DRAFT/RETIRED sind ungültig).
 *
 * Gibt null zurück wenn kein Treffer.
 */
async function resolveStrand(
  deps: GenerationDeps,
  uiSubject: string,
  schoolForm: string,
): Promise<{ id: string; confessionContext: string } | null> {
  const { subject: dbSubject, confession: dbConfession } = uiSubjectToDb(
    uiSubject as Parameters<typeof uiSubjectToDb>[0],
  );

  // Konfessions-Contexts aus Mapping (fail-closed: uiConfessionToDbContexts)
  const confessionContexts = uiConfessionToDbContexts(
    uiSubject as Parameters<typeof uiConfessionToDbContexts>[0],
  );
  // Primärer Kontext: erster Eintrag (z. B. EVANGELISCH), Fallback dbConfession
  const primaryContext = confessionContexts[0] ?? dbConfession;

  // schoolForm deterministisch filtern: passende Schulform ODER form-agnostischer
  // (NULL) Strang. NULL = gilt für alle Schulformen (SEK_I-CHECK erlaubt das).
  const formUpper = schoolForm.trim().toUpperCase();
  const dbForm =
    formUpper === "GESAMTSCHULE" || formUpper === "GEMEINSCHAFTSSCHULE"
      ? (formUpper as "GESAMTSCHULE" | "GEMEINSCHAFTSSCHULE")
      : null;
  const formCondition = dbForm
    ? or(eq(curriculumStrand.schoolForm, dbForm), isNull(curriculumStrand.schoolForm))
    : undefined;

  const rows = await deps.db
    .select({
      id: curriculumStrand.id,
      confessionContext: curriculumStrand.confessionContext,
    })
    .from(curriculumStrand)
    .where(
      and(
        eq(curriculumStrand.subject, dbSubject),
        eq(curriculumStrand.confessionContext, primaryContext),
        eq(curriculumStrand.status, "ACTIVE"),
        ...(formCondition ? [formCondition] : []),
      ),
    )
    // Determinismus: spezifische Schulform vor NULL (NULLS LAST), dann id.
    .orderBy(asc(curriculumStrand.schoolForm), asc(curriculumStrand.id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return { id: row.id, confessionContext: row.confessionContext };
}

// ── generatePlanning ──────────────────────────────────────────────────────────

export async function generatePlanning(
  deps: GenerationDeps,
  input: PlanningInput,
): Promise<PlanningResult> {
  const { userId, schoolId, subject, confession, schoolForm, gradeBand, topic } = input;

  // ── 1. Validierung ────────────────────────────────────────────────────────
  const isReligion =
    subject === "evangelische-religion" || subject === "katholische-religion";
  if (isReligion && !confession) {
    throw new GenerationBlockedError(
      `Fach "${subject}" erfordert eine Konfessionsangabe (confession). ` +
        "Religion ohne Konfession ist nicht zulässig (Konfessionstrennung, AGENTS.md).",
    );
  }
  // Ethik darf nie Religion-Konfessions-Kontext erhalten
  if (subject === "ethik" && confession && confession !== "ethik") {
    throw new GenerationBlockedError(
      `Ethik darf nicht mit einer Religionskonfession (${confession}) verknüpft werden. ` +
        "Ethik ist ein eigenes Fach (AGENTS.md §Bindende Grundsätze).",
    );
  }

  // ── 2. Curriculum-Strang auflösen ─────────────────────────────────────────
  const effectiveSubject = isReligion ? subject : subject;
  const strand = await resolveStrand(deps, effectiveSubject, schoolForm);
  if (!strand) {
    throw new GenerationBlockedError(
      `Kein Lehrplan-Strang vorhanden für Fach "${subject}", Schulform "${schoolForm}". ` +
        "Ohne aktiven Curriculum-Strang kann kein Unterrichtsplan erstellt werden.",
    );
  }

  // Übergreifend-Warnung: KONFESSIONSSENSIBEL_UEBERGREIFEND-Strang
  const crossDenominationWarning =
    strand.confessionContext === "KONFESSIONSSENSIBEL_UEBERGREIFEND";

  // ── 3. Retrieval (offline-tolerant) ──────────────────────────────────────
  let citations: RankedCitation[] = [];
  let unavailable = false;

  try {
    citations = await retrieve(
      { embedder: deps.embedder, store: deps.store, sourceRefReader: deps.sourceRefReader },
      `${subject} ${topic} ${gradeBand}`,
      {
        subject: subject as import("@/lib/types").Subject,
        minTrust: "OFFICIAL_GUIDANCE",
        k: 5,
      },
    );
  } catch {
    unavailable = true;
  }

  if (unavailable) {
    return {
      teachingUnitId: "",
      lessonId: "",
      statements: [],
      citations: [],
      unavailable: true,
      message: "Quellenbibliothek momentan nicht verfügbar",
      crossDenominationWarning: crossDenominationWarning || undefined,
    };
  }

  // ── 4. Prompt + LLM-Call ─────────────────────────────────────────────────
  const prompt = buildGroundedPrompt({
    task: "planning",
    subject,
    gradeBand,
    topic,
    confessionLabel: confessionLabel(subject, confession),
    citations,
  });

  const promptHash = createHash("sha256").update(prompt).digest("hex");

  let rawStatements: { text: string; citationRefs: number[] }[] = [];

  try {
    const parsed = await deps.provider.callStructured<LLMStatements>(
      prompt,
      STATEMENTS_SCHEMA,
      {
        schoolId,
        userId,
        destinationProvider: "ollama",
        subject,
        gradeBand,
      },
    );
    rawStatements = parsed.statements;
  } catch (err) {
    if (err instanceof StructuredParseError) {
      // Fail-closed: parse-Fehler → keine Statements, keine Fabrication
      rawStatements = [];
    } else {
      throw err;
    }
  }

  // ── 5. Grounding ──────────────────────────────────────────────────────────
  const statements = groundStatements(rawStatements, citations);

  // ── 6. DB-Transaktion ─────────────────────────────────────────────────────
  const groundedCount = statements.filter((s) => s.confidence === "GROUNDED").length;
  const confidenceState = {
    total: statements.length,
    grounded: groundedCount,
    unsupportedDraft: statements.length - groundedCount,
  };

  const citedSourceIds = [
    ...new Set(
      statements.flatMap((s) => s.citations.map((c) => c.sourceId)),
    ),
  ];

  let teachingUnitId = "";
  let lessonId = "";

  await deps.db.transaction(async (tx) => {
    // teaching_unit
    const [unit] = await tx
      .insert(teachingUnit)
      .values({
        title: topic,
        strandId: strand.id,
        gradeBand,
        goals: statements
          .slice(0, 3)
          .map((s) => s.text)
          .join("\n"),
        status: "DRAFT",
        ownerTeacherId: userId,
        dataClass: "INTERNAL",
      })
      .returning({ id: teachingUnit.id });

    if (!unit) throw new Error("teaching_unit INSERT lieferte keine ID zurück");
    teachingUnitId = unit.id;

    // lesson mit phasePlan als JSONB
    const phasePlan = groupIntoPhases(statements);

    const [les] = await tx
      .insert(lesson)
      .values({
        unitId: teachingUnitId,
        objectives: statements
          .filter((s) => s.confidence === "GROUNDED")
          .slice(0, 5)
          .map((s) => s.text)
          .join("\n"),
        phasePlan,
        ownerTeacherId: userId,
        dataClass: "INTERNAL",
      })
      .returning({ id: lesson.id });

    if (!les) throw new Error("lesson INSERT lieferte keine ID zurück");
    lessonId = les.id;

    // generation_provenance
    await tx.insert(generationProvenance).values({
      artifactType: "LESSON",
      artifactId: lessonId,
      provider: "ollama",
      model: process.env.OLLAMA_MODEL ?? "unknown",
      promptHash,
      redactionApplied: false,
      sourceRefs: citedSourceIds,
      confidenceState,
      ownerTeacherId: userId,
      dataClass: "INTERNAL",
    });
  });

  // ── 7. Audit-Log ──────────────────────────────────────────────────────────
  await deps.audit.record({
    eventType: "generation_planning",
    actorId: userId,
    subject,
    severity: "info",
    detail: JSON.stringify({
      teachingUnitId,
      lessonId,
      gradeBand,
      strandId: strand.id,
      citedSourceCount: citedSourceIds.length,
      totalStatements: statements.length,
      groundedStatements: groundedCount,
      crossDenominationWarning,
    }),
  });

  // ── 8. Result ─────────────────────────────────────────────────────────────
  const result: PlanningResult = {
    teachingUnitId,
    lessonId,
    statements,
    citations,
  };
  if (crossDenominationWarning) result.crossDenominationWarning = true;

  return result;
}
