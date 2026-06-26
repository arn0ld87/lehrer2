/**
 * Qdrant VectorStore — REST-basierte Vektorsuche mit Payload-Filtration
 * Local-first, Collection-Name aus QDRANT_COLLECTION, Vektorgröße aus EMBEDDING_DIM
 * (Fallback OLLAMA_EMBEDDING_DIM). EMBEDDING_DIM muss zum aktiven Embedder passen:
 * qwen3-embedding:4b = 2560, OpenAI text-embedding-3-small = 1536.
 */

export interface VectorPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

export interface SearchFilter {
  trustLevelNot?: string;
  subject?: string;
  confessionContextIn?: string[];
  /** Filtert auf payload.source_id (exact match). Primär für deleteBySource. */
  sourceId?: string;
}

export interface VectorStore {
  ensureCollection(): Promise<void>;
  upsertPoints(points: VectorPoint[]): Promise<void>;
  search(
    vector: number[],
    filter: SearchFilter,
    limit?: number,
  ): Promise<Array<{ id: string; score: number; payload: Record<string, unknown>; vector?: number[] }>>;
  deleteByFilter(filter: SearchFilter): Promise<void>;
  /**
   * Löscht gezielt die Punkte mit den angegebenen IDs.
   * Im Gegensatz zu deleteByFilter({ sourceId }) wirkt das ausschließlich auf
   * die übergebenen IDs — Reste früherer Läufe derselben source_id bleiben unberührt.
   * Genutzt für die Kompensation einer einzelnen Ingestion (nur deren pointIds).
   */
  deletePoints(ids: string[]): Promise<void>;
}

/**
 * Kosinus-Ähnlichkeit zweier Vektoren. Fail-safe: 0 bei Nullvektor ODER bei
 * ungleicher Dimension (verhindert Laufzeitfehler / stille Fehlrechnung).
 * Zentrale Vektor-Mathematik — auch von retrieve.ts (MMR) wiederverwendet.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export class QdrantStore implements VectorStore {
  private url: string;
  private collection: string;
  private vectorSize: number;

  constructor(url?: string, collection?: string, vectorSize?: number) {
    this.url = url || process.env.QDRANT_URL || "http://localhost:6333";
    this.collection = collection || process.env.QDRANT_COLLECTION || "ua_lsa_chunks";
    this.vectorSize =
      vectorSize ||
      Number(process.env.EMBEDDING_DIM ?? process.env.OLLAMA_EMBEDDING_DIM ?? 2560);
  }

  /**
   * Stellt sicher, dass die Collection existiert; legt sie an falls nicht
   */
  async ensureCollection(): Promise<void> {
    const checkUrl = `${this.url}/collections/${this.collection}`;
    const checkResponse = await fetch(checkUrl);

    if (checkResponse.ok) {
      return; // Collection existiert bereits
    }

    if (checkResponse.status !== 404) {
      throw new Error(`Qdrant check failed: ${checkResponse.statusText}`);
    }

    // Collection anlegen
    const createUrl = `${this.url}/collections/${this.collection}`;
    const createResponse = await fetch(createUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vectors: {
          size: this.vectorSize,
          distance: "Cosine",
        },
        payload_schema: {
          trust_level: {
            type: "keyword",
          },
          subject: {
            type: "keyword",
          },
          confession_context: {
            type: "keyword",
          },
        },
      }),
    });

    if (!createResponse.ok) {
      throw new Error(`Failed to create Qdrant collection: ${createResponse.statusText}`);
    }
  }

  /**
   * Speichert Vektorpunkte in der Collection
   */
  async upsertPoints(points: VectorPoint[]): Promise<void> {
    if (points.length === 0) return;

    const url = `${this.url}/collections/${this.collection}/points?wait=true`;
    const response = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        points: points.map((p) => ({
          id: p.id,
          vector: p.vector,
          payload: p.payload,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`Qdrant upsert failed: ${response.statusText}`);
    }
  }

  /**
   * Sucht nach ähnlichen Vektoren mit optionalem Payload-Filter
   */
  async search(
    vector: number[],
    filter: SearchFilter,
    limit: number = 10,
  ): Promise<Array<{ id: string; score: number; payload: Record<string, unknown>; vector?: number[] }>> {
    const qdrantFilter = this.buildQdrantFilter(filter);

    const url = `${this.url}/collections/${this.collection}/points/search`;
    // with_vector: true → Qdrant liefert den gespeicherten Vektor je Treffer mit,
    // damit das MMR-Reranking echte Diversität (Vektor-Ähnlichkeit) berechnen kann.
    const body: Record<string, unknown> = {
      vector,
      limit,
      with_payload: true,
      with_vector: true,
    };
    // Leeren Filter NICHT mitsenden — Qdrant lehnt einen leeren/match_all-Filter
    // als Bad Request ab. Ohne filter-Feld sucht Qdrant über alle Punkte.
    if (qdrantFilter) body.filter = qdrantFilter;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Qdrant search failed: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      result: Array<{
        id: string;
        score: number;
        payload: Record<string, unknown>;
        vector?: number[];
      }>;
    };
    return data.result;
  }

  /**
   * Löscht Punkte basierend auf Payload-Filter
   */
  async deleteByFilter(filter: SearchFilter): Promise<void> {
    const qdrantFilter = this.buildQdrantFilter(filter);

    // Schutz fail-closed: ohne konkrete Filterklausel würde delete ALLE Punkte
    // der Collection treffen. deleteByFilter wird produktiv nur mit Klausel
    // (z. B. sourceId) aufgerufen; ein leerer Filter ist hier ein Programmierfehler.
    if (!qdrantFilter) {
      throw new Error(
        "QdrantStore.deleteByFilter: leerer Filter — würde die gesamte Collection löschen (abgelehnt)",
      );
    }

    const url = `${this.url}/collections/${this.collection}/points/delete?wait=true`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filter: qdrantFilter }),
    });

    if (!response.ok) {
      throw new Error(`Qdrant delete failed: ${response.statusText}`);
    }
  }

  /**
   * Löscht gezielt die Punkte mit den angegebenen IDs (Qdrant points/delete mit { points: [...] }).
   */
  async deletePoints(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const url = `${this.url}/collections/${this.collection}/points/delete?wait=true`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points: ids }),
    });

    if (!response.ok) {
      throw new Error(`Qdrant deletePoints failed: ${response.statusText}`);
    }
  }

  /**
   * Übersetzt SearchFilter zu Qdrant-Filter-Syntax.
   * Gibt `undefined` zurück, wenn keine Filterklausel vorliegt — der Aufrufer
   * lässt das filter-Feld dann weg (Qdrant akzeptiert keinen leeren Filter).
   */
  private buildQdrantFilter(filter: SearchFilter): Record<string, unknown> | undefined {
    const must: Array<Record<string, unknown>> = [];
    const mustNot: Array<Record<string, unknown>> = [];

    if (filter.trustLevelNot) {
      mustNot.push({
        key: "trust_level",
        match: { value: filter.trustLevelNot },
      });
    }

    if (filter.subject) {
      must.push({
        key: "subject",
        match: { value: filter.subject },
      });
    }

    if (filter.confessionContextIn && filter.confessionContextIn.length > 0) {
      must.push({
        key: "confession_context",
        match: { any: filter.confessionContextIn },
      });
    }

    if (filter.sourceId) {
      must.push({
        key: "source_id",
        match: { value: filter.sourceId },
      });
    }

    const result: Record<string, unknown> = {};
    if (must.length > 0) result.must = must;
    if (mustNot.length > 0) result.must_not = mustNot;

    return Object.keys(result).length > 0 ? result : undefined;
  }
}

/**
 * FakeVectorStore — In-Memory für Tests
 * Deterministisch, keine Zufallszahlen
 */
export class FakeVectorStore implements VectorStore {
  private points: Map<string, VectorPoint> = new Map();

  async ensureCollection(): Promise<void> {
    // no-op
  }

  async upsertPoints(points: VectorPoint[]): Promise<void> {
    for (const point of points) {
      this.points.set(point.id, point);
    }
  }

  async search(
    vector: number[],
    filter: SearchFilter,
    limit: number = 10,
  ): Promise<Array<{ id: string; score: number; payload: Record<string, unknown>; vector?: number[] }>> {
    const matched: Array<{
      id: string;
      score: number;
      payload: Record<string, unknown>;
      vector: number[];
    }> = [];

    for (const point of this.points.values()) {
      // trustLevelNot: ausschließen
      if (filter.trustLevelNot && point.payload.trust_level === filter.trustLevelNot) {
        continue;
      }

      // subject: muss übereinstimmen
      if (filter.subject && point.payload.subject !== filter.subject) {
        continue;
      }

      // confessionContextIn: muss in Liste sein
      if (
        filter.confessionContextIn &&
        filter.confessionContextIn.length > 0 &&
        !filter.confessionContextIn.includes(point.payload.confession_context as string)
      ) {
        continue;
      }

      // Score per Kosinus-Ähnlichkeit zur Query (deterministisch); Vektor mitgeben (MMR).
      matched.push({
        id: point.id,
        score: cosineSimilarity(vector, point.vector),
        payload: point.payload,
        vector: point.vector,
      });
    }

    // Deterministisch: nach Score absteigend, Tiebreak nach id (stabil).
    matched.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

    return matched.slice(0, limit);
  }

  async deleteByFilter(filter: SearchFilter): Promise<void> {
    const toDelete: string[] = [];

    for (const [id, point] of this.points.entries()) {
      // sourceId: exakter Payload-Match => löschen wenn übereinstimmend
      if (filter.sourceId !== undefined) {
        if (point.payload.source_id === filter.sourceId) {
          toDelete.push(id);
        }
        continue;
      }

      // trustLevelNot: löscht alle Punkte, die NICHT den angegebenen Trust-Level haben.
      // (Semantik: "behalte nur Punkte mit diesem Trust-Level")
      if (filter.trustLevelNot !== undefined) {
        if (point.payload.trust_level !== filter.trustLevelNot) {
          toDelete.push(id);
        }
        // Punkt hat den gesuchten Trust-Level → behalten, nächsten prüfen
        continue;
      }

      if (filter.subject && point.payload.subject !== filter.subject) {
        continue;
      }

      if (
        filter.confessionContextIn &&
        filter.confessionContextIn.length > 0 &&
        !filter.confessionContextIn.includes(point.payload.confession_context as string)
      ) {
        continue;
      }

      toDelete.push(id);
    }

    for (const id of toDelete) {
      this.points.delete(id);
    }
  }

  async deletePoints(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.points.delete(id);
    }
  }
}
