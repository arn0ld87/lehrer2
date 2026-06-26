/**
 * OpenAIEmbedder — Cloud-Embeddings über die OpenAI-kompatible /v1/embeddings-API.
 *
 * ABWEICHUNG VON LOCAL-FIRST (Grundsatz 3) — BEWUSST + GEGATETT:
 *   Nur aktiv, wenn EMBEDDING_PROVIDER=openai gesetzt ist (Default bleibt
 *   OllamaEmbedder, local-first). Eingeführt für schnelleren Ingestion-Durchsatz
 *   (Batching statt Per-Chunk-Schleife) auf öffentlichem, nicht-sensiblem Material
 *   (amtliche Lehrpläne, gemeinfrei).
 *
 *   HARTE GRENZE: Niemals für SENSITIVE_STUDENT-Inhalte verwenden. Schüler-PII
 *   bleibt durch den Ingestion-Classifier (classifyFgsFile, fail-closed) und den
 *   Quellen-Trust ausgeschlossen — dieser Embedder ändert daran nichts.
 *
 * text-embedding-3-small liefert 1536 Dimensionen. Die Qdrant-Collection muss
 * mit derselben Dimension angelegt sein (EMBEDDING_DIM=1536) und Ingestion +
 * Retrieval müssen denselben Embedder nutzen (createEmbedder()).
 *
 * Batching: bis zu OPENAI_EMBEDDING_BATCH inputs pro Request (Default 96).
 * Die OpenAI-API garantiert die Ausgabereihenfolge nicht zwingend → wir sortieren
 * defensiv nach `index`, bevor die Vektoren zurückgegeben werden.
 */

import type { Embedder } from "./ollama";

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
}

export class OpenAIEmbedder implements Embedder {
  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private batchSize: number;

  constructor(opts?: {
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    batchSize?: number;
  }) {
    this.baseUrl =
      opts?.baseUrl ??
      process.env.OPENAI_EMBEDDING_BASE_URL ??
      "https://api.openai.com/v1";
    this.apiKey =
      opts?.apiKey ??
      process.env.OPENAI_EMBEDDING_API_KEY ??
      process.env.OPENAI_API_KEY ??
      "";
    this.model =
      opts?.model ?? process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
    this.batchSize =
      opts?.batchSize ?? Number(process.env.OPENAI_EMBEDDING_BATCH ?? 96);

    if (!this.apiKey) {
      throw new Error(
        "OpenAIEmbedder: kein API-Key gesetzt (OPENAI_EMBEDDING_API_KEY oder OPENAI_API_KEY).",
      );
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);

      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ model: this.model, input: batch }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(
          `OpenAI embedding failed: ${response.status} ${response.statusText} ${body.slice(0, 200)}`,
        );
      }

      const data = (await response.json()) as OpenAIEmbeddingResponse;
      const sorted = [...data.data].sort((a, b) => a.index - b.index);
      for (const item of sorted) {
        results.push(item.embedding);
      }
    }

    return results;
  }
}
