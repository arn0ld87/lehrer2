/**
 * Dashboard-Repository (DB-gestützt) + Backend-Factory.
 *
 * Leitet die Übersichts-Kacheln aus echten Tabellen ab:
 *   metrics()          → Counts (teaching_unit, worksheet, correction_draft, source_ref)
 *   recentWork()       → zuletzt aktualisierte Einheiten/Arbeitsblätter (updated_at)
 *   activities()       → audit_log (eventType/severity/timestamp), schulgefiltert
 *   sourceQuickAccess()→ aktive Lehrplan-Stränge (curriculum_strand)
 *   trustPrinciples()  → bindende Doku-Konstante (kein Fake-Datenpfad)
 *
 * Jede Methode fällt bei DB-Fehler/leerer DB auf die Mock-Schicht zurück, damit die
 * Übersicht nie bricht. Datenschutz: ausschließlich Metadaten, kein Schüler-PII.
 */

import { and, desc, eq, gte, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sourceRef, teachingUnit, worksheet } from "@/lib/db/schema/artifacts";
import { correctionDraft } from "@/lib/db/schema/corrections";
import { auditLog } from "@/lib/db/schema/provenance";
import { curriculumStrand } from "@/lib/db/schema/curriculum";
import { getActiveTeacher } from "@/lib/auth";
import { mockDashboardRepository } from "@/lib/mock";
import type { AsyncDashboardRepository } from "@/lib/repositories";
import type {
  Activity,
  DashboardMetric,
  RecentWork,
  SourceQuickAccess,
  Subject,
  TrustPrinciple,
} from "@/lib/types";
import { dbSubjectToUi, type DbConfession, type DbSubject } from "./mapping";

const SUBJECT_LABEL: Record<Subject, string> = {
  deutsch: "Deutsch",
  "evangelische-religion": "Ev. Religion",
  "katholische-religion": "Kath. Religion",
  ethik: "Ethik",
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Relatives deutsches Zeitlabel aus einem Zeitstempel. */
function relativeTime(d: Date): string {
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `vor ${hrs} Std.`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "gestern";
  if (days < 7) return `vor ${days} Tagen`;
  return d.toLocaleDateString("de-DE");
}

/** eventType (SCREAMING_SNAKE) → lesbarer Titel. */
function humanizeEvent(eventType: string): string {
  const s = eventType.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Optionales `detail`-Feld aus dem audit_log.details-JSON. */
function extractDetail(details: unknown): string | null {
  if (details && typeof details === "object" && "detail" in details) {
    const d = (details as { detail?: unknown }).detail;
    if (typeof d === "string") return d;
  }
  return null;
}

function scalar(rows: Array<{ n: number }>): number {
  return rows[0]?.n ?? 0;
}

export class PgDashboardRepository implements AsyncDashboardRepository {
  async metrics(): Promise<DashboardMetric[]> {
    try {
      const weekAgo = new Date(Date.now() - WEEK_MS);
      const countSel = { n: sql<number>`count(*)::int` };
      const [units, sheets, corrections, sources] = await Promise.all([
        db
          .select(countSel)
          .from(teachingUnit)
          .where(and(isNull(teachingUnit.deletedAt), ne(teachingUnit.status, "ARCHIVED"))),
        db
          .select(countSel)
          .from(worksheet)
          .where(and(isNull(worksheet.deletedAt), gte(worksheet.createdAt, weekAgo))),
        db
          .select(countSel)
          .from(correctionDraft)
          .where(and(isNull(correctionDraft.deletedAt), eq(correctionDraft.status, "DRAFT"))),
        db.select(countSel).from(sourceRef).where(isNull(sourceRef.deletedAt)),
      ]);

      return [
        {
          id: "m-units",
          kicker: "Unterrichtseinheiten",
          value: scalar(units),
          foot: "aktiv (nicht archiviert)",
          icon: "calendar",
          accent: "purple",
          href: "/planung",
        },
        {
          id: "m-sheets",
          kicker: "Arbeitsblätter erstellt",
          value: scalar(sheets),
          foot: "in dieser Woche",
          icon: "file",
          accent: "green",
          href: "/arbeitsblaetter",
        },
        {
          id: "m-corrections",
          kicker: "Korrekturen offen",
          value: scalar(corrections),
          foot: "zur Bearbeitung",
          icon: "wand",
          accent: "orange",
          href: "/korrektur",
        },
        {
          id: "m-sources",
          kicker: "Quellen im System",
          value: scalar(sources),
          foot: "im Register",
          icon: "layers",
          accent: "blue",
          href: "/quelle",
        },
      ];
    } catch {
      return mockDashboardRepository.metrics();
    }
  }

  async recentWork(): Promise<RecentWork[]> {
    try {
      const units = await db
        .select({
          id: teachingUnit.id,
          title: teachingUnit.title,
          gradeBand: teachingUnit.gradeBand,
          updatedAt: teachingUnit.updatedAt,
          subject: curriculumStrand.subject,
          confession: curriculumStrand.confessionContext,
        })
        .from(teachingUnit)
        .innerJoin(curriculumStrand, eq(curriculumStrand.id, teachingUnit.strandId))
        .where(isNull(teachingUnit.deletedAt))
        .orderBy(desc(teachingUnit.updatedAt))
        .limit(5);

      const sheets = await db
        .select({
          id: worksheet.id,
          title: worksheet.title,
          gradeBand: teachingUnit.gradeBand,
          updatedAt: worksheet.updatedAt,
          subject: curriculumStrand.subject,
          confession: curriculumStrand.confessionContext,
        })
        .from(worksheet)
        .innerJoin(teachingUnit, eq(teachingUnit.id, worksheet.unitId))
        .innerJoin(curriculumStrand, eq(curriculumStrand.id, teachingUnit.strandId))
        .where(isNull(worksheet.deletedAt))
        .orderBy(desc(worksheet.updatedAt))
        .limit(5);

      const merged = [
        ...units.map((u) => ({ ...u, kind: "unit" as const })),
        ...sheets.map((s) => ({ ...s, kind: "sheet" as const })),
      ]
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, 4);

      if (merged.length === 0) return mockDashboardRepository.recentWork();

      return merged.map((m) => {
        const ui = dbSubjectToUi(m.subject as DbSubject, m.confession as DbConfession);
        return {
          id: m.id,
          title: m.title,
          subtitle: `${m.kind === "unit" ? "Unterrichtseinheit" : "Arbeitsblatt"} · ${SUBJECT_LABEL[ui]} · ${m.gradeBand}`,
          subject: ui,
          icon: m.kind === "unit" ? "calendar" : "file",
          modifiedAt: relativeTime(m.updatedAt),
          tab: "zuletzt",
        };
      });
    } catch {
      return mockDashboardRepository.recentWork();
    }
  }

  async activities(): Promise<Activity[]> {
    try {
      const teacher = await getActiveTeacher();
      const rows = await db
        .select()
        .from(auditLog)
        .where(teacher?.schoolId ? eq(auditLog.schoolId, teacher.schoolId) : undefined)
        .orderBy(desc(auditLog.timestamp))
        .limit(6);

      if (rows.length === 0) return mockDashboardRepository.activities();

      return rows.map((r) => ({
        id: r.id,
        title: humanizeEvent(r.eventType),
        detail: extractDetail(r.details) ?? `Ereignis: ${humanizeEvent(r.eventType)}`,
        icon: r.severity === "info" ? "info" : "warn",
        timestamp: relativeTime(r.timestamp),
      }));
    } catch {
      return mockDashboardRepository.activities();
    }
  }

  async sourceQuickAccess(): Promise<SourceQuickAccess[]> {
    try {
      const strands = await db
        .select()
        .from(curriculumStrand)
        .where(eq(curriculumStrand.status, "ACTIVE"))
        .limit(3);

      if (strands.length === 0) return mockDashboardRepository.sourceQuickAccess();

      return strands.map((s) => {
        const ui = dbSubjectToUi(s.subject as DbSubject, s.confessionContext as DbConfession);
        const form =
          s.educationTrack === "GYMNASIALER_BILDUNGSGANG"
            ? "Gymnasialer Bildungsgang"
            : s.schoolForm === "GESAMTSCHULE"
              ? "Gesamtschule"
              : "Gemeinschaftsschule";
        const stage = s.schoolStage === "SEK_II" ? "Sek II" : "Klassen 5–10";
        return {
          id: s.id,
          title: `Lehrplan ${SUBJECT_LABEL[ui]}`,
          subtitle: `${form} · ${stage}`,
          accent: ui === "deutsch" ? "primary" : "green",
        };
      });
    } catch {
      return mockDashboardRepository.sourceQuickAccess();
    }
  }

  async trustPrinciples(): Promise<TrustPrinciple[]> {
    // Bindende Grundsätze — bewusst statisch, kein DB-/Fake-Datenpfad.
    return mockDashboardRepository.trustPrinciples();
  }
}

/** Backend-Factory: REPOSITORY_BACKEND=db → Postgres, sonst Mock-Adapter (sync→async). */
export function getDashboardRepository(): AsyncDashboardRepository {
  if (process.env.REPOSITORY_BACKEND === "db") {
    return new PgDashboardRepository();
  }
  return {
    async metrics() {
      return mockDashboardRepository.metrics();
    },
    async recentWork(tab) {
      return mockDashboardRepository.recentWork(tab);
    },
    async activities() {
      return mockDashboardRepository.activities();
    },
    async sourceQuickAccess() {
      return mockDashboardRepository.sourceQuickAccess();
    },
    async trustPrinciples() {
      return mockDashboardRepository.trustPrinciples();
    },
  };
}
