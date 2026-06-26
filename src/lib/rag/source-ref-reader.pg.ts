/**
 * PgSourceRefReader — Postgres-Implementierung von SourceRefReader.
 *
 * Wird in retrieve() als Abhängigkeit injiziert (kein direkter DB-Zugriff
 * im Retrieval-Kern). Ermöglicht eine Fake-Implementierung in Tests.
 *
 * Datenschutz: source_ref enthält ausschließlich Quellen-Metadaten,
 * kein Schüler-PII.
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sourceRef } from "@/lib/db/schema/artifacts";
import type { SourceRefReader } from "./retrieve";
import type { SourceRefMeta } from "./citation";

export class PgSourceRefReader implements SourceRefReader {
  /**
   * Liest die Metadaten einer sourceRef-Zeile anhand ihrer UUID.
   * Gibt null zurück, wenn die Quelle nicht gefunden wird.
   *
   * Gemappte Spalten (snake_case DB → camelCase Interface):
   *   id               → id
   *   title            → title
   *   uri              → uri
   *   author_organization → authorOrganization
   *   license_info     → licenseInfo
   *   retrieved_at     → retrievedAt
   *   source_version   → sourceVersion
   *   content_hash     → contentHash
   */
  async getById(sourceId: string): Promise<SourceRefMeta | null> {
    const rows = await db
      .select({
        id: sourceRef.id,
        title: sourceRef.title,
        uri: sourceRef.uri,
        authorOrganization: sourceRef.authorOrganization,
        licenseInfo: sourceRef.licenseInfo,
        retrievedAt: sourceRef.retrievedAt,
        sourceVersion: sourceRef.sourceVersion,
        contentHash: sourceRef.contentHash,
      })
      .from(sourceRef)
      .where(eq(sourceRef.id, sourceId))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      title: row.title,
      uri: row.uri ?? null,
      authorOrganization: row.authorOrganization ?? null,
      licenseInfo: row.licenseInfo ?? null,
      retrievedAt: row.retrievedAt ?? null,
      sourceVersion: row.sourceVersion,
      contentHash: row.contentHash ?? null,
    };
  }
}
