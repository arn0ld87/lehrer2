/**
 * scripts/__tests__/seed-sources.test.ts
 *
 * Testet Idempotenz des Source-Seeds gegen die Test-DB (Testcontainers).
 * file-unique Prefix: keiner nötig, da seedSources nur DB-Zustand testet
 */

import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { sourceRef } from "@/lib/db/schema/artifacts";
import { seedSources } from "../seed-sources";

// ---------------------------------------------------------------------------
// Verbindung zur Test-DB (identisches Muster wie source-lifecycle.test.ts)
// ---------------------------------------------------------------------------

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client, { schema });

afterAll(async () => {
  await client.end();
});

// ---------------------------------------------------------------------------
// Haupttest: Idempotenz
// ---------------------------------------------------------------------------

describe("scripts/seed-sources — Idempotenztest", () => {
  it("seedSources ist idempotent: zweiter Lauf erzeugt keine Duplikate", async () => {
    // Zähle source_refs mit gesetztem sourceSeedId VOR dem ersten Seed
    const countBefore = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(sourceRef)
      .where(sql`${sourceRef.approvalMetadata}->>'sourceSeedId' IS NOT NULL`);

    const seededBefore = countBefore[0]?.count ?? 0;

    // Führe seedSources zum ersten Mal aus
    const resultFirstRun = await seedSources(db);
    expect(resultFirstRun.inserted).toBeGreaterThan(0);
    expect(resultFirstRun.skipped).toBe(0);

    // Zähle nach dem ersten Lauf
    const countAfterFirst = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(sourceRef)
      .where(sql`${sourceRef.approvalMetadata}->>'sourceSeedId' IS NOT NULL`);

    const seededAfterFirst = countAfterFirst[0]?.count ?? 0;

    // Überprüfe: erste Runde sollte neue Quellen eingefügt haben
    expect(seededAfterFirst).toBe(seededBefore + resultFirstRun.inserted);

    // Führe seedSources zum zweiten Mal aus
    const resultSecondRun = await seedSources(db);

    // Zweiter Lauf: alle sollten übersprungen werden (idempotent)
    expect(resultSecondRun.inserted).toBe(0);
    expect(resultSecondRun.skipped).toBe(resultFirstRun.inserted);

    // Zähle nach dem zweiten Lauf
    const countAfterSecond = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(sourceRef)
      .where(sql`${sourceRef.approvalMetadata}->>'sourceSeedId' IS NOT NULL`);

    const seededAfterSecond = countAfterSecond[0]?.count ?? 0;

    // Kritischer Check: Anzahl der seeded sources sollte gleich bleiben
    expect(seededAfterSecond).toBe(seededAfterFirst);

    // Zusatz-Validierung: alle sourceSeedIds müssen UNIQUE sein (keine Duplikate)
    const allSeeded = await db
      .select({ seedId: sourceRef.approvalMetadata })
      .from(sourceRef)
      .where(sql`${sourceRef.approvalMetadata}->>'sourceSeedId' IS NOT NULL`);

    const seedIdSet = new Set<string>();
    for (const row of allSeeded) {
      const metadata = row.seedId as Record<string, unknown> | null;
      if (metadata && typeof metadata.sourceSeedId === "string") {
        seedIdSet.add(metadata.sourceSeedId);
      }
    }

    // Anzahl unique seed IDs sollte Gesamtzahl gleichen (keine Duplikate)
    expect(seedIdSet.size).toBe(seededAfterSecond);
  });
});
