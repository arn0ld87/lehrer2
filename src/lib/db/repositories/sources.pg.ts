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

import { and, eq, isNull } from "drizzle-orm";
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
import { sourceRef } from "@/lib/db/schema/artifacts";
import { dbSubjectToUi, type DbConfession, type DbSubject } from "./mapping";

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
 * Mappt eine sourceRef-DB-Zeile auf SourceEntry für die UI.
 *
 * subjectAlignment/confessionContext: wenn vorhanden, via dbSubjectToUi;
 * sonst "deutsch" als neutraler Interim-Placeholder.
 * TODO(M2): Join auf curriculum_strand auflösen, sobald RELIGION/ETHIK-Quellen
 * korrekt aufgelöst werden sollen.
 */
function rowToSourceEntry(r: typeof sourceRef.$inferSelect): SourceEntry {
  let subject: SourceEntry["subject"] = "deutsch";
  if (r.subjectAlignment && r.confessionContext) {
    subject = dbSubjectToUi(
      r.subjectAlignment as DbSubject,
      r.confessionContext as DbConfession,
    );
  }
  // TODO(M2): subject = "deutsch" ist nur ein Interim-Placeholder für Quellen
  // ohne subjectAlignment. RELIGION/ETHIK-Quellen werden bis zur Implementierung
  // des Joins (worksheet_source_ref → worksheet → teaching_unit → curriculum_strand)
  // ebenfalls als "deutsch" angezeigt.

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
    return rows.map(rowToSourceEntry);
  }

  async get(id: string): Promise<SourceEntry | null> {
    // deletedAt-Filter: soft-gelöschte Quellen werden nicht als aktiv geliefert.
    const rows = await db
      .select()
      .from(sourceRef)
      .where(and(eq(sourceRef.id, id), isNull(sourceRef.deletedAt)));
    const row = rows[0];
    if (!row) return null;
    return rowToSourceEntry(row);
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
