/**
 * qdrant.ts — High-Level-Adapter über VectorStore
 *
 * Kapselt Collection-Management und Source-bezogene CRUD-Operationen.
 * Direkte Qdrant-Implementierungsdetails (REST-URLs) verbleiben in src/lib/infra/qdrant.ts.
 */

import type { VectorStore, VectorPoint } from "@/lib/infra/qdrant";

/**
 * Stellt sicher, dass die Collection im VectorStore existiert.
 * Idempotent — sicher, wenn Collection bereits vorhanden.
 */
export async function ensureCollection(store: VectorStore): Promise<void> {
  await store.ensureCollection();
}

/**
 * Upsert von Chunk-Punkten einer Quelle in den VectorStore.
 * Bestehende Punkte mit gleicher ID werden überschrieben.
 *
 * @param store      VectorStore-Instanz
 * @param sourceId   sourceRef.id — wird im Payload als source_id erzwungen
 * @param points     Vektorpunkte (id, vector, payload bereits befüllt)
 */
export async function upsertSourceChunks(
  store: VectorStore,
  sourceId: string,
  points: VectorPoint[],
): Promise<void> {
  if (points.length === 0) return;
  // source_id in payload erzwingen (Invariante für deleteBySource)
  const tagged = points.map((p) => ({
    ...p,
    payload: { ...p.payload, source_id: sourceId },
  }));
  await store.upsertPoints(tagged);
}

/**
 * Löscht alle Qdrant-Punkte, deren payload.source_id === sourceId.
 * Wird zur Kompensation genutzt, wenn der DB-Teil nach dem Qdrant-Upsert fehlschlägt.
 *
 * @param store     VectorStore-Instanz
 * @param sourceId  sourceRef.id
 */
export async function deleteBySource(
  store: VectorStore,
  sourceId: string,
): Promise<void> {
  await store.deleteByFilter({ sourceId });
}
