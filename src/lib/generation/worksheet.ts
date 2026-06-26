/**
 * worksheet.ts — Arbeitsblatt-Generierung mit quellengebundener LLM-Generierung
 *
 * Ablauf (fail-closed): identisch mit planning.ts, Persistenz-Ziel: worksheet + task.
 *
 * Schwierigkeitsgrad-Mapping (Aufgabe):
 *   Foerder    → EASY
 *   Basis      → MEDIUM
 *   Erweiterung → HARD
 *
 * Datenschutz: audit_log.details enthält KEIN PII, keine Schülernamen.
 */

import { createHash } from "crypto";
import { eq, and, or, isNull, asc } from "drizzle-orm";

import type { GenerationDeps } from "./deps";
import { buildGroundedPrompt } from "./prompt";
import { groundStatements, type GroundedStatement } from "./grounding";
import { GenerationBlockedError } from "./planning";
import { retrieve } from "@/lib/rag/retrieve";
import type { RankedCitation } from "@/lib/rag/citation";
import { uiSubjectToDb, uiConfessionToDbContexts } from "@/lib/db/repositories/mapping";
import { curriculumStrand } from "@/lib/db/schema/curriculum";
import {
  teachingUnit,
  worksheet,
  task,
  expectationHorizon,
  worksheetSourceRef,
  taskSourceRef,
} from "@/lib/db/schema/artifacts";
import { generationProvenance } from "@/lib/db/schema/provenance";
import { StructuredParseError } from "@/lib/llm/provider";

// Re-export so callers only need one import for the error type
export { GenerationBlockedError } from "./planning";

// ── Typen ─────────────────────────────────────────────────────────────────────

export type WorksheetDifficulty = "Basis" | "Erweiterung" | "Foerder";

export interface WorksheetInput {
  userId: string;
  schoolId: string;
  subject: string;
  confession?: string;
  schoolForm: string;
  gradeBand: string;
  topic: string;
  difficulties?: WorksheetDifficulty[];
}

export interface WorksheetResult {
  worksheetId: string;
  taskIds: string[];
  statements: GroundedStatement[];
  citations: RankedCitation[];
  crossDenominationWarning?: boolean;
  unavailable?: boolean;
  message?: string;
}

// ── Difficulty-Mapping ────────────────────────────────────────────────────────

type DbDifficulty = "EASY" | "MEDIUM" | "HARD";

const DIFFICULTY_MAP: Record<WorksheetDifficulty, DbDifficulty> = {
  Foerder: "EASY",
  Basis: "MEDIUM",
  Erweiterung: "HARD",
};

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

// ── Konfessions-Label ─────────────────────────────────────────────────────────

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

async function resolveStrand(
  deps: GenerationDeps,
  uiSubject: string,
  schoolForm: string,
): Promise<{ id: string; confessionContext: string } | null> {
  const { subject: dbSubject, confession: dbConfession } = uiSubjectToDb(
    uiSubject as Parameters<typeof uiSubjectToDb>[0],
  );

  const confessionContexts = uiConfessionToDbContexts(
    uiSubject as Parameters<typeof uiConfessionToDbContexts>[0],
  );
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

// ── generateWorksheet ─────────────────────────────────────────────────────────

export async function generateWorksheet(
  deps: GenerationDeps,
  input: WorksheetInput,
): Promise<WorksheetResult> {
  const {
    userId,
    schoolId,
    subject,
    confession,
    schoolForm,
    gradeBand,
    topic,
    difficulties = ["Basis"],
  } = input;

  // ── 1. Validierung ────────────────────────────────────────────────────────
  const isReligion =
    subject === "evangelische-religion" || subject === "katholische-religion";
  if (isReligion && !confession) {
    throw new GenerationBlockedError(
      `Fach "${subject}" erfordert eine Konfessionsangabe (confession). ` +
        "Religion ohne Konfession ist nicht zulässig (Konfessionstrennung, AGENTS.md).",
    );
  }
  if (subject === "ethik" && confession && confession !== "ethik") {
    throw new GenerationBlockedError(
      `Ethik darf nicht mit einer Religionskonfession (${confession}) verknüpft werden. ` +
        "Ethik ist ein eigenes Fach (AGENTS.md §Bindende Grundsätze).",
    );
  }

  // ── 2. Curriculum-Strang auflösen ─────────────────────────────────────────
  const strand = await resolveStrand(deps, subject, schoolForm);
  if (!strand) {
    throw new GenerationBlockedError(
      `Kein Lehrplan-Strang vorhanden für Fach "${subject}", Schulform "${schoolForm}". ` +
        "Ohne aktiven Curriculum-Strang kann kein Arbeitsblatt erstellt werden.",
    );
  }

  const crossDenominationWarning =
    strand.confessionContext === "KONFESSIONSSENSIBEL_UEBERGREIFEND";

  // ── 3. Retrieval (offline-tolerant) ──────────────────────────────────────
  let citations: RankedCitation[] = [];
  let unavailable = false;

  try {
    citations = await retrieve(
      { embedder: deps.embedder, store: deps.store, sourceRefReader: deps.sourceRefReader },
      `${subject} ${topic} ${gradeBand} Aufgaben`,
      {
        subject: subject as import("@/lib/types").Subject,
        minTrust: "USER_APPROVED", // Override 2026-06-26: 0_FGS (USER_APPROVED) im Retrieval freigegeben
        k: 5,
      },
    );
  } catch {
    unavailable = true;
  }

  if (unavailable) {
    return {
      worksheetId: "",
      taskIds: [],
      statements: [],
      citations: [],
      unavailable: true,
      message: "Quellenbibliothek momentan nicht verfügbar",
      crossDenominationWarning: crossDenominationWarning || undefined,
    };
  }

  // ── 4. Prompt + LLM-Call ─────────────────────────────────────────────────
  const prompt = buildGroundedPrompt({
    task: "worksheet",
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
        // Abo-Modell (kostenfrei) → keine Token-Sparsamkeit nötig. Hoch genug,
        // dass das Reasoning-Modell (gpt-oss) die strukturierte Ausgabe nie
        // abschneidet; liegt deutlich unter dem 128k-Kontext (Alex, 2026-06-26).
        maxTokens: 32768,
      },
    );
    rawStatements = parsed.statements;
  } catch (err) {
    if (err instanceof StructuredParseError) {
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

  let worksheetId = "";
  const taskIds: string[] = [];

  await deps.db.transaction(async (tx) => {
    // teaching_unit als Container (wird für FK-Erfüllung benötigt)
    const [unit] = await tx
      .insert(teachingUnit)
      .values({
        title: topic,
        strandId: strand.id,
        gradeBand,
        status: "DRAFT",
        ownerTeacherId: userId,
        dataClass: "INTERNAL",
      })
      .returning({ id: teachingUnit.id });

    if (!unit) throw new Error("teaching_unit INSERT lieferte keine ID zurück");

    // worksheet
    const [ws] = await tx
      .insert(worksheet)
      .values({
        unitId: unit.id,
        title: topic,
        instructions: statements
          .slice(0, 2)
          .map((s) => s.text)
          .join("\n"),
        ownerTeacherId: userId,
        dataClass: "INTERNAL",
      })
      .returning({ id: worksheet.id });

    if (!ws) throw new Error("worksheet INSERT lieferte keine ID zurück");
    worksheetId = ws.id;

    // worksheet_source_ref für alle zitierten Quellen
    for (const sourceId of citedSourceIds) {
      await tx.insert(worksheetSourceRef).values({
        worksheetId,
        sourceRefId: sourceId,
      });
    }

    // tasks — eine Aufgabe je angeforderter Schwierigkeit
    for (const diff of difficulties) {
      const dbDiff: DbDifficulty = DIFFICULTY_MAP[diff];

      // Aufgaben-Prompt: Statement passend zur Schwierigkeit
      const diffIndex: Record<WorksheetDifficulty, number> = {
        Foerder: 0,
        Basis: Math.floor(statements.length / 2),
        Erweiterung: Math.max(0, statements.length - 1),
      };
      const stmtIdx = Math.min(diffIndex[diff], statements.length - 1);
      const baseStatement = statements[stmtIdx];
      const taskPrompt =
        baseStatement !== undefined
          ? baseStatement.text
          : `Aufgabe (${diff}): ${topic}`;

      const [t] = await tx
        .insert(task)
        .values({
          worksheetId,
          prompt: taskPrompt,
          taskType: "SHORT_ANSWER",
          difficulty: dbDiff,
          ownerTeacherId: userId,
          dataClass: "INTERNAL",
        })
        .returning({ id: task.id });

      if (!t) throw new Error(`task INSERT für Schwierigkeit ${diff} lieferte keine ID zurück`);
      taskIds.push(t.id);

      // task_source_ref für zitierte Quellen des zugehörigen Statements
      // dedup: ein Statement kann dieselbe Quelle mehrfach zitieren → sonst
      // doppelte task_source_ref-Zeilen (Gemini-Finding).
      const stmtCitationIds =
        baseStatement !== undefined
          ? [...new Set(baseStatement.citations.map((c) => c.sourceId))]
          : [];

      for (const sourceId of stmtCitationIds) {
        await tx.insert(taskSourceRef).values({
          taskId: t.id,
          sourceRefId: sourceId,
        });
      }

      // expectation_horizon (optional, ein pro Task)
      await tx.insert(expectationHorizon).values({
        taskId: t.id,
        modelSolution:
          baseStatement !== undefined
            ? `Erwartete Antwort: ${baseStatement.text}`
            : null,
        ownerTeacherId: userId,
        dataClass: "INTERNAL",
      });
    }

    // generation_provenance
    await tx.insert(generationProvenance).values({
      artifactType: "WORKSHEET",
      artifactId: worksheetId,
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
    eventType: "generation_worksheet",
    actorId: userId,
    subject,
    severity: "info",
    detail: JSON.stringify({
      worksheetId,
      taskIds,
      gradeBand,
      strandId: strand.id,
      difficulties,
      citedSourceCount: citedSourceIds.length,
      totalStatements: statements.length,
      groundedStatements: groundedCount,
      crossDenominationWarning,
    }),
  });

  // ── 8. Result ─────────────────────────────────────────────────────────────
  const result: WorksheetResult = {
    worksheetId,
    taskIds,
    statements,
    citations,
  };
  if (crossDenominationWarning) result.crossDenominationWarning = true;

  return result;
}
