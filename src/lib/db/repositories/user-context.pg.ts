/**
 * UserContext-Repository (DB-gestützt) + Backend-Factory.
 *
 * `user()`    → aktives Teacher-Profil (getActiveTeacher; Login deaktiviert → Fallback).
 * `current()` → Vorbelegung aus dem dominanten aktiven Lehrplan-Strang. Es gibt keine
 *               „aktive-Auswahl"-Persistenz im Datenmodell; daher Ableitung statt erfundener
 *               Speicherung. Fällt auf DEFAULT_CONTEXT zurück, wenn kein Strang vorliegt.
 *
 * Die Factory liegt bewusst in dieser Domänen-Datei (nicht in der sources-zentrierten
 * factory.ts), damit die UserContext-Logik isoliert und für sich verständlich bleibt.
 */

import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { curriculumNode, curriculumStrand } from "@/lib/db/schema/curriculum";
import { getActiveTeacher } from "@/lib/auth";
import { mockUserContextRepository } from "@/lib/mock";
import type { AsyncUserContextRepository } from "@/lib/repositories";
import type { Grade, MockUser, SchoolForm, UserContext } from "@/lib/types";
import { dbSubjectToUi } from "./mapping";

/** Dokumentierter Default, wenn kein aktiver Lehrplan-Strang vorliegt (= Mock-Vorbelegung). */
const DEFAULT_CONTEXT: UserContext = {
  subject: "deutsch",
  schoolForm: "gemeinschaftsschule",
  grade: 8,
};

/** „KS8" → 8; fällt auf den Default-Grade zurück, wenn unparsbar/außerhalb 5–12. */
function parseGradeBand(band: string | null | undefined): Grade {
  const n = Number((band ?? "").replace(/\D/g, ""));
  if (Number.isInteger(n) && n >= 5 && n <= 12) return n as Grade;
  return DEFAULT_CONTEXT.grade;
}

/** Zwei Großbuchstaben aus Namen oder E-Mail-Präfix. */
function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.split("@")[0].slice(0, 2).toUpperCase() || "?";
}

export class PgUserContextRepository implements AsyncUserContextRepository {
  async current(): Promise<UserContext> {
    try {
      const [strand] = await db
        .select()
        .from(curriculumStrand)
        .where(eq(curriculumStrand.status, "ACTIVE"))
        .orderBy(asc(curriculumStrand.subject))
        .limit(1);
      if (!strand) return DEFAULT_CONTEXT;

      const subject = dbSubjectToUi(strand.subject, strand.confessionContext);
      // UI-SchoolForm konflatiert Schulform und Bildungsgang; Bildungsgang-Heuristik
      // für die Vorbelegung (echte Auswahl wäre ein späteres, persistiertes Feature).
      const schoolForm: SchoolForm =
        strand.educationTrack === "GYMNASIALER_BILDUNGSGANG"
          ? "gymnasialer-bildungsgang"
          : "gemeinschaftsschule";

      const [node] = await db
        .select({ gradeBand: curriculumNode.gradeBand })
        .from(curriculumNode)
        .where(eq(curriculumNode.strandId, strand.id))
        .orderBy(asc(curriculumNode.gradeBand))
        .limit(1);

      return { subject, schoolForm, grade: parseGradeBand(node?.gradeBand) };
    } catch {
      // DB nicht verfügbar (z. B. mock-Backend ohne Postgres) → Default-Vorbelegung
      return DEFAULT_CONTEXT;
    }
  }

  async user(): Promise<MockUser> {
    const teacher = await getActiveTeacher();
    if (!teacher) return { initials: "?", name: "—", role: "Lehrkraft" };
    return {
      initials: deriveInitials(teacher.displayName),
      name: teacher.displayName,
      role: teacher.role === "ADMIN" ? "Administrator" : "Lehrkraft",
    };
  }
}

/** Backend-Factory: REPOSITORY_BACKEND=db → Postgres, sonst Mock-Adapter (sync→async). */
export function getUserContextRepository(): AsyncUserContextRepository {
  if (process.env.REPOSITORY_BACKEND === "db") {
    return new PgUserContextRepository();
  }
  return {
    async current() {
      return mockUserContextRepository.current();
    },
    async user() {
      return mockUserContextRepository.user();
    },
  };
}
