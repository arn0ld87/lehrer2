/**
 * DB-Test: PgSourcesRepository.entries()
 *
 * Nutzt den Testcontainers-PostgreSQL-Container aus global-setup.ts.
 * Insertiert direkt in source_ref (ownerTeacherId ist nullable — kein User nötig).
 * Prüft: aktive Quellen erscheinen, soft-deleted Quellen werden gefiltert.
 */

import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import {
  sourceRef,
  teachingUnit,
  worksheet,
  worksheetSourceRef,
} from "@/lib/db/schema/artifacts";
import { curriculumStrand } from "@/lib/db/schema/curriculum";
import { user } from "@/lib/db/schema/auth";
import { PgSourcesRepository } from "@/lib/db/repositories/sources.pg";

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client);

afterAll(async () => {
  await client.end();
});

describe("PgSourcesRepository.entries()", () => {
  it("gibt aktive sourceRef-Einträge zurück und filtert soft-deleted heraus", async () => {
    // --- Arrange: aktive Quelle einfügen ---
    const [active] = await db
      .insert(sourceRef)
      .values({
        contentHash: "h1-sources-repo-test",
        sourceType: "OFFICIAL_BINDING",
        title: "Lehrplan Deutsch LSA",
      })
      .returning();

    expect(active.id).toBeDefined();

    // --- Arrange: soft-deleted Quelle einfügen ---
    const [deleted] = await db
      .insert(sourceRef)
      .values({
        contentHash: "h2-sources-repo-test-deleted",
        sourceType: "UNVERIFIED",
        title: "Gelöschte Testquelle",
      })
      .returning();

    // Sofort soft-löschen
    await db
      .update(sourceRef)
      .set({ deletedAt: new Date() })
      .where(eq(sourceRef.id, deleted.id));

    // --- Act ---
    const repo = new PgSourcesRepository();
    const entries = await repo.entries();

    // --- Assert: aktive Quelle vorhanden ---
    const found = entries.find((e) => e.id === active.id);
    expect(found).toBeDefined();
    expect(found!.trust).toBe("OFFICIAL_BINDING");
    expect(found!.title).toBe("Lehrplan Deutsch LSA");

    // --- Assert: soft-deleted Quelle ausgeschlossen ---
    const shouldBeAbsent = entries.find((e) => e.id === deleted.id);
    expect(shouldBeAbsent).toBeUndefined();
  });

  it("mapped OPEN_CURATED korrekt in die UI (1:1 Trust-Mapping)", async () => {
    // --- Arrange: Quelle mit OPEN_CURATED einfügen ---
    const [curated] = await db
      .insert(sourceRef)
      .values({
        contentHash: "h3-sources-repo-open-curated",
        sourceType: "OPEN_CURATED",
        title: "Kuratierte offene Quelle",
      })
      .returning();

    expect(curated.id).toBeDefined();

    // --- Act ---
    const repo = new PgSourcesRepository();
    const entries = await repo.entries();

    // --- Assert: OPEN_CURATED wird nicht zu UNVERIFIED gemappt ---
    const found = entries.find((e) => e.id === curated.id);
    expect(found).toBeDefined();
    expect(found!.trust).toBe("OPEN_CURATED");
    expect(found!.title).toBe("Kuratierte offene Quelle");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// #39 — Konfession sichtbar: subject/Konfession real auflösen, kein "deutsch"-Placeholder
// ─────────────────────────────────────────────────────────────────────────────
describe("PgSourcesRepository — Konfessionsauflösung (#39)", () => {
  it("löst eine RELIGION-ev-Quelle OHNE subjectAlignment über den Curriculum-Join als 'evangelische-religion' auf (nicht 'deutsch')", async () => {
    const repo = new PgSourcesRepository();

    // Lehrkraft (owner für unit/worksheet)
    const [teacher] = await db
      .insert(user)
      .values({
        id: "t-39-ev",
        name: "Konfession Test",
        email: "konf-39@example.org",
      })
      .returning();

    // Strang: Ev. Religion
    const [strand] = await db
      .insert(curriculumStrand)
      .values({
        subject: "RELIGION",
        confessionContext: "EVANGELISCH",
        schoolStage: "SEK_I",
        frameworkAuthority: "Test Authority",
        validFrom: "2024-01-01",
        version: "1.0.0",
      })
      .returning();

    const [unit] = await db
      .insert(teachingUnit)
      .values({
        title: "Reformation",
        strandId: strand.id,
        gradeBand: "KS9",
        ownerTeacherId: teacher.id,
      })
      .returning();

    const [ws] = await db
      .insert(worksheet)
      .values({
        unitId: unit.id,
        title: "AB Reformation",
        ownerTeacherId: teacher.id,
      })
      .returning();

    // Quelle OHNE subjectAlignment — würde unter dem alten Placeholder als "deutsch" erscheinen
    const [src] = await db
      .insert(sourceRef)
      .values({
        contentHash: "h-39-ev",
        sourceType: "OFFICIAL_BINDING",
        title: "Fachlehrplan Ev. Religion LSA",
        // subjectAlignment / confessionContext bewusst NICHT gesetzt
      })
      .returning();

    await db
      .insert(worksheetSourceRef)
      .values({ worksheetId: ws.id, sourceRefId: src.id });

    // --- Act ---
    const entries = await repo.entries();
    const found = entries.find((e) => e.id === src.id);

    // --- Assert: real als Ev. Religion aufgelöst, NICHT als Deutsch ---
    expect(found).toBeDefined();
    expect(found!.subject).toBe("evangelische-religion");
    expect(found!.subject).not.toBe("deutsch");
  });

  it("mapped eine Quelle mit direktem subjectAlignment=RELIGION/KATHOLISCH als 'katholische-religion'", async () => {
    const repo = new PgSourcesRepository();

    const [src] = await db
      .insert(sourceRef)
      .values({
        contentHash: "h-39-kath",
        sourceType: "OFFICIAL_BINDING",
        title: "Fachlehrplan Kath. Religion LSA",
        subjectAlignment: "RELIGION",
        confessionContext: "KATHOLISCH",
      })
      .returning();

    const entries = await repo.entries();
    const found = entries.find((e) => e.id === src.id);

    expect(found).toBeDefined();
    expect(found!.subject).toBe("katholische-religion");
  });
});
