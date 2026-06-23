/**
 * ocr-worker.ts — BullMQ-Worker-Entrypoint für OCR-Ingestion (Scan-PDFs, #40)
 *
 * NICHT vom App-/Build-Graph importiert — eigener Entrypoint.
 * Erstellt einen BullMQ-Worker, der pro Job:
 *   1. Die sourceRef-Zeile mit TesseractOcrEngine ingestiert
 *   2. Fehler fail-laut loggt
 *
 * Kern-Verarbeitungslogik: `processOcrJob` — pure Funktion, OHNE Redis/BullMQ,
 * unit-testbar mit Fakes (FakeOcrEngine, FakeVectorStore, Testcontainers-PG).
 *
 * Referenz: docs/adr/0001-modular-monolith-first.md (async Worker via BullMQ)
 */

import "dotenv/config";

import { Worker } from "bullmq";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

import * as schema from "../src/lib/db/schema/index.js";
import type { IngestDeps } from "../src/lib/rag/ingest.js";
import { ingestSource } from "../src/lib/rag/ingest.js";
import { QdrantStore } from "../src/lib/infra/qdrant.js";
import { S3BlobStore } from "../src/lib/infra/minio.js";
import { OllamaEmbedder } from "../src/lib/infra/ollama.js";
import { TesseractOcrEngine } from "../src/lib/rag/ocr/tesseract-engine.js";
import { OCR_QUEUE_NAME, createRedisConnection } from "../src/lib/rag/ocr/queue.js";
import type { OcrJobData } from "../src/lib/rag/ocr/queue.js";
import type { OcrEngine } from "../src/lib/rag/ocr/engine.js";

// ── Re-Export für Testbarkeit ──────────────────────────────────────────────
export type { OcrJobData };

/**
 * OcrJobDeps — Abhängigkeiten für processOcrJob.
 * Erweitert IngestDeps um verpflichtendes `ocr` (hier immer gesetzt).
 */
export interface OcrJobDeps extends IngestDeps {
  ocr: OcrEngine;
}

/**
 * processOcrJob — pure, unit-testbare Kern-Verarbeitungslogik.
 *
 * Kein Redis, kein BullMQ, keine Top-Level-Verbindungen.
 * Lädt die sourceRef, ingestiert mit OCR-Engine.
 *
 * @param deps     Abhängigkeiten (DB, VectorStore, BlobStore, Embedder, OcrEngine)
 * @param jobData  Job-Daten (sourceRefId)
 * @returns        { chunkCount } — Anzahl persistierter Chunks
 */
export async function processOcrJob(
  deps: OcrJobDeps,
  jobData: OcrJobData,
): Promise<{ chunkCount: number }> {
  const { sourceRefId } = jobData;

  console.log(`[ocr-worker] Starte OCR-Ingestion für sourceRef ${sourceRefId}`);

  const result = await ingestSource(deps, sourceRefId);

  console.log(
    `[ocr-worker] OCR-Ingestion erfolgreich: ${result.chunkCount} Chunks für sourceRef ${sourceRefId}`,
  );

  return result;
}

// ── Worker-Entrypoint — nur beim direkten Ausführen aktiv ─────────────────

/**
 * Erstellt alle Laufzeit-Abhängigkeiten und startet den BullMQ-Worker.
 * Wird nur ausgeführt, wenn diese Datei direkt gestartet wird (nicht bei Import).
 */
function startWorker(): void {
  // Pflicht-Env-Vars prüfen (fail-laut)
  const requiredEnv = ["DATABASE_URL", "REDIS_URL"];
  for (const key of requiredEnv) {
    if (!process.env[key]) {
      console.error(`[ocr-worker] FEHLER: Env-Variable ${key} nicht gesetzt — Worker startet nicht`);
      process.exit(1);
    }
  }

  // Laufzeit-Abhängigkeiten
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client, { schema });
  const store = new QdrantStore();
  const blob = new S3BlobStore();
  const embedder = new OllamaEmbedder();
  const ocr = new TesseractOcrEngine();

  const deps: OcrJobDeps = { db, store, blob, embedder, ocr };

  const connection = createRedisConnection();

  const worker = new Worker<OcrJobData>(
    OCR_QUEUE_NAME,
    async (job) => {
      return processOcrJob(deps, job.data);
    },
    {
      connection,
      concurrency: 1, // OCR ist CPU-intensiv; nur ein Job gleichzeitig
    },
  );

  worker.on("completed", (job, result) => {
    console.log(
      `[ocr-worker] Job ${job.id} abgeschlossen: ${result.chunkCount} Chunks für sourceRef ${job.data.sourceRefId}`,
    );
  });

  worker.on("failed", (job, err) => {
    const sourceRefId = job?.data.sourceRefId ?? "unbekannt";
    console.error(
      `[ocr-worker] Job ${job?.id} fehlgeschlagen (sourceRef ${sourceRefId}):`,
      err,
    );
  });

  worker.on("error", (err) => {
    console.error("[ocr-worker] Worker-Fehler:", err);
  });

  console.log(`[ocr-worker] Worker gestartet; wartet auf Jobs in Queue "${OCR_QUEUE_NAME}"`);

  // Graceful Shutdown
  const shutdown = async () => {
    console.log("[ocr-worker] Shutdown-Signal empfangen — Worker wird beendet");
    await worker.close();
    await client.end();
    process.exit(0);
  };

  process.on("SIGTERM", () => { shutdown().catch(console.error); });
  process.on("SIGINT", () => { shutdown().catch(console.error); });
}

// Guard: Worker nur starten wenn explizit angefordert (OCR_WORKER_AUTOSTART=1)
// oder beim direkten Ausführen via tsx/node (argv[1] enthält ocr-worker)
if (process.env.OCR_WORKER_AUTOSTART === "1") {
  startWorker();
} else {
  const url = new URL(import.meta.url);
  const scriptPath = url.pathname;
  const argv1 = process.argv[1] ?? "";
  if (argv1 && (scriptPath.endsWith(argv1) || argv1.includes("ocr-worker"))) {
    startWorker();
  }
}

export { startWorker };
