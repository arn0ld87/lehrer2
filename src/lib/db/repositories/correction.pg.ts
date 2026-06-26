/**
 * Correction-Repository (DB-gestützt) + Backend-Factory.
 *
 * Liest den jüngsten correctionDraft der aktiven Lehrkraft und mappt ihn auf die
 * UI-Verträge:
 *   submissionMeta()    → studentSubmission (Pseudonym!) + Artefakt-/Lehrplan-Join
 *   feedbackStatements()→ correctionDraft.aiSuggestion (FeedbackStatement[])
 *   rubricScores()      → correctionDraft.provenance.rubricScores (kein Schemafeld)
 *   history()           → correctionDraft.history (FeedbackHistoryEntry[])
 *   feedbackDraft()     → aiSuggestion-Texte zusammengeführt
 *
 * Datenschutz: es werden ausschließlich Pseudonyme angezeigt (pseudonymId), nie
 * Klarnamen — die verlassen das System ohnehin nie. Fällt ohne Draft auf die
 * Mock-Schicht zurück (synthetisches Beispiel).
 */

import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { correctionDraft, studentSubmission } from "@/lib/db/schema/corrections";
import { task, teachingUnit, worksheet } from "@/lib/db/schema/artifacts";
import { curriculumStrand } from "@/lib/db/schema/curriculum";
import { getActiveTeacher } from "@/lib/auth";
import { mockCorrectionRepository } from "@/lib/mock";
import type {
  AsyncCorrectionRepository,
  CorrectionSubmissionMeta,
} from "@/lib/repositories";
import type {
  DraftStatus,
  FeedbackHistoryEntry,
  FeedbackStatement,
  RubricScore,
  Subject,
} from "@/lib/types";
import { dbSubjectToUi, type DbConfession, type DbSubject } from "./mapping";

const SUBJECT_LABEL: Record<Subject, string> = {
  deutsch: "Deutsch",
  "evangelische-religion": "Ev. Religion",
  "katholische-religion": "Kath. Religion",
  ethik: "Ethik",
};

/**
 * Herkunfts-/Bewertungs-Payload, der im correctionDraft.provenance-JSON liegt.
 * Geteiltes Format zwischen Generierung (Schreiber) und Repository (Leser):
 * die Rubric-Bewertung hat kein dediziertes Schemafeld und wohnt hier.
 */
export interface CorrectionProvenance {
  provider: string;
  model: string;
  promptHash: string;
  redactionApplied: boolean;
  rubricScores: RubricScore[];
  generatedAt: string;
  citedSourceIds?: string[];
}

type DraftBundle = {
  aiSuggestion: FeedbackStatement[] | null;
  provenance: unknown;
  history: FeedbackHistoryEntry[] | null;
  status: "DRAFT" | "HUMAN_CONFIRMED" | "OVERRIDDEN";
  pseudonymId: string;
  submittedAt: Date;
  title: string | null;
  gradeBand: string | null;
  subject: string | null;
  confession: string | null;
};

function mapStatus(status: DraftBundle["status"]): DraftStatus {
  // KI-Entwurf muss von der Lehrkraft geprüft werden → "review"; bestätigt → "ready".
  return status === "HUMAN_CONFIRMED" ? "ready" : "review";
}

export class PgCorrectionRepository implements AsyncCorrectionRepository {
  // Memoisierter Fetch: submissionMeta/rubricScores/… teilen sich einen Join.
  private cached?: Promise<DraftBundle | null>;

  private load(): Promise<DraftBundle | null> {
    return (this.cached ??= this.fetchLatest());
  }

  private async fetchLatest(): Promise<DraftBundle | null> {
    try {
      const teacher = await getActiveTeacher();
      if (!teacher) return null;

      const [row] = await db
        .select({
          aiSuggestion: correctionDraft.aiSuggestion,
          provenance: correctionDraft.provenance,
          history: correctionDraft.history,
          status: correctionDraft.status,
          pseudonymId: studentSubmission.pseudonymId,
          submittedAt: studentSubmission.submittedAt,
          title: teachingUnit.title,
          gradeBand: teachingUnit.gradeBand,
          subject: curriculumStrand.subject,
          confession: curriculumStrand.confessionContext,
        })
        .from(correctionDraft)
        .innerJoin(studentSubmission, eq(studentSubmission.id, correctionDraft.submissionId))
        .leftJoin(task, eq(task.id, studentSubmission.taskId))
        .leftJoin(worksheet, eq(worksheet.id, task.worksheetId))
        .leftJoin(teachingUnit, eq(teachingUnit.id, worksheet.unitId))
        .leftJoin(curriculumStrand, eq(curriculumStrand.id, teachingUnit.strandId))
        .where(
          and(
            eq(correctionDraft.ownerTeacherId, teacher.userId),
            isNull(correctionDraft.deletedAt),
          ),
        )
        .orderBy(desc(correctionDraft.createdAt))
        .limit(1);

      return row ?? null;
    } catch {
      return null;
    }
  }

  async submissionMeta(): Promise<CorrectionSubmissionMeta> {
    const b = await this.load();
    if (!b) return mockCorrectionRepository.submissionMeta();

    let subjectLabel = "—";
    if (b.subject) {
      const ui = dbSubjectToUi(
        b.subject as DbSubject,
        (b.confession as DbConfession | null) ?? "NICHT_ANWENDBAR",
      );
      const klasse = b.gradeBand ? ` · Klasse ${b.gradeBand.replace(/\D/g, "")}` : "";
      subjectLabel = `${SUBJECT_LABEL[ui]}${klasse}`;
    }

    return {
      title: b.title ?? "Korrektur-Entwurf",
      subjectLabel,
      submittedAt: b.submittedAt.toLocaleDateString("de-DE"),
      pseudonym: b.pseudonymId,
      status: mapStatus(b.status),
    };
  }

  async rubricScores(): Promise<RubricScore[]> {
    const b = await this.load();
    if (!b) return mockCorrectionRepository.rubricScores();
    const prov = b.provenance as CorrectionProvenance | null;
    return prov?.rubricScores ?? [];
  }

  async feedbackDraft(): Promise<string> {
    const b = await this.load();
    if (!b) return mockCorrectionRepository.feedbackDraft();
    return (b.aiSuggestion ?? []).map((s) => s.text).join("\n\n");
  }

  async feedbackStatements(): Promise<FeedbackStatement[]> {
    const b = await this.load();
    if (!b) return mockCorrectionRepository.feedbackStatements();
    return b.aiSuggestion ?? [];
  }

  async history(): Promise<FeedbackHistoryEntry[]> {
    const b = await this.load();
    if (!b) return mockCorrectionRepository.history();
    return b.history ?? [];
  }
}

/** Backend-Factory: REPOSITORY_BACKEND=db → Postgres, sonst Mock-Adapter (sync→async). */
export function getCorrectionRepository(): AsyncCorrectionRepository {
  if (process.env.REPOSITORY_BACKEND === "db") {
    return new PgCorrectionRepository();
  }
  return {
    async submissionMeta() {
      return mockCorrectionRepository.submissionMeta();
    },
    async rubricScores() {
      return mockCorrectionRepository.rubricScores();
    },
    async feedbackDraft() {
      return mockCorrectionRepository.feedbackDraft();
    },
    async feedbackStatements() {
      return mockCorrectionRepository.feedbackStatements();
    },
    async history() {
      return mockCorrectionRepository.history();
    },
  };
}
