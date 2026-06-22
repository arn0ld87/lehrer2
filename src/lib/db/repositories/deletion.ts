import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { sourceRef, worksheet } from "@/lib/db/schema/artifacts";
import { auditLog } from "@/lib/db/schema/provenance";

/** Soft-Delete eines Worksheets mit Audit-Eintrag in einer Transaktion. */
export async function softDeleteWorksheetWithAudit(
  db: Db,
  worksheetId: string,
  actorId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(worksheet)
      .set({ deletedAt: new Date() })
      .where(eq(worksheet.id, worksheetId))
      .returning();
    if (!updated) throw new Error(`Worksheet ${worksheetId} nicht gefunden`);
    await tx.insert(auditLog).values({
      eventType: "soft_delete_worksheet",
      actorId,
      subject: "worksheet_deletion",
      details: { worksheetId },
      severity: "info",
    });
  });
}

/**
 * Widerruft eine Quelle (sourceRef) und schreibt einen Audit-Eintrag.
 *
 * Transaktion:
 *   1. UPDATE sourceRef SET lifecycleStatus = "REVOKED" (benannte Methode, kein ad-hoc-SQL)
 *   2. INSERT audit_log (eventType "revoke_source_ref")
 *
 * Wirft, wenn die Quelle nicht existiert.
 * Spiegelt das Muster von softDeleteWorksheetWithAudit.
 */
export async function revokeSourceRefWithAudit(
  db: Db,
  id: string,
  actorId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(sourceRef)
      .set({ lifecycleStatus: "REVOKED" })
      .where(eq(sourceRef.id, id))
      .returning();
    if (!updated) throw new Error(`sourceRef ${id} nicht gefunden`);
    await tx.insert(auditLog).values({
      eventType: "revoke_source_ref",
      actorId,
      subject: "source_ref_revocation",
      details: { sourceRefId: id },
      severity: "warning",
    });
  });
}
