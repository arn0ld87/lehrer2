/**
 * Qdrant VectorStore — REST-basierte Vektorsuche mit Payload-Filtration
 * Local-first, Collection-Name aus QDRANT_COLLECTION, Vektorgröße aus OLLAMA_EMBEDDING_DIM
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
  ): Promise<Array<{ id: string; score: number; payload: Record<string, unknown> }>>;
  deleteByFilter(filter: SearchFilter): Promise<void>;
}

export class QdrantStore implements VectorStore {
  private url: string;
  private collection: string;
  private vectorSize: number;

  constructor(url?: string, collection?: string, vectorSize?: number) {
    this.url = url || process.env.QDRANT_URL || "http://localhost:6333";
    this.collection = collection || process.env.QDRANT_COLLECTION || "ua_lsa_chunks";
    this.vectorSize =
      vectorSize || Number(process.env.OLLAMA_EMBEDDING_DIM ?? 2560);
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
  ): Promise<Array<{ id: string; score: number; payload: Record<string, unknown> }>> {
    const qdrantFilter = this.buildQdrantFilter(filter);

    const url = `${this.url}/collections/${this.collection}/points/search`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vector,
        filter: qdrantFilter,
        limit,
        with_payload: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Qdrant search failed: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      result: Array<{ id: string; score: number; payload: Record<string, unknown> }>;
    };
    return data.result;
  }

  /**
   * Löscht Punkte basierend auf Payload-Filter
   */
  async deleteByFilter(filter: SearchFilter): Promise<void> {
    const qdrantFilter = this.buildQdrantFilter(filter);

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
   * Übersetzt SearchFilter zu Qdrant-Filter-Syntax
   */
  private buildQdrantFilter(filter: SearchFilter): Record<string, unknown> {
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

    return Object.keys(result).length > 0 ? result : { match_all: {} };
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
    _vector: number[],
    filter: SearchFilter,
    limit: number = 10,
  ): Promise<Array<{ id: string; score: number; payload: Record<string, unknown> }>> {
    const results: Array<{ id: string; score: number; payload: Record<string, unknown> }> =
      [];

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

      results.push({
        id: point.id,
        score: 1, // Deterministic score
        payload: point.payload,
      });

      if (results.length >= limit) break;
    }

    return results;
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
}
