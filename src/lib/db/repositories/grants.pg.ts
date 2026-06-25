/**
 * PgGrantReader — implementiert GrantReader gegen die Postgres-DB.
 *
 * Datenschutz: kein Schüler-PII; die Tabelle enthält ausschließlich
 * administrative Freigabe-Metadaten (Rechtsgrundlage, Provider, Scope).
 *
 * Fail-closed: getActiveGrant() gibt null zurück, wenn kein aktiver,
 * zeitlich gültiger Grant für Provider + Scope existiert. Der Aufrufer
 * (gate.ts) blockiert den Cloud-Provider-Call in diesem Fall.
 *
 * Zeitgültigkeitsprüfung via SQL now() (nicht JS Date), um Clock-Drift
 * zwischen App-Server und DB zu vermeiden (INTEGRATION_BOUNDARIES.md §2).
 */

import { and, eq, lte, gte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { cloudReleaseGrant } from "@/lib/db/schema/grants";
import type { GrantReader } from "@/lib/llm/gate";

export class PgGrantReader implements GrantReader {
  /**
   * Gibt den ersten aktiven Grant zurück, der zu Provider + Scope passt,
   * oder null wenn kein solcher Grant existiert.
   *
   * Bedingungen (alle müssen erfüllt sein):
   *   1. schoolId und provider stimmen überein.
   *   2. now() liegt zwischen validFrom und validUntil (inklusiv).
   *   3. scopeSubjects ist leer (= alle Fächer) ODER subject kommt darin vor.
   *   4. scopeGradeBands ist leer (= alle Stufen) ODER gradeBand kommt darin vor.
   */
  async getActiveGrant(args: {
    schoolId: string;
    provider: string;
    subject?: string;
    gradeBand?: string;
  }): Promise<{ id: string } | null> {
    const { schoolId, provider, subject, gradeBand } = args;

    const now = sql`now()`;

    const subjectFilter =
      subject !== undefined
        ? or(
            sql`array_length(${cloudReleaseGrant.scopeSubjects}, 1) IS NULL`,
            sql`${subject} = ANY(${cloudReleaseGrant.scopeSubjects})`,
          )
        : sql`true`;

    const gradeBandFilter =
      gradeBand !== undefined
        ? or(
            sql`array_length(${cloudReleaseGrant.scopeGradeBands}, 1) IS NULL`,
            sql`${gradeBand} = ANY(${cloudReleaseGrant.scopeGradeBands})`,
          )
        : sql`true`;

    const rows = await db
      .select({ id: cloudReleaseGrant.id })
      .from(cloudReleaseGrant)
      .where(
        and(
          eq(cloudReleaseGrant.schoolId, schoolId),
          eq(cloudReleaseGrant.provider, provider),
          lte(cloudReleaseGrant.validFrom, now),
          gte(cloudReleaseGrant.validUntil, now),
          subjectFilter,
          gradeBandFilter,
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }
}
