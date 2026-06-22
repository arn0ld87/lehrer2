/**
 * source-lifecycle.test.ts
 *
 * Testet PgSourcesRepository-Lebenszyklus + Trust-Gate + Konfessions-CHECK
 * gegen die echte Test-DB (Testcontainers, global-setup läuft automatisch).
 *
 * file-unique Prefix: "sltest-" für alle UUIDs und E-Mails.
 */

import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sourceRef } from "@/lib/db/schema/artifacts";
import { PgSourcesRepository } from "@/lib/db/repositories/sources.pg";

// ---------------------------------------------------------------------------
// Verbindung zur Test-DB (identisches Muster wie curriculum-constraints.test.ts)
// ---------------------------------------------------------------------------

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client);

afterAll(async () => {
  await client.end();
});

// ---------------------------------------------------------------------------
// Hilfsfunktion: legt eine minimale Quelle mit Status DISCOVERED an
// (direkter DB-Insert, kein Repository, um den Ausgangszustand zu kontrollieren)
// ---------------------------------------------------------------------------

async function insertDiscovered(
  id: string,
  opts: {
    sourceType?: (typeof sourceRef.$inferInsert)["sourceType"];
    licenseVerified?: boolean;
    subjectAlignment?: (typeof sourceRef.$inferInsert)["subjectAlignment"];
    confessionContext?: (typeof sourceRef.$inferInsert)["confessionContext"];
  } = {},
) {
  await db.insert(sourceRef).values({
    id,
    title: `Test-Quelle ${id}`,
    sourceType: opts.sourceType ?? "OFFICIAL_GUIDANCE",
    licenseVerified: opts.licenseVerified ?? false,
    lifecycleStatus: "DISCOVERED",
    subjectAlignment: opts.subjectAlignment,
    confessionContext: opts.confessionContext,
  });
}

// ---------------------------------------------------------------------------
// (a) DISCOVERED -> REGISTERED -> APPROVE schlägt fehl ohne licenseVerified
// ---------------------------------------------------------------------------

describe("(a) approve() ohne licenseVerified schlägt fehl", () => {
  it("wirft, wenn licenseVerified=false nach register()", async () => {
    const id = "a1a1a1a1-5151-0000-0000-000000000001";
    await insertDiscovered(id, { sourceType: "OFFICIAL_GUIDANCE", licenseVerified: false });

    const repo = new PgSourcesRepository();

    // register() ohne licenseVerified=true
    await repo.register(id, { licenseInfo: "CC-BY-SA" });

    // approve() muss scheitern, weil licenseVerified noch false ist
    await expect(repo.approve(id, {})).rejects.toThrow(/licenseVerified/);
  });
});

// ---------------------------------------------------------------------------
// (b) Mit licenseVerified=true + sourceType != UNVERIFIED -> APPROVED ok
// ---------------------------------------------------------------------------

describe("(b) Vollständiger Happy-Path DISCOVERED -> REGISTERED -> APPROVED", () => {
  it("approve() gelingt mit licenseVerified=true und nicht-UNVERIFIED sourceType", async () => {
    const id = "b2b2b2b2-5151-0000-0000-000000000002";
    await insertDiscovered(id, { sourceType: "OFFICIAL_BINDING", licenseVerified: false });

    const repo = new PgSourcesRepository();

    await repo.register(id, { licenseInfo: "Open Gov", licenseVerified: true });
    await repo.approve(id, { approvalMetadata: { approvedBy: "sltest-teacher" } });

    const entry = await repo.get(id);
    expect(entry).not.toBeNull();
    expect(entry!.status).toBe("active");
  });
});

// ---------------------------------------------------------------------------
// (c) UNVERIFIED kann nie APPROVED werden
// ---------------------------------------------------------------------------

describe("(c) sourceType=UNVERIFIED darf nie APPROVED werden", () => {
  it("approve() wirft für UNVERIFIED, auch wenn licenseVerified=true", async () => {
    const id = "c3c3c3c3-5151-0000-0000-000000000003";
    // direkt mit licenseVerified=true einfügen, damit Gate (b) nicht zuerst greift
    await db.insert(sourceRef).values({
      id,
      title: `Unverified ${id}`,
      sourceType: "UNVERIFIED",
      licenseVerified: true,
      lifecycleStatus: "REGISTERED",
    });

    const repo = new PgSourcesRepository();

    await expect(repo.approve(id, {})).rejects.toThrow(/UNVERIFIED/);
  });
});

// ---------------------------------------------------------------------------
// (d) DB-CHECK source_confession_subject_valid — source_ref-Ebene
// ---------------------------------------------------------------------------

describe("(d) DB-CHECK: RELIGION muss Konfessions-Kontext haben", () => {
  it("lehnt RELIGION + NICHT_ANWENDBAR ab", async () => {
    await expect(
      db.insert(sourceRef).values({
        id: "d4d4d4d4-5151-0000-0000-000000000004",
        title: "Religion ohne Konfession",
        sourceType: "UNVERIFIED",
        subjectAlignment: "RELIGION",
        confessionContext: "NICHT_ANWENDBAR",
        lifecycleStatus: "DISCOVERED",
      }),
    ).rejects.toThrow();
  });

  it("akzeptiert RELIGION + EVANGELISCH", async () => {
    const [row] = await db
      .insert(sourceRef)
      .values({
        id: "d5d5d5d5-5151-0000-0000-000000000005",
        title: "Evangelische Religion Quelle",
        sourceType: "OFFICIAL_GUIDANCE",
        subjectAlignment: "RELIGION",
        confessionContext: "EVANGELISCH",
        lifecycleStatus: "DISCOVERED",
      })
      .returning();
    expect(row.subjectAlignment).toBe("RELIGION");
    expect(row.confessionContext).toBe("EVANGELISCH");
  });
});

// ---------------------------------------------------------------------------
// (e) DEUTSCH + KATHOLISCH wird abgelehnt
// ---------------------------------------------------------------------------

describe("(e) DB-CHECK: DEUTSCH + KATHOLISCH abgelehnt", () => {
  it("lehnt DEUTSCH + KATHOLISCH ab", async () => {
    await expect(
      db.insert(sourceRef).values({
        id: "e6e6e6e6-5151-0000-0000-000000000006",
        title: "Katholischer Deutschunterricht",
        sourceType: "UNVERIFIED",
        subjectAlignment: "DEUTSCH",
        confessionContext: "KATHOLISCH",
        lifecycleStatus: "DISCOVERED",
      }),
    ).rejects.toThrow();
  });

  it("akzeptiert DEUTSCH + NICHT_ANWENDBAR", async () => {
    const [row] = await db
      .insert(sourceRef)
      .values({
        id: "e7e7e7e7-5151-0000-0000-000000000007",
        title: "Deutschunterricht Quelle",
        sourceType: "OFFICIAL_GUIDANCE",
        subjectAlignment: "DEUTSCH",
        confessionContext: "NICHT_ANWENDBAR",
        lifecycleStatus: "DISCOVERED",
      })
      .returning();
    expect(row.subjectAlignment).toBe("DEUTSCH");
    expect(row.confessionContext).toBe("NICHT_ANWENDBAR");
  });
});
