/**
 * Verfügbare Fächer für die UI-Auswahl — abgeleitet aus den tatsächlich
 * vorhandenen ACTIVE-Curriculum-Strängen.
 *
 * Zweck: keine toten Dropdown-Einträge. Ein Fach ohne aktiven Lehrplan-Strang
 * (z. B. Kath. Religion oder Ethik, solange nicht geseedet) würde bei der
 * Generierung mit „Kein Lehrplan-Strang" abbrechen — also gar nicht erst
 * anbieten. mock-Backend oder DB-Fehler → Vollliste (UI bleibt funktionsfähig).
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { curriculumStrand } from "@/lib/db/schema/curriculum";
import type { Subject, SubjectOption } from "@/lib/types";
import { dbSubjectToUi, type DbConfession, type DbSubject } from "./mapping";

const SUBJECT_LABEL: Record<Subject, string> = {
  deutsch: "Deutsch",
  "evangelische-religion": "Ev. Religion",
  "katholische-religion": "Kath. Religion",
  ethik: "Ethik",
};

/** Statische Vollliste in stabiler Reihenfolge — Fallback ohne DB oder bei Fehler. */
const ALL_SUBJECTS: SubjectOption[] = (
  ["deutsch", "evangelische-religion", "katholische-religion", "ethik"] as Subject[]
).map((value) => ({ value, label: SUBJECT_LABEL[value] }));

/**
 * Liefert die Fächer, die wirklich einen aktiven Curriculum-Strang haben.
 * Reihenfolge folgt der Vollliste. mock-Backend/DB-Fehler/leeres Ergebnis →
 * Vollliste (defensiver Fallback, damit das Formular nie leer ist).
 */
export async function getAvailableSubjects(): Promise<SubjectOption[]> {
  if (process.env.REPOSITORY_BACKEND !== "db") return ALL_SUBJECTS;
  try {
    const rows = await db
      .selectDistinct({
        subject: curriculumStrand.subject,
        confession: curriculumStrand.confessionContext,
      })
      .from(curriculumStrand)
      .where(eq(curriculumStrand.status, "ACTIVE"));

    if (rows.length === 0) return ALL_SUBJECTS;

    const seen = new Set<Subject>();
    for (const r of rows) {
      seen.add(dbSubjectToUi(r.subject as DbSubject, r.confession as DbConfession));
    }
    return ALL_SUBJECTS.filter((o) => seen.has(o.value));
  } catch {
    return ALL_SUBJECTS;
  }
}
