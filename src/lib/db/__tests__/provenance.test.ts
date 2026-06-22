import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { auditLog } from "@/lib/db/schema/provenance";
import { worksheet } from "@/lib/db/schema/artifacts";
import { user } from "@/lib/db/schema/auth";
import { curriculumStrand } from "@/lib/db/schema/curriculum";
import { teachingUnit } from "@/lib/db/schema/artifacts";
import { softDeleteWorksheetWithAudit } from "@/lib/db/repositories/deletion";

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client, { schema }) as Db;

afterAll(async () => {
  await client.end();
});

describe("Löschung schreibt Audit-Log", () => {
  it("soft-delete einer nicht existierenden ID schlägt fehl und schreibt keinen Audit-Eintrag", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const beforeCount = (await db.select().from(auditLog)).length;

    await expect(
      softDeleteWorksheetWithAudit(db, nonExistentId, "actor-x"),
    ).rejects.toThrow();

    const afterCount = (await db.select().from(auditLog)).length;
    expect(afterCount).toBe(beforeCount);
  });

  it("soft-delete erzeugt audit_log-Eintrag", async () => {
    // Arrange: Seed teacher user (FILE-UNIQUE)
    const teacherId = "t-prov";
    await db
      .insert(user)
      .values({
        id: teacherId,
        name: "Prov",
        email: "prov@example.org",
      })
      .onConflictDoNothing()
      .returning();

    // Create a DEUTSCH curriculum strand (Sek I, konfessionssensibel ist nicht erlaubt für DEUTSCH, also NICHT_ANWENDBAR)
    const [strand] = await db
      .insert(curriculumStrand)
      .values({
        subject: "DEUTSCH",
        confessionContext: "NICHT_ANWENDBAR",
        schoolStage: "SEK_I",
        frameworkAuthority: "LSA",
        validFrom: "2020-08-01",
        version: "1.0.0",
      })
      .onConflictDoNothing()
      .returning();

    // Create a teaching unit
    const [unit] = await db
      .insert(teachingUnit)
      .values({
        title: "Test Unit",
        strandId: strand.id,
        gradeBand: "KS9",
        ownerTeacherId: teacherId,
      })
      .onConflictDoNothing()
      .returning();

    // Create a worksheet
    const [ws] = await db
      .insert(worksheet)
      .values({
        unitId: unit.id,
        title: "Test Worksheet",
        ownerTeacherId: teacherId,
      })
      .onConflictDoNothing()
      .returning();

    // Act: Soft-delete the worksheet with audit logging
    await softDeleteWorksheetWithAudit(db, ws.id, teacherId);

    // Assert: Check audit log entry exists
    const logs = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.eventType, "soft_delete_worksheet"));

    expect(logs.length).toBeGreaterThan(0);

    // Assert: Check worksheet is soft-deleted (deletedAt is not null)
    const [deletedWs] = await db.select().from(worksheet).where(eq(worksheet.id, ws.id));
    expect(deletedWs?.deletedAt).not.toBeNull();
  });
});
