/**
 * PgSourcesRepository — implementiert SourceRepository gegen die Postgres-DB.
 *
 * Datenschutz: kein Schüler-PII, keine Re-Identifikation; sourceRef enthält
 * ausschließlich Metadaten zu Lehrplanquellen und Materialien.
 *
 * FAIL-CLOSED Trust-Gate:
 *   approve() wirft, wenn lifecycleStatus !== "REGISTERED"
 *   ODER licenseVerified !== true ODER sourceType === "UNVERIFIED".
 */

import { and, eq, inArray, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { SourceEntry } from "@/lib/types";
import type {
  SourceApproveMeta,
  SourceCreateInput,
  SourceEntriesReader,
  SourceRegisterMeta,
  SourceRepository,
} from "@/lib/repositories";
import { db } from "@/lib/db/client";
import {
  sourceRef,
  teachingUnit,
  worksheet,
  worksheetSourceRef,
} from "@/lib/db/schema/artifacts";
import { curriculumStrand } from "@/lib/db/schema/curriculum";
import { dbSubjectToUi, type DbConfession, type DbSubject } from "./mapping";

/** Reales Fach/Konfession einer Quelle, aufgelöst über den Curriculum-Join (#39). */
type ResolvedSubject = { subject: DbSubject; confession: DbConfession };

/**
 * Mapping source_trust (DB-Enum) → UI SourceTrust.
 *
 * 1:1 Abbildung (kein Mapping mehr nötig; die UI kennt jetzt alle fünf Stufen).
 * Unbekannte Werte fallen auf "UNVERIFIED" zurück (fail-safe).
 * Governance verdeckt keine Vertrauensstufe.
 */
const trustToUi: Record<string, SourceEntry["trust"]> = {
  OFFICIAL_BINDING: "OFFICIAL_BINDING",
  OFFICIAL_GUIDANCE: "OFFICIAL_GUIDANCE",
  OPEN_CURATED: "OPEN_CURATED",
  USER_APPROVED: "USER_APPROVED",
  UNVERIFIED: "UNVERIFIED",
};

/**
 * Mappt eine sourceRef-DB-Zeile auf SourceEntry für die UI (#39).
 *
 * Fach/Konfession werden REAL aufgelöst, niemals als Placeholder verdeckt:
 *   1. direktes `subjectAlignment` (+ confessionContext) der Quelle, falls gesetzt;
 *   2. sonst über den Curriculum-Join aufgelöster Wert (`resolved`);
 *   3. nur wenn die Quelle weder ein Alignment noch eine Lehrplan-Verknüpfung hat,
 *      bleibt sie fachneutral ("deutsch") — das ist dann KEINE verdeckte Konfession,
 *      sondern eine genuin noch nicht zugeordnete Quelle.
 *
 * Konfessionstrennung bleibt sichtbar: eine RELIGION-Quelle erscheint als
 * „Ev./Kath. Religion", nicht als „Deutsch".
 */
function rowToSourceEntry(
  r: typeof sourceRef.$inferSelect,
  resolved?: ResolvedSubject,
): SourceEntry {
  let subject: SourceEntry["subject"] = "deutsch";
  if (r.subjectAlignment) {
    subject = dbSubjectToUi(
      r.subjectAlignment as DbSubject,
      (r.confessionContext as DbConfession | null) ?? "NICHT_ANWENDBAR",
    );
  } else if (resolved) {
    subject = dbSubjectToUi(resolved.subject, resolved.confession);
  }

  return {
    id: r.id,
    title: r.title,
    origin: r.uri ?? "—",
    subject,
    gradeRange: "—",
    trust: trustToUi[r.sourceType] ?? "UNVERIFIED",
    version: r.sourceVersion?.toString() ?? "—",
    license: r.licenseInfo ?? "—",
    status: r.lifecycleStatus === "REVOKED" ? "rejected" : "active",
  };
}

/**
 * Löst Fach/Konfession für Quellen OHNE direktes `subjectAlignment` über den
 * Curriculum-Join auf (#39):
 *   source_ref → worksheet_source_ref → worksheet → teaching_unit → curriculum_strand.
 *
 * Eine Quelle kann an mehrere Arbeitsblätter/Stränge gebunden sein; genommen wird
 * der erste gefundene Strang (deterministisch über die DB-Reihenfolge). Quellen mit
 * gesetztem subjectAlignment werden hier übersprungen — sie mappen direkt.
 *
 * Ein einziger Batch-Query (kein N+1) für alle übergebenen Zeilen.
 *
 * @returns Map sourceRef.id → { subject, confession } (nur für aufgelöste Quellen)
 */
async function resolveSubjectsForUnaligned(
  rows: Array<typeof sourceRef.$inferSelect>,
): Promise<Map<string, ResolvedSubject>> {
  const unalignedIds = rows.filter((r) => !r.subjectAlignment).map((r) => r.id);
  const out = new Map<string, ResolvedSubject>();
  if (unalignedIds.length === 0) return out;

  const links = await db
    .select({
      sourceRefId: worksheetSourceRef.sourceRefId,
      subject: curriculumStrand.subject,
      confession: curriculumStrand.confessionContext,
    })
    .from(worksheetSourceRef)
    .innerJoin(worksheet, eq(worksheet.id, worksheetSourceRef.worksheetId))
    .innerJoin(teachingUnit, eq(teachingUnit.id, worksheet.unitId))
    .innerJoin(curriculumStrand, eq(curriculumStrand.id, teachingUnit.strandId))
    .where(inArray(worksheetSourceRef.sourceRefId, unalignedIds));

  for (const link of links) {
    // Erster Treffer pro Quelle gewinnt (deterministisch, keine stille Mehrfachwahl).
    if (!out.has(link.sourceRefId)) {
      out.set(link.sourceRefId, {
        subject: link.subject as DbSubject,
        confession: link.confession as DbConfession,
      });
    }
  }
  return out;
}

export class PgSourcesRepository implements SourceRepository {
  // -------------------------------------------------------------------------
  // SourceEntriesReader (M1-Compat)
  // -------------------------------------------------------------------------

  /** entries() — Lesevertrag aus SourceEntriesReader (kompatibel zu M1). */
  async entries(): Promise<SourceEntry[]> {
    return this.list();
  }

  // -------------------------------------------------------------------------
  // SourceRepository — Lesen
  // -------------------------------------------------------------------------

  async list(): Promise<SourceEntry[]> {
    const rows = await db
      .select()
      .from(sourceRef)
      .where(isNull(sourceRef.deletedAt));
    const resolved = await resolveSubjectsForUnaligned(rows);
    return rows.map((r) => rowToSourceEntry(r, resolved.get(r.id)));
  }

  async get(id: string): Promise<SourceEntry | null> {
    // deletedAt-Filter: soft-gelöschte Quellen werden nicht als aktiv geliefert.
    const rows = await db
      .select()
      .from(sourceRef)
      .where(and(eq(sourceRef.id, id), isNull(sourceRef.deletedAt)));
    const row = rows[0];
    if (!row) return null;
    const resolved = await resolveSubjectsForUnaligned(rows);
    return rowToSourceEntry(row, resolved.get(row.id));
  }

  // -------------------------------------------------------------------------
  // SourceRepository — Schreiben / Lifecycle-Transitionen
  // -------------------------------------------------------------------------

  /**
   * create() — legt eine neue Quelle mit Status DISCOVERED an.
   * Gibt die neue ID zurück.
   */
  async create(input: SourceCreateInput): Promise<string> {
    const id = randomUUID();
    await db.insert(sourceRef).values({
      id,
      title: input.title,
      uri: input.uri,
      sourceType: input.sourceType as (typeof sourceRef.$inferInsert)["sourceType"],
      subjectAlignment: input.subjectAlignment as
        | (typeof sourceRef.$inferInsert)["subjectAlignment"]
        | undefined,
      confessionContext: input.confessionContext as
        | (typeof sourceRef.$inferInsert)["confessionContext"]
        | undefined,
      licenseInfo: input.licenseInfo,
      lifecycleStatus: "DISCOVERED",
    });
    return id;
  }

  /**
   * register() — DISCOVERED / UNDER_REVIEW → REGISTERED.
   * Setzt Lizenz-Metadaten; wirft, wenn Ausgangsstatus unzulässig.
   */
  async register(id: string, meta: SourceRegisterMeta): Promise<void> {
    // SELECT ... FOR UPDATE in einer Transaktion: read+check+write atomar,
    // kein TOCTOU-Race mit konkurrierenden Transitionen.
    await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(sourceRef)
        .where(eq(sourceRef.id, id))
        .for("update");
      const row = rows[0];
      if (!row) throw new Error(`sourceRef ${id} nicht gefunden`);
      if (row.lifecycleStatus !== "DISCOVERED" && row.lifecycleStatus !== "UNDER_REVIEW") {
        throw new Error(
          `register() erfordert Status DISCOVERED oder UNDER_REVIEW, ist aber ${row.lifecycleStatus}`,
        );
      }
      await tx
        .update(sourceRef)
        .set({
          lifecycleStatus: "REGISTERED",
          ...(meta.licenseInfo !== undefined ? { licenseInfo: meta.licenseInfo } : {}),
          ...(meta.licenseVerified !== undefined ? { licenseVerified: meta.licenseVerified } : {}),
          ...(meta.approvalMetadata !== undefined
            ? { approvalMetadata: meta.approvalMetadata }
            : {}),
        })
        .where(eq(sourceRef.id, id));
    });
  }

  /**
   * approve() — REGISTERED → APPROVED.
   *
   * FAIL-CLOSED Trust-Gate:
   *   - lifecycleStatus muss "REGISTERED" sein
   *   - licenseVerified muss true sein
   *   - sourceType darf nicht "UNVERIFIED" sein
   * Wirft Error, wenn eine Bedingung nicht erfüllt ist.
   */
  async approve(id: string, meta: SourceApproveMeta): Promise<void> {
    // SELECT ... FOR UPDATE sperrt die Zeile bis Commit → kein TOCTOU-Race
    // (z. B. konkurrierendes revoke()) zwischen Gate-Prüfung und Schreiben.
    await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(sourceRef)
        .where(eq(sourceRef.id, id))
        .for("update");
      const row = rows[0];
      if (!row) throw new Error(`sourceRef ${id} nicht gefunden`);

      // FAIL-CLOSED: alle Vorbedingungen müssen gleichzeitig erfüllt sein
      if (row.lifecycleStatus !== "REGISTERED") {
        throw new Error(
          `approve() erfordert Status REGISTERED, ist aber ${row.lifecycleStatus}`,
        );
      }
      if (!row.licenseVerified) {
        throw new Error(
          `approve() verweigert: licenseVerified ist false für sourceRef ${id}`,
        );
      }
      if (row.sourceType === "UNVERIFIED") {
        throw new Error(
          `approve() verweigert: sourceType UNVERIFIED darf nie in APPROVED überführt werden (sourceRef ${id})`,
        );
      }

      await tx
        .update(sourceRef)
        .set({
          lifecycleStatus: "APPROVED",
          ...(meta.approvalMetadata !== undefined
            ? { approvalMetadata: meta.approvalMetadata }
            : {}),
        })
        .where(eq(sourceRef.id, id));
    });
  }

  /**
   * revoke() — jeder Status → REVOKED.
   * Nur benannte Methode, kein ad-hoc UPDATE (ADR 0005).
   */
  async revoke(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(sourceRef)
        .where(eq(sourceRef.id, id))
        .for("update");
      const row = rows[0];
      if (!row) throw new Error(`sourceRef ${id} nicht gefunden`);
      await tx
        .update(sourceRef)
        .set({ lifecycleStatus: "REVOKED" })
        .where(eq(sourceRef.id, id));
    });
  }

  /**
   * ingestMark() — APPROVED → INGESTED.
   * Wirft, wenn Ausgangsstatus !== "APPROVED".
   */
  async ingestMark(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(sourceRef)
        .where(eq(sourceRef.id, id))
        .for("update");
      const row = rows[0];
      if (!row) throw new Error(`sourceRef ${id} nicht gefunden`);
      if (row.lifecycleStatus !== "APPROVED") {
        throw new Error(
          `ingestMark() erfordert Status APPROVED, ist aber ${row.lifecycleStatus}`,
        );
      }
      await tx
        .update(sourceRef)
        .set({ lifecycleStatus: "INGESTED" })
        .where(eq(sourceRef.id, id));
    });
  }
}

/**
 * Legacy-Export: schmaler SourceEntriesReader-Adapter (M1-Compat).
 * Für neue Aufrufer: factory.getSourceRepository() verwenden.
 */
export function createSourceEntriesReader(): SourceEntriesReader {
  return new PgSourcesRepository();
}
