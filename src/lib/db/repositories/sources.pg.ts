/**
 * PgSourcesRepository — implementiert SourceEntriesReader gegen die Postgres-DB.
 *
 * Scope: nur entries() (async). ragQuality() und governanceChecks() hängen am
 * RAG-Layer (M2) und werden hier bewusst nicht implementiert.
 *
 * Datenschutz: kein Schüler-PII, keine Re-Identifikation; sourceRef enthält
 * ausschließlich Metadaten zu Lehrplanquellen und Materialien.
 */

import { isNull } from "drizzle-orm";
import type { SourceEntry } from "@/lib/types";
import type { SourceEntriesReader } from "@/lib/repositories";
import { db } from "@/lib/db/client";
import { sourceRef } from "@/lib/db/schema/artifacts";

/**
 * Mapping source_trust (DB-Enum) → UI SourceTrust.
 *
 * Die UI-Union kennt nur vier Stufen; DB-OPEN_CURATED hat kein direktes
 * Gegenstück. Fail-safe: OPEN_CURATED → "UNVERIFIED", damit die Quelle
 * in der UI sichtbar bleibt und manuell geprüft werden kann.
 * Eine spätere UI-Erweiterung kann OPEN_CURATED als eigene Stufe einführen.
 *
 * UNVERIFIED bleibt sichtbar — Governance verdeckt nichts.
 */
const trustToUi: Record<string, SourceEntry["trust"]> = {
  OFFICIAL_BINDING: "OFFICIAL_BINDING",
  OFFICIAL_GUIDANCE: "OFFICIAL_GUIDANCE",
  OPEN_CURATED: "UNVERIFIED", // kein UI-Gegenstück in M1; fail-safe bis zur UI-Erweiterung
  USER_APPROVED: "USER_APPROVED",
  UNVERIFIED: "UNVERIFIED",
};

export class PgSourcesRepository implements SourceEntriesReader {
  async entries(): Promise<SourceEntry[]> {
    const rows = await db
      .select()
      .from(sourceRef)
      .where(isNull(sourceRef.deletedAt));

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      origin: r.uri ?? "—",
      // subject/gradeRange erfordern einen Join auf Artefakt/Strang —
      // wird in einer Folgeiteration ergänzt; hier neutraler Default.
      subject: "deutsch" as const,
      gradeRange: "—",
      trust: trustToUi[r.sourceType] ?? "UNVERIFIED",
      version: "—",
      license: "—",
      status: "active" as const,
    }));
  }
}
