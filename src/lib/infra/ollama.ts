/**
 * Ollama Embedder — local-first (nur lokale URL, KEIN Cloud-Provider)
 * Erzeugt Embeddings über Ollama-API
 * Default-Modell: qwen3-embedding:4b (via OLLAMA_EMBEDDING_MODEL)
 */

export interface Embedder {
  /**
   * Erzeugt Embeddings für ein Array von Texten
   * @param texts Array von Texten zum Embedden
   * @returns Promise mit Array von Vektoren (number[][])
   */
  embed(texts: string[]): Promise<number[][]>;
}

export class OllamaEmbedder implements Embedder {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl?: string, model?: string) {
    this.baseUrl = baseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    this.model = model || process.env.OLLAMA_EMBEDDING_MODEL || "qwen3-embedding:4b";
  }

  async embed(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];

    for (const text of texts) {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.model, prompt: text }),
      });

      if (!response.ok) {
        throw new Error(`Ollama embedding failed: ${response.statusText}`);
      }

      const data = (await response.json()) as { embedding: number[] };
      results.push(data.embedding);
    }

    return results;
  }
}

/**
 * FakeEmbedder — deterministisch für Tests
 * Erzeugt reproduzierbare Vektoren aus Text-Hash
 */
export class FakeEmbedder implements Embedder {
  private dimension: number;

  constructor(dimension?: number) {
    this.dimension = dimension || Number(process.env.OLLAMA_EMBEDDING_DIM ?? 2560);
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.hashToVector(text));
  }

  /**
   * Deterministisch einen Vektor aus Text-Hash generieren (L2-stabil)
   */
  private hashToVector(text: string): number[] {
    // Einfacher Hash basierend auf char-codes
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Seeded-Zufallsgenerator für reproduzierbar deterministisch
    let seed = Math.abs(hash);
    const vector: number[] = [];
    for (let i = 0; i < this.dimension; i++) {
      seed = (seed * 9301 + 49297) % 233280;
      vector.push((seed / 233280) * 2 - 1); // [-1, 1]
    }

    // L2-Normalisierung
    let magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (magnitude === 0) magnitude = 1;
    return vector.map((v) => v / magnitude);
  }
}
