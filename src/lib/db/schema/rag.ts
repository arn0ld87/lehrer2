import { relations, sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, unique, uuid, integer } from "drizzle-orm/pg-core";
import {
  confessionContextEnum,
  sourceTrustEnum,
  subjectEnum,
} from "../enums";
import { artifactTimestamps } from "../columns";
import { sourceRef } from "./artifacts";

/**
 * RagChunk — einzelner Retrieval-Chunk aus einer Quellenreferenz.
 * Jeder Chunk ist versioniert und durch (sourceRefId, contentHash, sourceVersion) eindeutig.
 * embeddingRef zeigt auf einen externen Vektor-Store-Eintrag (Qdrant), nullable bis Ingestion.
 */
export const ragChunk = pgTable(
  "rag_chunk",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceRefId: uuid("source_ref_id")
      .notNull()
      .references(() => sourceRef.id, { onDelete: "restrict" }),
    chunkText: text("chunk_text").notNull(),
    pageOrSection: text("page_or_section").notNull(),
    sourceVersion: integer("source_version").notNull().default(1),
    contentHash: text("content_hash").notNull(),
    embeddingRef: uuid("embedding_ref"), // nullable — verweist auf Qdrant-Vektor-ID
    trustLevel: sourceTrustEnum("trust_level").notNull(),
    subject: subjectEnum("subject"),
    confessionContext: confessionContextEnum("confession_context"),
    license: text("license"),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }),
    ...artifactTimestamps,
  },
  (t) => [
    unique("rag_chunk_source_hash_version_uniq").on(
      t.sourceRefId,
      t.contentHash,
      t.sourceVersion,
    ),
    check(
      "rag_chunk_text_min_len",
      sql`char_length(${t.chunkText}) >= 50`,
    ),
  ],
);

/**
 * Relations für rag_chunk (#44).
 *
 * Definiert die typsichere Zuordnung rag_chunk → source_ref (n:1) für Joins ab
 * Retrieval (#18), z. B. `db.query.ragChunk.findMany({ with: { sourceRef: true } })`.
 *
 * Bewusst nur die one()-Richtung: Die Umkehrung (sourceRef → many chunks) würde
 * voraussetzen, dass artifacts.ts ragChunk importiert — ein Import-Zyklus
 * (rag.ts importiert sourceRef aus artifacts.ts). Retrieval fragt vom Chunk zur
 * Quelle, daher genügt und passt die one()-Seite hier.
 */
export const ragChunkRelations = relations(ragChunk, ({ one }) => ({
  sourceRef: one(sourceRef, {
    fields: [ragChunk.sourceRefId],
    references: [sourceRef.id],
  }),
}));
