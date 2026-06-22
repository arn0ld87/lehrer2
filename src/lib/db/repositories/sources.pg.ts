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
