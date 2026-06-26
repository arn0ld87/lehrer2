/**
 * correction.ts — Korrekturassistenz mit quellengebundener LLM-Generierung
 *
 * Datenschutz-Kern (fail-closed, SENSITIVE_STUDENT):
 *   1. redact(studentWork) — Klarnamen/PII lokal maskieren, BEVOR Text in den Prompt geht.
 *   2. Curriculum-Strang auflösen (Bewertungskontext) + Retrieval (offline-tolerant).
 *   3. Korrektur-Prompt mit REDACTED-Text → deps.provider.callStructured (der Provider ist
 *      via withGate gegatet: erneute Redaction + Guard-Assertion bricht ab, falls PII durchrutscht).
 *   4. Mapping auf FeedbackStatement[] + RubricScore[] (Vorschlag, KEINE Note).
 *   5. Persistenz: minimaler Artefakt-Container (FK) → studentSubmission (Pseudonym!) →
 *      correctionDraft (status=DRAFT). Rubric-Bewertung lebt in provenance (kein Schemafeld).
 *
 * Klarnamen verlassen das System nie; gespeichert werden nur Pseudonym + Feedback, nicht der
 * Schülertext im Klartext (Datensparsamkeit). Die Lehrkraft entscheidet final.
 */

import { createHash, randomUUID } from "crypto";
import { and, asc, eq, isNull, or } from "drizzle-orm";

import type { GenerationDeps } from "./deps";
import { GenerationBlockedError } from "./planning";
import { retrieve } from "@/lib/rag/retrieve";
import type { RankedCitation } from "@/lib/rag/citation";
import { uiConfessionToDbContexts, uiSubjectToDb } from "@/lib/db/repositories/mapping";
import { curriculumStrand } from "@/lib/db/schema/curriculum";
import { task, teachingUnit, worksheet } from "@/lib/db/schema/artifacts";
import { correctionDraft, studentSubmission } from "@/lib/db/schema/corrections";
import { generationProvenance } from "@/lib/db/schema/provenance";
import { StructuredParseError } from "@/lib/llm/provider";
import { redact } from "@/lib/llm/redaction";
import type { CorrectionProvenance } from "@/lib/db/repositories/correction.pg";
import type {
  ConfidenceLevel,
  EvidenceType,
  FeedbackHistoryEntry,
  FeedbackStatement,
  RubricScore,
} from "@/lib/types";

export { GenerationBlockedError } from "./planning";

// ── Typen ─────────────────────────────────────────────────────────────────────

export interface CorrectionInput {
  userId: string;
  schoolId: string;
  subject: string;
  confession?: string;
  schoolForm: string;
  gradeBand: string;
  /** Aufgabenstellung/Kontext der Schülerarbeit. */
  topic: string;
  /** Schülertext — kann PII enthalten und wird vor jedem LLM-Call redacted. */
  studentWork: string;
  /** Pseudonym; wird erzeugt, wenn nicht vorgegeben (nie ein Klarname). */
  pseudonymId?: string;
}

export interface CorrectionResult {
  correctionDraftId: string;
  submissionId: string;
  statements: FeedbackStatement[];
  rubricScores: RubricScore[];
  citations: RankedCitation[];
  crossDenominationWarning?: boolean;
  unavailable?: boolean;
  message?: string;
}

// ── LLM-Schema (Vorschlag, keine Note) ───────────────────────────────────────

const CORRECTION_SCHEMA = {
  type: "object",
  properties: {
    rubricScores: {
      type: "array",
      items: {
        type: "object",
        properties: {
          criterion: { type: "string" },
          achieved: { type: "number" },
          max: { type: "number" },
          note: { type: "string" },
          confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
          confidenceReason: { type: "string" },
        },
        required: ["criterion", "achieved", "max", "note", "confidence", "confidenceReason"],
      },
    },
    feedback: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          evidenceRef: { type: "string" },
          evidenceType: { type: "string", enum: ["STUDENT_TEXT", "CURRICULUM", "OTHER"] },
          confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
          confidenceReason: { type: "string" },
        },
        required: ["text", "evidenceRef", "evidenceType", "confidence", "confidenceReason"],
      },
    },
  },
  required: ["rubricScores", "feedback"],
} as const;

type LLMCorrection = {
  rubricScores: {
    criterion: string;
    achieved: number;
    max: number;
    note: string;
    confidence: ConfidenceLevel;
    confidenceReason: string;
  }[];
  feedback: {
    text: string;
    evidenceRef: string;
    evidenceType: EvidenceType;
    confidence: ConfidenceLevel;
    confidenceReason: string;
  }[];
};

// ── Strand-Auflösung (analog planning/worksheet) ─────────────────────────────

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

  const formUpper = schoolForm.trim().toUpperCase();
  const dbForm =
    formUpper === "GESAMTSCHULE" || formUpper === "GEMEINSCHAFTSSCHULE"
      ? (formUpper as "GESAMTSCHULE" | "GEMEINSCHAFTSSCHULE")
      : null;
  const formCondition = dbForm
    ? or(eq(curriculumStrand.schoolForm, dbForm), isNull(curriculumStrand.schoolForm))
    : undefined;

  const rows = await deps.db
    .select({ id: curriculumStrand.id, confessionContext: curriculumStrand.confessionContext })
    .from(curriculumStrand)
    .where(
      and(
        eq(curriculumStrand.subject, dbSubject),
        eq(curriculumStrand.confessionContext, primaryContext),
        eq(curriculumStrand.status, "ACTIVE"),
        ...(formCondition ? [formCondition] : []),
      ),
    )
    .orderBy(asc(curriculumStrand.schoolForm), asc(curriculumStrand.id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return { id: row.id, confessionContext: row.confessionContext };
}

// ── Korrektur-Prompt ──────────────────────────────────────────────────────────

function buildCorrectionPrompt(args: {
  subject: string;
  gradeBand: string;
  topic: string;
  redactedWork: string;
  citations: RankedCitation[];
}): string {
  const { subject, gradeBand, topic, redactedWork, citations } = args;
  const sources = citations.length
    ? citations
        .map((c, i) => `[${i + 1}] ${c.title}${c.pageOrSection ? `, ${c.pageOrSection}` : ""}`)
        .join("\n")
    : "(keine Lehrplan-Quellen verfügbar — Feedback stützt sich auf den Schülertext)";

  return [
    "Du bist eine Korrekturassistenz für Lehrkräfte. Du erstellst einen ÜBERPRÜFBAREN VORSCHLAG,",
    "KEINE verbindliche Note. Die Lehrkraft entscheidet final. Belege jede Aussage und mache",
    "Unsicherheiten explizit (confidence + Begründung). Erfinde nichts.",
    "",
    `Fach: ${subject} · Klasse: ${gradeBand} · Aufgabe: ${topic}`,
    "",
    "Lehrplan-/Bewertungskontext:",
    sources,
    "",
    "Schülerarbeit (pseudonymisiert, PII bereits maskiert):",
    '"""',
    redactedWork,
    '"""',
    "",
    "Gib AUSSCHLIESSLICH JSON in genau diesem Format zurück (keine Erklärung außerhalb des JSON):",
    "{",
    '  "rubricScores": [ { "criterion": string, "achieved": number, "max": number, "note": string, "confidence": "HIGH"|"MEDIUM"|"LOW", "confidenceReason": string } ],',
    '  "feedback": [ { "text": string, "evidenceRef": string, "evidenceType": "STUDENT_TEXT"|"CURRICULUM"|"OTHER", "confidence": "HIGH"|"MEDIUM"|"LOW", "confidenceReason": string } ]',
    "}",
    "evidenceRef verweist auf eine Stelle im Schülertext (z. B. \"Absatz 2\") oder eine Quelle [n].",
  ].join("\n");
}

// ── Mapping LLM → UI-Typen ───────────────────────────────────────────────────

function toRubricScores(raw: LLMCorrection["rubricScores"]): RubricScore[] {
  return raw.map((r) => ({
    id: randomUUID(),
    criterion: r.criterion,
    achieved: r.achieved,
    max: r.max,
    note: r.note,
    confidence: { level: r.confidence, reasoning: r.confidenceReason },
  }));
}

function toFeedbackStatements(raw: LLMCorrection["feedback"]): FeedbackStatement[] {
  return raw.map((f) => ({
    id: randomUUID(),
    text: f.text,
    evidence: [{ type: f.evidenceType, reference: f.evidenceRef }],
    confidence: { level: f.confidence, reasoning: f.confidenceReason },
    status: "AI_GENERATED" as const,
  }));
}

// ── generateCorrection ────────────────────────────────────────────────────────

export async function generateCorrection(
  deps: GenerationDeps,
  input: CorrectionInput,
): Promise<CorrectionResult> {
  const { userId, schoolId, subject, confession, schoolForm, gradeBand, topic, studentWork } =
    input;

  // ── 1. Validierung ────────────────────────────────────────────────────────
  if (!studentWork.trim()) {
    throw new GenerationBlockedError("Leere Schülerarbeit — nichts zu korrigieren.");
  }
  const isReligion =
    subject === "evangelische-religion" || subject === "katholische-religion";
  if (isReligion && !confession) {
    throw new GenerationBlockedError(
      `Fach "${subject}" erfordert eine Konfessionsangabe (Konfessionstrennung, AGENTS.md).`,
    );
  }

  // ── 2. Lokale Redaction VOR jedem LLM-Kontakt ─────────────────────────────
  const { redactedText } = redact(studentWork);
  const pseudonymId = input.pseudonymId ?? `SCHUELER_${randomUUID().slice(0, 8).toUpperCase()}`;

  // ── 3. Curriculum-Strang (Bewertungskontext) ──────────────────────────────
  const strand = await resolveStrand(deps, subject, schoolForm);
  if (!strand) {
    throw new GenerationBlockedError(
      `Kein Lehrplan-Strang für Fach "${subject}", Schulform "${schoolForm}". ` +
        "Ohne aktiven Curriculum-Strang kann keine curriculare Korrektur erstellt werden.",
    );
  }
  const crossDenominationWarning =
    strand.confessionContext === "KONFESSIONSSENSIBEL_UEBERGREIFEND";

  // ── 4. Retrieval (offline-tolerant; Korrektur stützt sich primär auf den Text) ──
  let citations: RankedCitation[] = [];
  try {
    citations = await retrieve(
      { embedder: deps.embedder, store: deps.store, sourceRefReader: deps.sourceRefReader },
      `${subject} ${topic} Bewertungskriterien Erwartungshorizont ${gradeBand}`,
      { subject: subject as import("@/lib/types").Subject, minTrust: "USER_APPROVED", k: 5 },
    );
  } catch {
    citations = [];
  }

  // ── 5. Prompt + LLM-Call (Provider ist gegatet: Redaction + fail-closed Guard) ──
  const prompt = buildCorrectionPrompt({ subject, gradeBand, topic, redactedWork: redactedText, citations });
  const promptHash = createHash("sha256").update(prompt).digest("hex");

  let parsed: LLMCorrection = { rubricScores: [], feedback: [] };
  try {
    parsed = await deps.provider.callStructured<LLMCorrection>(prompt, CORRECTION_SCHEMA, {
      schoolId,
      userId,
      destinationProvider: "ollama",
      subject,
      gradeBand,
      maxTokens: 32768,
    });
  } catch (err) {
    if (err instanceof StructuredParseError) {
      parsed = { rubricScores: [], feedback: [] };
    } else {
      throw err;
    }
  }

  const rubricScores = toRubricScores(parsed.rubricScores ?? []);
  const statements = toFeedbackStatements(parsed.feedback ?? []);

  // ── 6. Provider-Metadaten (ehrliche Provenance) ───────────────────────────
  const cloudEnabled = process.env.CLOUD_LLM_ENABLED === "true";
  const providerName = cloudEnabled ? "cloud" : "ollama";
  const modelName = cloudEnabled
    ? process.env.OPENAI_MODEL ?? process.env.CHAT_MODEL ?? "unknown"
    : process.env.OLLAMA_MODEL ?? "unknown";
  const generatedAt = new Date().toISOString();
  const citedSourceIds = [...new Set(citations.map((c) => c.sourceId).filter(Boolean))];

  const provenance: CorrectionProvenance = {
    provider: providerName,
    model: modelName,
    promptHash,
    redactionApplied: true,
    rubricScores,
    generatedAt,
    citedSourceIds,
  };
  const historyEntry: FeedbackHistoryEntry = {
    timestamp: generatedAt,
    actor: `KI (${modelName})`,
    action: "CREATE_DRAFT",
    changeSummary: "KI-Korrekturvorschlag erstellt — zur Prüfung durch die Lehrkraft.",
  };

  // ── 7. Persistenz: Container (FK) → submission → draft ─────────────────────
  let correctionDraftId = "";
  let submissionId = "";

  await deps.db.transaction(async (tx) => {
    const [unit] = await tx
      .insert(teachingUnit)
      .values({
        title: `Korrektur: ${topic}`,
        strandId: strand.id,
        gradeBand,
        status: "DRAFT",
        ownerTeacherId: userId,
        dataClass: "SENSITIVE_STUDENT",
      })
      .returning({ id: teachingUnit.id });
    if (!unit) throw new Error("teaching_unit INSERT lieferte keine ID zurück");

    const [ws] = await tx
      .insert(worksheet)
      .values({ unitId: unit.id, title: topic, ownerTeacherId: userId, dataClass: "INTERNAL" })
      .returning({ id: worksheet.id });
    if (!ws) throw new Error("worksheet INSERT lieferte keine ID zurück");

    const [tk] = await tx
      .insert(task)
      .values({
        worksheetId: ws.id,
        prompt: topic,
        taskType: "ESSAY",
        difficulty: "MEDIUM",
        ownerTeacherId: userId,
        dataClass: "INTERNAL",
      })
      .returning({ id: task.id });
    if (!tk) throw new Error("task INSERT lieferte keine ID zurück");

    const [sub] = await tx
      .insert(studentSubmission)
      .values({
        taskId: tk.id,
        pseudonymId,
        // Kein Klartext extern: nur Marker; der redactete Text geht flüchtig ans LLM.
        contentRef: "inline:redacted",
        ownerTeacherId: userId,
        dataClass: "SENSITIVE_STUDENT",
      })
      .returning({ id: studentSubmission.id });
    if (!sub) throw new Error("student_submission INSERT lieferte keine ID zurück");
    submissionId = sub.id;

    const [draft] = await tx
      .insert(correctionDraft)
      .values({
        submissionId: sub.id,
        aiSuggestion: statements,
        provenance,
        history: [historyEntry],
        status: "DRAFT",
        ownerTeacherId: userId,
        dataClass: "SENSITIVE_STUDENT",
      })
      .returning({ id: correctionDraft.id });
    if (!draft) throw new Error("correction_draft INSERT lieferte keine ID zurück");
    correctionDraftId = draft.id;

    await tx.insert(generationProvenance).values({
      artifactType: "CORRECTION_DRAFT",
      artifactId: draft.id,
      provider: providerName,
      model: modelName,
      promptHash,
      redactionApplied: true,
      sourceRefs: citedSourceIds,
      confidenceState: {
        rubricCriteria: rubricScores.length,
        feedbackStatements: statements.length,
        lowConfidence: statements.filter((s) => s.confidence.level === "LOW").length,
      },
      ownerTeacherId: userId,
      dataClass: "SENSITIVE_STUDENT",
    });
  });

  // ── 8. Audit-Log (kein PII, kein Klarname) ────────────────────────────────
  await deps.audit.record({
    eventType: "generation_correction",
    actorId: userId,
    subject,
    severity: "info",
    detail: JSON.stringify({
      correctionDraftId,
      submissionId,
      gradeBand,
      strandId: strand.id,
      redactionApplied: true,
      rubricCriteria: rubricScores.length,
      feedbackStatements: statements.length,
      citedSourceCount: citedSourceIds.length,
      crossDenominationWarning,
    }),
  });

  // ── 9. Result ─────────────────────────────────────────────────────────────
  const result: CorrectionResult = {
    correctionDraftId,
    submissionId,
    statements,
    rubricScores,
    citations,
  };
  if (crossDenominationWarning) result.crossDenominationWarning = true;
  return result;
}
