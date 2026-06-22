/**
 * ingest.test.ts — Integrations-Test für ingestSource
 *
 * Nutzt FakeEmbedder + FakeVectorStore + echter Test-DB (Testcontainers via globalSetup).
 *
 * Garantien, die geprüft werden:
 *   NEGATIV – GATE fail-closed:
 *     - lifecycleStatus === "REGISTERED" (nicht APPROVED): wirft; FakeVectorStore hat 0 Punkte,
 *       rag_chunk hat 0 Rows für diese sourceRefId.
 *     - sourceType === "UNVERIFIED" (bei REGISTERED): wirft; gleiche Null-Invariante.
 *   POSITIV – Happy Path:
 *     - APPROVED, licenseVerified=true, sourceType=OFFICIAL_BINDING, synthetischer Plain-Text:
 *       FakeVectorStore-Punkte > 0; payload.trust_level === 'OFFICIAL_BINDING';
 *       rag_chunk-Rows > 0; sourceRef.lifecycleStatus === 'INGESTED'.
 *   DEDUP (#43):
 *     - contentHash bereits von anderer Quelle gehalten → DuplicateContentError (früh, vor Embedding).
 *     - normale Ingestion (einziger Hash) bleibt unberührt.
 *
 * File-unique IDs: Suffix "-ingest-test-<timestamp>" auf allen title/contentHash-Werten.
 */

import { afterAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

import { FakeEmbedder } from "@/lib/infra/ollama";
import { FakeVectorStore } from "@/lib/infra/qdrant";
import { FakeBlobStore } from "@/lib/infra/minio";
import { sourceRef } from "@/lib/db/schema/artifacts";
import { ragChunk } from "@/lib/db/schema/rag";
import * as schema from "@/lib/db/schema";
import { ingestSource, DuplicateContentError } from "@/lib/rag/ingest";

// ── Test-DB-Verbindung (gemeinsame DB aus globalSetup) ─────────────────────
const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client, { schema });

afterAll(async () => {
  await client.end();
});

// ── Hilfsfunktion: FakeBlob mit Plain-Text befüllen ────────────────────────
/**
 * Legt einen FakeBlobStore an, der den stabilen Blob-Key (#42)
 * "sources/<sourceRefId>/v<sourceVersion>" mit dem gegebenen Text belegt.
 * ingestSource lädt über blobKeyForSource(id, sourceVersion); die Test-Quellen
 * haben die Default-sourceVersion 1, daher "v1".
 */
function makeBlobWithText(sourceRefId: string, text: string): FakeBlobStore {
  const blob = new FakeBlobStore();
  const key = `sources/${sourceRefId}/v1`;
  const buf = new TextEncoder().encode(text);
  // Synchron füllen — putObject ist async, aber FakeBlobStore ist in-memory;
  // wir nutzen eine kleine Hilfskonstruktion:
  blob.putObject(key, buf, "text/plain").catch(() => {
    // Sollte nie feuern, FakeBlobStore ist synchron im Kern
  });
  return blob;
}

// ── Synthetischer Lehrplan-Text (>150 Zeichen, plain, kein Schüler-PII) ────
const SYNTHETIC_TEXT =
  "Lehrplan Deutsch Sachsen-Anhalt Sekundarstufe I: " +
  "Kompetenzbereiche umfassen Sprechen und Zuhören, Lesen und Umgang mit Texten sowie " +
  "Schreiben und Sprachreflexion. Schülerinnen und Schüler entwickeln im Verlauf der " +
  "Klassenstufen 5 bis 10 schrittweise kommunikative und analytische Fähigkeiten. " +
  "Verbindliche Themenfelder werden durch die zuständige Schulbehörde festgelegt. " +
  "Diese Passage dient ausschließlich als synthetisches Testdokument ohne curriculare Verbindlichkeit.";

// Sicherstellen: >150 Zeichen
if (SYNTHETIC_TEXT.length <= 150) {
  throw new Error("SYNTHETIC_TEXT zu kurz — Testsetup fehlerhaft");
}

// ── Gemeinsames Timestamp-Suffix für file-unique IDs ───────────────────────
const TS = Date.now();

// ─────────────────────────────────────────────────────────────────────────────
describe("ingestSource — GATE fail-closed (Negativ-Tests)", () => {
  // ── Negativ-Test 1: lifecycleStatus = REGISTERED (nicht APPROVED) ─────────
  it("wirft, wenn lifecycleStatus REGISTERED ist; FakeVectorStore + rag_chunk bleiben leer", async () => {
    const store = new FakeVectorStore();
    const embedder = new FakeEmbedder(8); // kleine Dimension für Test

    // Quelle mit lifecycleStatus=REGISTERED einfügen
    const [row] = await db
      .insert(sourceRef)
      .values({
        title: `Gate-Test-REGISTERED-${TS}`,
        sourceType: "OFFICIAL_BINDING",
        licenseVerified: true,
        lifecycleStatus: "REGISTERED",
        // contentHash absichtlich null lassen → blobKey = sources/<id>/raw
      })
      .returning();

    const blob = makeBlobWithText(row.id, SYNTHETIC_TEXT);
    const deps = { db, store, blob, embedder };

    // GATE muss feuern
    await expect(ingestSource(deps, row.id)).rejects.toThrow(/lifecycleStatus/);

    // FakeVectorStore: kein einziger Punkt
    const points = await store.search([], {}, 1000);
    expect(points).toHaveLength(0);

    // rag_chunk: keine Rows für diese sourceRefId
    const chunks = await db
      .select()
      .from(ragChunk)
      .where(eq(ragChunk.sourceRefId, row.id));
    expect(chunks).toHaveLength(0);
  });

  // ── Negativ-Test 2: sourceType = UNVERIFIED ────────────────────────────────
  it("wirft, wenn sourceType UNVERIFIED ist; FakeVectorStore + rag_chunk bleiben leer", async () => {
    const store = new FakeVectorStore();
    const embedder = new FakeEmbedder(8);

    // sourceType=UNVERIFIED, lifecycleStatus=APPROVED setzen, damit AUSSCHLIESSLICH
    // das UNVERIFIED-Gate feuern kann (saubere Isolation; das lifecycleStatus-Gate
    // wird separat in Negativ-Test 1 geprüft). Direkter DB-Insert, da approve()
    // für UNVERIFIED bereits werfen würde.
    const [row] = await db
      .insert(sourceRef)
      .values({
        title: `Gate-Test-UNVERIFIED-${TS}`,
        sourceType: "UNVERIFIED",
        licenseVerified: true,
        lifecycleStatus: "APPROVED",
      })
      .returning();

    const blob = makeBlobWithText(row.id, SYNTHETIC_TEXT);
    const deps = { db, store, blob, embedder };

    // GATE muss mit UNVERIFIED-Meldung feuern
    await expect(ingestSource(deps, row.id)).rejects.toThrow(/UNVERIFIED/);

    // FakeVectorStore: kein einziger Punkt
    const points = await store.search([], {}, 1000);
    expect(points).toHaveLength(0);

    // rag_chunk: keine Rows
    const chunks = await db
      .select()
      .from(ragChunk)
      .where(eq(ragChunk.sourceRefId, row.id));
    expect(chunks).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("ingestSource — GATE licenseVerified=false (Negativ-Test)", () => {
  it("wirft, wenn licenseVerified false ist; FakeVectorStore + rag_chunk bleiben leer", async () => {
    const store = new FakeVectorStore();
    const embedder = new FakeEmbedder(8);

    // sourceType != UNVERIFIED, lifecycleStatus = APPROVED → nur das
    // licenseVerified-Gate kann feuern (isolierte Prüfung des dritten Gates).
    const [row] = await db
      .insert(sourceRef)
      .values({
        title: `Gate-Test-LICENSE-${TS}`,
        sourceType: "OFFICIAL_BINDING",
        licenseVerified: false,
        lifecycleStatus: "APPROVED",
      })
      .returning();

    const blob = makeBlobWithText(row.id, SYNTHETIC_TEXT);
    const deps = { db, store, blob, embedder };

    await expect(ingestSource(deps, row.id)).rejects.toThrow(/licenseVerified/);

    const points = await store.search([], {}, 1000);
    expect(points).toHaveLength(0);

    const chunks = await db
      .select()
      .from(ragChunk)
      .where(eq(ragChunk.sourceRefId, row.id));
    expect(chunks).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("ingestSource — Happy Path (Positiv-Test)", () => {
  it(
    "ingestiert APPROVED/OFFICIAL_BINDING-Quelle; FakeVectorStore-Punkte > 0 mit trust_level=OFFICIAL_BINDING; rag_chunk > 0; lifecycleStatus=INGESTED",
    async () => {
      const store = new FakeVectorStore();
      const embedder = new FakeEmbedder(8);

      // Quelle anlegen: APPROVED, licenseVerified=true, OFFICIAL_BINDING
      // lifecycleStatus direkt auf APPROVED setzen (Integration testet ingestSource,
      // nicht den Lifecycle-Workflow — approve() wird in sources-repo.test.ts abgedeckt)
      const [row] = await db
        .insert(sourceRef)
        .values({
          title: `Happy-Path-OFFICIAL_BINDING-${TS}`,
          sourceType: "OFFICIAL_BINDING",
          licenseVerified: true,
          lifecycleStatus: "APPROVED",
          subjectAlignment: "DEUTSCH",
          confessionContext: "NICHT_ANWENDBAR",
          licenseInfo: "CC-BY 4.0",
          retrievedAt: new Date("2026-06-22T00:00:00Z"),
        })
        .returning();

      // Blob: Plain-Text unter dem stabilen Schlüssel, den ingestSource erwartet (#42)
      const blob = new FakeBlobStore();
      const blobKey = `sources/${row.id}/v1`; // sources/<id>/v<sourceVersion=1>
      await blob.putObject(
        blobKey,
        new TextEncoder().encode(SYNTHETIC_TEXT),
        "text/plain",
      );

      // URI muss auf .txt enden, damit guessMime "text/plain" liefert
      await db
        .update(sourceRef)
        .set({ uri: `file://synthetic-lehrplan-${TS}.txt` })
        .where(eq(sourceRef.id, row.id));

      const deps = { db, store, blob, embedder };

      // ── Act ──────────────────────────────────────────────────────────────
      const result = await ingestSource(deps, row.id);

      // ── Assert: Rückgabewert ─────────────────────────────────────────────
      expect(result.chunkCount).toBeGreaterThan(0);

      // ── Assert: FakeVectorStore hat Punkte mit korrektem payload.trust_level ─
      const storePoints = await store.search([], {}, 1000);
      expect(storePoints.length).toBeGreaterThan(0);

      for (const point of storePoints) {
        expect(point.payload.trust_level).toBe("OFFICIAL_BINDING");
        expect(point.payload.source_id).toBe(row.id);
      }

      // ── Assert: rag_chunk-Rows in der DB ────────────────────────────────
      const chunkRows = await db
        .select()
        .from(ragChunk)
        .where(eq(ragChunk.sourceRefId, row.id));
      expect(chunkRows.length).toBeGreaterThan(0);

      for (const chunk of chunkRows) {
        expect(chunk.trustLevel).toBe("OFFICIAL_BINDING");
        expect(chunk.sourceRefId).toBe(row.id);
      }

      // ── Assert: sourceRef.lifecycleStatus === 'INGESTED' ────────────────
      const [updated] = await db
        .select()
        .from(sourceRef)
        .where(eq(sourceRef.id, row.id));
      expect(updated.lifecycleStatus).toBe("INGESTED");
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// #41 — Kompensation löscht NUR die in diesem Lauf erzeugten Qdrant-Punkte
// ─────────────────────────────────────────────────────────────────────────────
describe("ingestSource — Kompensation gezielt (#41)", () => {
  it(
    "rollt bei PG-Fehler nur die neuen pointIds zurück; ein Rest-Punkt derselben source_id bleibt erhalten",
    async () => {
      const store = new FakeVectorStore();
      const embedder = new FakeEmbedder(8);

      const [row] = await db
        .insert(sourceRef)
        .values({
          title: `Kompensation-Test-${TS}`,
          sourceType: "OFFICIAL_BINDING",
          licenseVerified: true,
          lifecycleStatus: "APPROVED",
          subjectAlignment: "DEUTSCH",
          confessionContext: "NICHT_ANWENDBAR",
          uri: `file://kompensation-${TS}.txt`,
        })
        .returning();

      // Blob unter stabilem Key (#42)
      const blob = new FakeBlobStore();
      await blob.putObject(
        `sources/${row.id}/v1`,
        new TextEncoder().encode(SYNTHETIC_TEXT),
        "text/plain",
      );

      // Rest-Punkt eines „früheren Laufs" derselben source_id (stabile ID)
      await store.upsertPoints([
        {
          id: "residual-old-run",
          vector: [0, 0, 0, 0, 0, 0, 0, 0],
          payload: { source_id: row.id, trust_level: "OFFICIAL_BINDING" },
        },
      ]);

      // PG-Fehler erzwingen: kollidierenden rag_chunk vorab einfügen
      // (gleiches (sourceRefId, contentHash, sourceVersion=1) → Unique-Verletzung
      // beim Insert des realen Chunks → Kompensationspfad).
      const contentHash = createHash("sha256")
        .update(new TextEncoder().encode(SYNTHETIC_TEXT))
        .digest("hex");
      await db.insert(ragChunk).values({
        sourceRefId: row.id,
        chunkText:
          "Vorbelegter kollidierender Chunk mit ausreichender Mindestlaenge fuer den DB-Check.",
        pageOrSection: "—",
        sourceVersion: 1,
        contentHash,
        trustLevel: "OFFICIAL_BINDING",
      });

      const deps = { db, store, blob, embedder };

      // ── Act: Ingestion muss fehlschlagen (Unique-Verletzung) ──────────────
      await expect(ingestSource(deps, row.id)).rejects.toThrow();

      // ── Assert: Rest-Punkt überlebt, neue Lauf-Punkte sind weg ────────────
      // (frischer FakeVectorStore → nur Punkte dieses Tests/dieser source_id)
      const remaining = await store.search([], {}, 1000);
      const ids = remaining.map((p) => p.id);
      expect(ids).toContain("residual-old-run"); // breite Löschung hätte ihn entfernt
      expect(remaining).toHaveLength(1); // nur der Rest-Punkt, keine neuen Punkte
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// #43 — Dedup-Früherkennung: DuplicateContentError vor Embedding-Arbeit
// ─────────────────────────────────────────────────────────────────────────────
describe("ingestSource — Dedup-Früherkennung (#43)", () => {
  // ── Negativ-Test: contentHash bereits von anderer Quelle belegt ────────────
  it(
    "wirft DuplicateContentError, wenn contentHash von einer anderen Quelle bereits gehalten wird; FakeVectorStore bleibt leer",
    async () => {
      const store = new FakeVectorStore();
      const embedder = new FakeEmbedder(8);

      const DEDUP_TEXT =
        "Dedup-Testdokument Sachsen-Anhalt Lehrplan Dedup-Früherkennung-#43: " +
        "Dieser synthetische Text ist ausreichend lang, um gechunkt zu werden. " +
        "Er dient ausschließlich der Verifikation des Dedup-Checks in ingestSource. " +
        "Kein Schüler-PII, keine curriculare Verbindlichkeit. Pflichtlänge erfüllt.";

      const deduplicateHash = createHash("sha256")
        .update(new TextEncoder().encode(DEDUP_TEXT))
        .digest("hex");

      // Erste Quelle: bereits INGESTED mit gesetztem contentHash (simuliert abgeschlossene Ingestion)
      const [existingSource] = await db
        .insert(sourceRef)
        .values({
          title: `Dedup-Existing-${TS}`,
          sourceType: "OFFICIAL_BINDING",
          licenseVerified: true,
          lifecycleStatus: "INGESTED",
          contentHash: deduplicateHash,
          subjectAlignment: "DEUTSCH",
          confessionContext: "NICHT_ANWENDBAR",
          uri: `file://dedup-existing-${TS}.txt`,
        })
        .returning();

      // Zweite Quelle: APPROVED, wartet auf Ingestion — identischer Inhalt
      const [duplicateSource] = await db
        .insert(sourceRef)
        .values({
          title: `Dedup-Duplicate-${TS}`,
          sourceType: "OFFICIAL_BINDING",
          licenseVerified: true,
          lifecycleStatus: "APPROVED",
          subjectAlignment: "DEUTSCH",
          confessionContext: "NICHT_ANWENDBAR",
          uri: `file://dedup-duplicate-${TS}.txt`,
        })
        .returning();

      // Blob mit identischem Inhalt → gleicher contentHash
      const blob = new FakeBlobStore();
      await blob.putObject(
        `sources/${duplicateSource.id}/v1`,
        new TextEncoder().encode(DEDUP_TEXT),
        "text/plain",
      );

      const deps = { db, store, blob, embedder };

      // ── Act: muss DuplicateContentError werfen ────────────────────────────
      const err = await ingestSource(deps, duplicateSource.id).catch((e) => e);

      expect(err).toBeInstanceOf(DuplicateContentError);
      expect((err as DuplicateContentError).existingSourceRefId).toBe(existingSource.id);
      expect((err as DuplicateContentError).contentHash).toBe(deduplicateHash);
      expect(err.message).toMatch(/DuplicateContentError/);
      expect(err.message).toMatch(existingSource.id);

      // ── Assert: kein Qdrant-Punkt, kein rag_chunk für die Duplikat-Quelle ─
      const points = await store.search([], {}, 1000);
      expect(points).toHaveLength(0);

      const chunks = await db
        .select()
        .from(ragChunk)
        .where(eq(ragChunk.sourceRefId, duplicateSource.id));
      expect(chunks).toHaveLength(0);

      // lifecycleStatus bleibt APPROVED (nicht INGESTED)
      const [stillApproved] = await db
        .select()
        .from(sourceRef)
        .where(eq(sourceRef.id, duplicateSource.id));
      expect(stillApproved.lifecycleStatus).toBe("APPROVED");
    },
  );

  // ── Positiv-Test: einzigartiger contentHash → normale Ingestion ────────────
  it(
    "ingestiert erfolgreich, wenn kein anderer Datensatz denselben contentHash hält (kein Duplikat)",
    async () => {
      const store = new FakeVectorStore();
      const embedder = new FakeEmbedder(8);

      // Einzigartiger Text durch Timestamp — kein anderer Datensatz kann diesen Hash kennen
      const UNIQUE_TEXT =
        `Einzigartiger Dedup-Test-Text ${TS}-${Math.random()}: ` +
        "Lehrplan Sachsen-Anhalt Deutsch Sekundarstufe — synthetisch, kein Schüler-PII. " +
        "Dieser Text ist mit hoher Wahrscheinlichkeit einmalig in der Testdatenbank und " +
        "dient der Verifikation, dass normale Ingestionen durch den Dedup-Check nicht blockiert werden. " +
        "Pflichtlänge erfüllt.";

      const [source] = await db
        .insert(sourceRef)
        .values({
          title: `Dedup-Unique-${TS}`,
          sourceType: "OFFICIAL_BINDING",
          licenseVerified: true,
          lifecycleStatus: "APPROVED",
          subjectAlignment: "DEUTSCH",
          confessionContext: "NICHT_ANWENDBAR",
          uri: `file://dedup-unique-${TS}.txt`,
        })
        .returning();

      const blob = new FakeBlobStore();
      await blob.putObject(
        `sources/${source.id}/v1`,
        new TextEncoder().encode(UNIQUE_TEXT),
        "text/plain",
      );

      const deps = { db, store, blob, embedder };

      // ── Act: normale Ingestion muss durchlaufen ───────────────────────────
      const result = await ingestSource(deps, source.id);

      expect(result.chunkCount).toBeGreaterThan(0);

      // lifecycleStatus muss INGESTED sein
      const [ingested] = await db
        .select()
        .from(sourceRef)
        .where(eq(sourceRef.id, source.id));
      expect(ingested.lifecycleStatus).toBe("INGESTED");
    },
  );
});
