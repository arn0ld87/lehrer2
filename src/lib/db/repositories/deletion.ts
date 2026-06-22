import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { worksheet } from "@/lib/db/schema/artifacts";
import { auditLog } from "@/lib/db/schema/provenance";

/** Soft-Delete eines Worksheets mit Audit-Eintrag in einer Transaktion. */
export async function softDeleteWorksheetWithAudit(
  db: Db,
  worksheetId: string,
  actorId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(worksheet).set({ deletedAt: new Date() }).where(eq(worksheet.id, worksheetId));
    await tx.insert(auditLog).values({
      eventType: "soft_delete_worksheet",
      actorId,
      subject: "worksheet_deletion",
      details: { worksheetId },
      severity: "info",
    });
  });
}
