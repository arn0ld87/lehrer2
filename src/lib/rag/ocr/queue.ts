/**
 * queue.ts — BullMQ OCR-Queue-Definition
 *
 * Definiert die `ocr`-Queue und den Job-Datentyp sowie den Helper `enqueueOcrJob`.
 *
 * WICHTIG: Keine Top-Level-Redis-Verbindung — Verbindung wird lazy per Factory
 * hergestellt, damit `next build` und `vitest` NICHT gegen Redis connecten.
 * Redis-URL aus env: `REDIS_URL` (z. B. redis://localhost:6379).
 *
 * Referenz: docs/adr/0001-modular-monolith-first.md (async Worker via BullMQ)
 */

import { Queue } from "bullmq";
import type { ConnectionOptions } from "bullmq";

/** Name der BullMQ-Queue */
export const OCR_QUEUE_NAME = "ocr" as const;

/**
 * Job-Datentyp für OCR-Jobs.
 * `sourceRefId` verweist auf die sourceRef-Zeile, die per OCR ingestiert werden soll.
 */
export interface OcrJobData {
  sourceRefId: string;
}

/**
 * Erstellt eine BullMQ-Connection-Options aus der REDIS_URL-Env-Variable.
 * Wirft, wenn REDIS_URL nicht gesetzt ist (fail-laut).
 *
 * Lazy — kein Aufruf beim Import, nur wenn explizit aufgerufen.
 */
export function createRedisConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      "OCR-Queue: REDIS_URL nicht gesetzt — Redis-Verbindung kann nicht hergestellt werden",
    );
  }

  // BullMQ akzeptiert ioredis-Connection-Options oder eine URL-Instanz.
  // Wir parsen die URL manuell für Portabilität (kein ioredis direkt importieren im Queue-Modul).
  try {
    const parsed = new URL(url);
    const connection: ConnectionOptions = {
      host: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port, 10) : 6379,
    };
    if (parsed.password) {
      (connection as Record<string, unknown>).password = parsed.password;
    }
    if (parsed.pathname && parsed.pathname !== "/" && parsed.pathname !== "") {
      const db = parseInt(parsed.pathname.slice(1), 10);
      if (!isNaN(db)) {
        (connection as Record<string, unknown>).db = db;
      }
    }
    return connection;
  } catch {
    throw new Error(`OCR-Queue: REDIS_URL ist ungültig: ${url}`);
  }
}

/**
 * Stellt einen OCR-Job in die Queue.
 * Erstellt eine einmalige Queue-Instanz, enqueued den Job, schließt die Queue.
 *
 * @param sourceRefId  ID der sourceRef-Zeile (muss APPROVED sein)
 * @returns            Job-ID des erstellten Jobs
 */
export async function enqueueOcrJob(sourceRefId: string): Promise<string> {
  const connection = createRedisConnection();
  const queue = new Queue<OcrJobData>(OCR_QUEUE_NAME, { connection });

  try {
    const job = await queue.add(
      "process-scan-pdf",
      { sourceRefId },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    );

    if (!job.id) {
      throw new Error(`enqueueOcrJob: Queue-Job hat keine ID (sourceRef: ${sourceRefId})`);
    }

    return job.id;
  } finally {
    await queue.close();
  }
}
