/**
 * process-ocr-job.test.ts — Integration-Test für processOcrJob (#40)
 *
 * Nutzung: FakeOcrEngine + FakeEmbedder + FakeVectorStore + Testcontainers-PG
 * (gleiche Muster wie ingest.test.ts)
 *
 * Prüft:
 *   - Scan-Quelle (leeres pdf-parse) wird per FakeOcrEngine gechunkt/ingestiert
 *     → rag_chunk-Rows > 0, lifecycleStatus = INGESTED
 *   - FakeOcrEngine liefert leer → ExtractionFailedError (fail-laut)
 *
 * pdf-parse wird gemockt (leerer Text), damit kein echtes Scan-PDF nötig ist.
 */

import { afterAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

// ── pdf-parse mock (Scan-PDF-Simulation) ─────────────────────────────────
vi.mock("pdf-parse", () => {
  return {
    default: async (_buf: Buffer) => ({ text: "" }),
  };
});

import { FakeEmbedder } from "@/lib/infra/ollama";
import { FakeVectorStore } from "@/lib/infra/qdrant";
import { FakeBlobStore } from "@/lib/infra/minio";
import { sourceRef } from "@/lib/db/schema/artifacts";
import { ragChunk } from "@/lib/db/schema/rag";
import * as schema from "@/lib/db/schema";
import { FakeOcrEngine } from "../engine.js";
import { processOcrJob } from "../../../../../worker/ocr-worker.js";
import type { OcrJobDeps } from "../../../../../worker/ocr-worker.js";

// ── Test-DB-Verbindung ─────────────────────────────────────────────────────
const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client, { schema });

afterAll(async () => {
  await client.end();
});

// ── OCR-Text (ausreichend lang für Chunking) ──────────────────────────────
const OCR_TEXT =
  "Lehrplan Deutsch Sachsen-Anhalt Sekundarstufe I (OCR-Worker-Test, synthetisch): " +
  "Kompetenzbereiche umfassen Sprechen und Zuhören, Lesen und Umgang mit Texten sowie " +
  "Schreiben und Sprachreflexion. Schülerinnen und Schüler entwickeln im Verlauf der " +
  "Klassenstufen 5 bis 10 schrittweise kommunikative und analytische Fähigkeiten. " +
  "Verbindliche Themenfelder werden durch die zuständige Schulbehörde festgelegt. " +
  "Diese Passage dient ausschließlich als synthetisches Testdokument ohne curriculare Verbindlichkeit.";

if (OCR_TEXT.length <= 150) {
  throw new Error("OCR_TEXT zu kurz — Testsetup fehlerhaft");
}

const TS = Date.now();

// ── Hilfsfunktion: FakeBlobStore mit Pseudo-PDF befüllen ─────────────────
// pdf-parse ist gemockt → gibt leer zurück; der Blob-Inhalt ist irrelevant.
// Wichtig: URI muss auf .pdf enden, damit guessMime "application/pdf" liefert.
function makePdfBlob(sourceRefId: string): FakeBlobStore {
  const blob = new FakeBlobStore();
  const key = `sources/${sourceRefId}/v1`;
  const buf = new TextEncoder().encode("%PDF-1.4 (scan-fake)");
  blob.putObject(key, buf, "application/pdf").catch(() => {});
  return blob;
}

// ─────────────────────────────────────────────────────────────────────────────
describe("processOcrJob — Positiv-Test (Scan-PDF per OCR ingestieren)", () => {
  it(
    "ingestiert APPROVED-Scan-PDF per FakeOcrEngine; rag_chunk > 0, lifecycleStatus = INGESTED",
    async () => {
      const store = new FakeVectorStore();
      const embedder = new FakeEmbedder(8);
      const ocr = new FakeOcrEngine(OCR_TEXT); // simuliert erfolgreiche OCR

      // Quelle anlegen: APPROVED, URI endet auf .pdf → guessMime → application/pdf
      const [row] = await db
        .insert(sourceRef)
        .values({
          title: `OCR-Job-Test-Positiv-${TS}`,
          sourceType: "OFFICIAL_BINDING",
          licenseVerified: true,
          lifecycleStatus: "APPROVED",
          subjectAlignment: "DEUTSCH",
          confessionContext: "NICHT_ANWENDBAR",
          uri: `file://ocr-scan-test-${TS}.pdf`,
        })
        .returning();

      const blob = makePdfBlob(row.id);
      const deps: OcrJobDeps = { db, store, blob, embedder, ocr };

      // ── Act ──────────────────────────────────────────────────────────────
      const result = await processOcrJob(deps, { sourceRefId: row.id });

      // ── Assert: Rückgabewert ─────────────────────────────────────────────
      expect(result.chunkCount).toBeGreaterThan(0);

      // ── Assert: rag_chunk-Rows in DB ────────────────────────────────────
      const chunkRows = await db
        .select()
        .from(ragChunk)
        .where(eq(ragChunk.sourceRefId, row.id));
      expect(chunkRows.length).toBeGreaterThan(0);

      // ── Assert: lifecycleStatus = INGESTED ───────────────────────────────
      const [updated] = await db
        .select()
        .from(sourceRef)
        .where(eq(sourceRef.id, row.id));
      expect(updated.lifecycleStatus).toBe("INGESTED");

      // ── Assert: FakeVectorStore-Punkte vorhanden ─────────────────────────
      const storePoints = await store.search([], {}, 1000);
      expect(storePoints.length).toBeGreaterThan(0);
      for (const point of storePoints) {
        expect(point.payload.source_id).toBe(row.id);
      }
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
describe("processOcrJob — Negativ-Test (OCR liefert leer, fail-laut)", () => {
  it(
    "wirft ExtractionFailedError, wenn FakeOcrEngine leer liefert; rag_chunk bleibt leer",
    async () => {
      const store = new FakeVectorStore();
      const embedder = new FakeEmbedder(8);
      const ocr = new FakeOcrEngine(""); // leeres OCR-Ergebnis

      const [row] = await db
        .insert(sourceRef)
        .values({
          title: `OCR-Job-Test-Negativ-${TS}`,
          sourceType: "OFFICIAL_BINDING",
          licenseVerified: true,
          lifecycleStatus: "APPROVED",
          subjectAlignment: "DEUTSCH",
          confessionContext: "NICHT_ANWENDBAR",
          uri: `file://ocr-scan-empty-${TS}.pdf`,
        })
        .returning();

      const blob = makePdfBlob(row.id);
      const deps: OcrJobDeps = { db, store, blob, embedder, ocr };

      // ── Act: muss ExtractionFailedError werfen (fail-laut) ───────────────
      const { ExtractionFailedError } = await import("@/lib/rag/extract");
      const err = await processOcrJob(deps, { sourceRefId: row.id }).catch((e) => e);

      expect(err).toBeInstanceOf(ExtractionFailedError);
      expect(err.message).toMatch(/OCR.*leer/i);

      // ── Assert: rag_chunk bleibt leer ────────────────────────────────────
      const chunkRows = await db
        .select()
        .from(ragChunk)
        .where(eq(ragChunk.sourceRefId, row.id));
      expect(chunkRows).toHaveLength(0);

      // ── Assert: lifecycleStatus bleibt APPROVED ──────────────────────────
      const [notIngested] = await db
        .select()
        .from(sourceRef)
        .where(eq(sourceRef.id, row.id));
      expect(notIngested.lifecycleStatus).toBe("APPROVED");
    },
  );
});
