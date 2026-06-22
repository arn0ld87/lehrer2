/**
 * ingest.ts — Ingestion-Pipeline für eine einzelne Quelle
 *
 * Ablauf (fail-closed):
 *   GATE → Bytes laden → SHA-256 → Dedup-Check → extractContent → chunkText
 *   → embed → Qdrant upsert → PG-Transaktion (rag_chunk insert + lifecycleStatus=INGESTED)
 *
 * Kompensation: schlägt der PG-Teil nach dem Qdrant-Upsert fehl,
 * werden die Qdrant-Punkte wieder gelöscht und der Fehler wird weitergeworfen.
 */

import { createHash, randomUUID } from "node:crypto";
import { and, eq, ne, isNotNull } from "drizzle-orm";

import type { Db } from "@/lib/db/client";
import type { VectorStore } from "@/lib/infra/qdrant";
import type { BlobStore } from "@/lib/infra/minio";
import { blobKeyForSource } from "@/lib/infra/minio";
import type { Embedder } from "@/lib/infra/ollama";
import { sourceRef } from "@/lib/db/schema/artifacts";
import { ragChunk } from "@/lib/db/schema/rag";

import { extractContent } from "./extract";
import { chunkText } from "./chunk";
import { ensureCollection, upsertSourceChunks, deletePoints } from "./qdrant";

/**
 * DuplicateContentError — wird geworfen, wenn der berechnete contentHash bereits
 * von einer ANDEREN sourceRef-Zeile gehalten wird (Früherkennung vor Embedding-Arbeit).
 *
 * Enthält die `existingSourceRefId` der Quelle, die den Hash bereits besitzt,
 * damit Aufrufer gezielt reagieren können (z. B. deduplizieren statt erneut ingestieren).
 */
export class DuplicateContentError extends Error {
  readonly existingSourceRefId: string;
  readonly contentHash: string;

  constructor(contentHash: string, existingSourceRefId: string) {
    super(
      `DuplicateContentError: contentHash ${contentHash} wird bereits von sourceRef ${existingSourceRefId} gehalten — Ingestion abgebrochen (Duplikat-Früherkennung)`,
    );
    this.name = "DuplicateContentError";
    this.existingSourceRefId = existingSourceRefId;
    this.contentHash = contentHash;
  }
}

/**
 * findExistingSourceForHash — prüft, ob der gegebene contentHash bereits von einer
 * ANDEREN Quelle (≠ ownSourceRefId) gehalten wird.
 *
 * Sucht unter allen Zeilen mit gesetztem contentHash; schließt die eigene Quelle aus,
 * damit ein Re-Ingest derselben Quelle nicht fälschlicherweise blockiert wird.
 *
 * @returns sourceRefId der kollisionierenden Quelle, oder null wenn keine gefunden.
 */
export async function findExistingSourceForHash(
  db: import("@/lib/db/client").Db,
  contentHash: string,
  ownSourceRefId: string,
): Promise<string | null> {
  const rows = await db
    .select({ id: sourceRef.id })
    .from(sourceRef)
    .where(
      and(
        eq(sourceRef.contentHash, contentHash),
        ne(sourceRef.id, ownSourceRefId),
        isNotNull(sourceRef.contentHash),
      ),
    )
    .limit(1);
  return rows[0]?.id ?? null;
}

export interface IngestDeps {
  db: Db;
  store: VectorStore;
  blob: BlobStore;
  embedder: Embedder;
}

/**
 * Ingestiert eine einzelne Quelle vollständig.
 *
 * GATE (fail-closed): Wirft, wenn
 *   - lifecycleStatus !== "APPROVED"
 *   - licenseVerified !== true
 *   - sourceType === "UNVERIFIED"
 * In diesen Fällen werden WEDER Qdrant-Punkte noch rag_chunk-Records angelegt.
 *
 * @param deps          Abhängigkeiten (DB, VectorStore, BlobStore, Embedder)
 * @param sourceRefId   ID der sourceRef-Zeile
 * @returns             { chunkCount } — Anzahl persistierter Chunks
 */
export async function ingestSource(
  deps: IngestDeps,
  sourceRefId: string,
): Promise<{ chunkCount: number }> {
  const { db, store, blob, embedder } = deps;

  // ── (1) GATE fail-closed ────────────────────────────────────────────────────
  const rows = await db
    .select()
    .from(sourceRef)
    .where(eq(sourceRef.id, sourceRefId));
  const source = rows[0];

  if (!source) {
    throw new Error(`ingestSource: sourceRef ${sourceRefId} nicht gefunden`);
  }
  if (source.sourceType === "UNVERIFIED") {
    throw new Error(
      `ingestSource: GATE fehlgeschlagen — sourceType UNVERIFIED darf nie ingestiert werden (sourceRef ${sourceRefId})`,
    );
  }
  if (source.lifecycleStatus !== "APPROVED") {
    throw new Error(
      `ingestSource: GATE fehlgeschlagen — lifecycleStatus ist "${source.lifecycleStatus}", erwartet "APPROVED" (sourceRef ${sourceRefId})`,
    );
  }
  if (!source.licenseVerified) {
    throw new Error(
      `ingestSource: GATE fehlgeschlagen — licenseVerified ist false (sourceRef ${sourceRefId})`,
    );
  }

  // ── (2) Bytes laden ─────────────────────────────────────────────────────────
  let raw: Uint8Array;

  // Stabiles, inhaltsunabhängiges Blob-Key-Schema (#42): `sources/<sourceRefId>/v<sourceVersion>`.
  // Bewusst NICHT contentHash-basiert, da contentHash bis zum erfolgreichen Ingest
  // null bleibt und der Key sonst über Läufe hinweg inkonsistent wäre. Schema-Definition
  // und Abstimmung mit dem Upload-Flow: siehe blobKeyForSource() in src/lib/infra/minio.ts.
  const blobKey = blobKeyForSource(sourceRefId, source.sourceVersion);
  try {
    raw = await blob.getObject(blobKey);
  } catch {
    // Blob nicht vorhanden → über URI laden
    if (!source.uri) {
      throw new Error(
        `ingestSource: Weder Blob (${blobKey}) noch URI verfügbar (sourceRef ${sourceRefId})`,
      );
    }
    const response = await fetch(source.uri);
    if (!response.ok) {
      throw new Error(
        `ingestSource: fetch(${source.uri}) fehlgeschlagen: ${response.statusText}`,
      );
    }
    raw = new Uint8Array(await response.arrayBuffer());
  }

  // ── (3) contentHash berechnen ───────────────────────────────────────────────
  // Persistiert wird der Hash erst innerhalb der PG-Transaktion (Schritt 8),
  // gemeinsam mit den rag_chunk-Records und dem INGESTED-Status. Würde der Hash
  // hier vorab geschrieben und ein späterer Schritt schlägt fehl, bliebe ein
  // inkonsistenter Zwischenzustand zurück (Hash gesetzt, aber kein rag_chunk,
  // nicht INGESTED) — und beim Retry ein blobKey-Mismatch.
  const contentHash = createHash("sha256").update(raw).digest("hex");

  // ── (3b) Dedup-Früherkennung ────────────────────────────────────────────────
  // Bevor Embeddings oder Qdrant-Arbeit passiert: prüfen, ob der contentHash
  // bereits von einer ANDEREN Quelle gehalten wird. Der partielle Unique-Index
  // (IS NOT NULL) fängt Duplikate spät als Unique-Violation beim PG-Update ab;
  // dieser Check wandelt das in eine klare, frühe DuplicateContentError um.
  //
  // Spart Embedding- und Qdrant-Arbeit und liefert eine aussagekräftige Meldung
  // (welche bestehende sourceRefId den Hash hält).
  const existingSourceRefId = await findExistingSourceForHash(db, contentHash, sourceRefId);
  if (existingSourceRefId !== null) {
    throw new DuplicateContentError(contentHash, existingSourceRefId);
  }

  // ── (4) Text extrahieren ────────────────────────────────────────────────────
  // MIME aus sourceRef.licenseInfo? Nein — wir leiten ihn aus der URI ab.
  // Fallback auf application/octet-stream → ExtractionFailedError.
  const mime = guessMime(source.uri ?? "");
  const text = await extractContent(source.uri ?? blobKey, raw, mime);

  // ── (5) Chunking ─────────────────────────────────────────────────────────────
  const chunks = chunkText(text);

  if (chunks.length === 0) {
    throw new Error(
      `ingestSource: chunkText ergab 0 Chunks (leerer Text nach Extraktion) (sourceRef ${sourceRefId})`,
    );
  }

  // ── (6) Embeddings ───────────────────────────────────────────────────────────
  const chunkTexts = chunks.map((c) => c.text);
  const vectors = await embedder.embed(chunkTexts);

  if (vectors.length !== chunks.length) {
    throw new Error(
      `ingestSource: Embedder lieferte ${vectors.length} Vektoren für ${chunks.length} Chunks`,
    );
  }

  // ── (7) Qdrant: Collection sicherstellen + Punkte upserten ──────────────────
  // Point-IDs werden zu embeddingRefs; außerhalb der PG-Transaktion.
  const pointIds = chunks.map(() => randomUUID());

  const points = chunks.map((chunk, i) => ({
    id: pointIds[i]!,
    vector: vectors[i]!,
    payload: {
      source_id: sourceRefId,
      trust_level: source.sourceType,
      subject: source.subjectAlignment ?? null,
      confession_context: source.confessionContext ?? null,
      page_or_section: chunk.pageOrSection,
      source_version: source.sourceVersion,
      license: source.licenseInfo ?? null,
      retrieved_at: source.retrievedAt?.toISOString() ?? null,
      content_hash: contentHash,
    },
  }));

  await ensureCollection(store);
  await upsertSourceChunks(store, sourceRefId, points);

  // ── (8) PG-Transaktion: rag_chunk-Records + lifecycleStatus = INGESTED ───────
  try {
    await db.transaction(async (tx) => {
      const chunkRecords = chunks.map((chunk, i) => ({
        id: randomUUID(),
        sourceRefId,
        chunkText: chunk.text,
        pageOrSection: chunk.pageOrSection,
        sourceVersion: source.sourceVersion,
        contentHash,
        embeddingRef: pointIds[i]!,
        trustLevel: source.sourceType as typeof ragChunk.$inferInsert["trustLevel"],
        subject: source.subjectAlignment as typeof ragChunk.$inferInsert["subject"] ?? null,
        confessionContext:
          source.confessionContext as typeof ragChunk.$inferInsert["confessionContext"] ?? null,
        license: source.licenseInfo ?? null,
        retrievedAt: source.retrievedAt ?? null,
      }));

      await tx.insert(ragChunk).values(chunkRecords);

      // contentHash + INGESTED atomar mit den Chunks setzen.
      // Guard (fail-closed): nur wenn die Quelle noch APPROVED ist — schützt
      // gegen eine konkurrierende Transition (z. B. revoke()) während der Ingestion.
      const marked = await tx
        .update(sourceRef)
        .set({ contentHash, lifecycleStatus: "INGESTED" })
        .where(
          and(eq(sourceRef.id, sourceRefId), eq(sourceRef.lifecycleStatus, "APPROVED")),
        )
        .returning({ id: sourceRef.id });

      if (marked.length === 0) {
        throw new Error(
          `ingestSource: Quelle ${sourceRefId} ist während der Ingestion nicht mehr APPROVED — abgebrochen (fail-closed)`,
        );
      }
    });
  } catch (pgError) {
    // ── Kompensation: nur die in DIESEM Lauf erzeugten Qdrant-Punkte löschen (#41) ──
    // deletePoints(pointIds) wirkt gezielt — Reste früherer (abgebrochener) Läufe
    // derselben source_id bleiben unberührt, keine unerwünschte Breitenwirkung bei
    // Re-Ingestion. Orphan-Cleanup ist getrennt (deleteBySource beim Re-Ingest/Widerruf).
    try {
      await deletePoints(store, pointIds);
    } catch (qdrantErr) {
      // Kompensation fehlgeschlagen — als Warning loggen, Original-Fehler werfen
      console.error(
        `ingestSource: Kompensations-deletePoints fehlgeschlagen für ${sourceRefId}:`,
        qdrantErr,
      );
    }
    throw pgError;
  }

  return { chunkCount: chunks.length };
}

// ── Hilfsfunktion: MIME aus Dateiendung ableiten ──────────────────────────────

function guessMime(uri: string): string {
  const lower = uri.toLowerCase().split("?")[0] ?? "";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  if (lower.endsWith(".txt") || lower.endsWith(".md")) return "text/plain";
  // Fallback — ExtractionFailedError wird in extractContent geworfen
  return "application/octet-stream";
}
