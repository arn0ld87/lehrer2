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
import { sourceRef } from "@/lib/db/schema/artifacts";
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
