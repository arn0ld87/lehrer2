/**
 * seed-strands.ts — Idempotentes Seeding der Curriculum-Stränge
 *
 * Hintergrund (R-strand):
 *   generatePlanning() / generateWorksheet() rufen resolveStrand() auf, das
 *   fail-closed ist: kein ACTIVE-Strang → GenerationBlockedError.
 *   Dieses Script stellt sicher, dass für die realen Deutsch-Materialien
 *   (SEK_I, Sachsen-Anhalt) mindestens ein passender ACTIVE-Strang existiert.
 *
 * Lookup-Bedingung (aus planning.ts / worksheet.ts, identisch):
 *   subject           = uiSubjectToDb(uiSubject).subject
 *   confession_context = uiConfessionToDbContexts(uiSubject)[0]
 *                        ?? uiSubjectToDb(uiSubject).confession
 *   status            = 'ACTIVE'
 *   school_form       = :form OR school_form IS NULL   (OR-Bedingung, NULL matcht alle Formen)
 *   ORDER BY school_form ASC NULLS LAST, id ASC        (spezifische Form bevorzugt)
 *   LIMIT 1
 *
 *   Für UI-Fach "deutsch":
 *     subject           = 'DEUTSCH'
 *     confession_context = 'NICHT_ANWENDBAR'  ([] → [0]=undefined → fallback dbConfession)
 *   Ein Strang mit schoolForm=NULL deckt alle Schulformen ab und wird immer
 *   gefunden, wenn kein schulformspezifischer Strang vorhanden ist.
 *
 * Idempotenz-Key: (subject, confession_context, school_stage, version).
 *   Kein DB-Unique-Constraint auf dieser Kombination → manueller SELECT-Check.
 *
 * Reichweite:
 *   Nur DEUTSCH/NICHT_ANWENDBAR/SEK_I (Primärziel: reale Deutsch-Materialien).
 *   Religion ev./kath. und Ethik werden hier bewusst NICHT geseedet —
 *   sie können ergänzt werden, sobald die entsprechenden Lehrplan-Metadaten
 *   für Sachsen-Anhalt vorliegen und verifiziert sind (Quellenpflicht, AGENTS.md).
 */

// .env laden, BEVOR src/lib/db/client.ts process.env.DATABASE_URL beim Import liest
import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { curriculumStrand } from "../src/lib/db/schema/curriculum";

// ── Typen ─────────────────────────────────────────────────────────────────────

export interface SeedResult {
  inserted: number;
  skipped: number;
}

// ── Seed-Daten ─────────────────────────────────────────────────────────────────

/**
 * Strang-Definitionen für Sachsen-Anhalt SEK_I (Stand 2019).
 *
 * schoolForm=null: Strang gilt für alle Schulformen (Gesamtschule und
 * Gemeinschaftsschule). Schulformspezifische Stränge können später ergänzt
 * werden — sie werden vom resolveStrand()-Ordering dann bevorzugt behandelt.
 *
 * frameworkAuthority: offizieller Name der herausgebenden Behörde.
 * validFrom: Datum des Inkrafttretens des Lehrplans (Schuljahr 2019/20).
 * version: interne Bezeichnung für Idempotenz.
 */
const STRANDS_TO_SEED = [
  {
    subject: "DEUTSCH" as const,
    confessionContext: "NICHT_ANWENDBAR" as const,
    schoolStage: "SEK_I" as const,
    schoolForm: null,
    educationTrack: null,
    frameworkAuthority: "Ministerium für Bildung des Landes Sachsen-Anhalt (LISA)",
    validFrom: "2019-08-01",
    validTo: null,
    version: "2019.1",
    status: "ACTIVE" as const,
  },
] as const;

// ── seedStrands ───────────────────────────────────────────────────────────────

export async function seedStrands(seedDb = db): Promise<SeedResult> {
  console.log("🌱 Starte Curriculum-Strang-Seed...");

  let inserted = 0;
  let skipped = 0;

  for (const strand of STRANDS_TO_SEED) {
    // Idempotenz-Check: (subject, confessionContext, schoolStage, version)
    const existing = await seedDb
      .select({ id: curriculumStrand.id })
      .from(curriculumStrand)
      .where(
        and(
          eq(curriculumStrand.subject, strand.subject),
          eq(curriculumStrand.confessionContext, strand.confessionContext),
          eq(curriculumStrand.schoolStage, strand.schoolStage),
          eq(curriculumStrand.version, strand.version),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      console.log(
        `⏭️  Übersprungen: ${strand.subject}/${strand.confessionContext}/${strand.schoolStage} v${strand.version} — bereits vorhanden (id=${existing[0]!.id})`,
      );
      skipped++;
      continue;
    }

    const [row] = await seedDb
      .insert(curriculumStrand)
      .values({
        subject: strand.subject,
        confessionContext: strand.confessionContext,
        schoolStage: strand.schoolStage,
        schoolForm: strand.schoolForm ?? undefined,
        educationTrack: strand.educationTrack ?? undefined,
        frameworkAuthority: strand.frameworkAuthority,
        validFrom: strand.validFrom,
        validTo: strand.validTo ?? undefined,
        version: strand.version,
        status: strand.status,
      })
      .returning({ id: curriculumStrand.id });

    if (!row) {
      throw new Error(
        `curriculumStrand INSERT lieferte keine ID zurück für ${strand.subject}/${strand.confessionContext}`,
      );
    }

    console.log(
      `✅ Eingefügt: ${strand.subject}/${strand.confessionContext}/${strand.schoolStage} v${strand.version} (id=${row.id})`,
    );
    inserted++;
  }

  console.log(
    `\n✨ Strang-Seed abgeschlossen: ${inserted} eingefügt, ${skipped} übersprungen`,
  );

  return { inserted, skipped };
}

// ── CLI-Entry ─────────────────────────────────────────────────────────────────

seedStrands()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error("❌ Strang-Seed fehlgeschlagen:", error);
    process.exit(1);
  });
