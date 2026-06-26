/**
 * Infra-Clients — zentrale Exports für Embedder, VectorStore, BlobStore
 * Wählt zwischen Produktions- und Fake-Implementierungen
 */

import { OllamaEmbedder, FakeEmbedder } from "./ollama";
import { OpenAIEmbedder } from "./openai-embedder";
import { QdrantStore, FakeVectorStore } from "./qdrant";
import { S3BlobStore, FakeBlobStore } from "./minio";

export { OllamaEmbedder, FakeEmbedder, type Embedder } from "./ollama";
export { OpenAIEmbedder } from "./openai-embedder";
export {
  QdrantStore,
  FakeVectorStore,
  type VectorStore,
  type VectorPoint,
  type SearchFilter,
} from "./qdrant";
export { S3BlobStore, FakeBlobStore, type BlobStore } from "./minio";

/**
 * Factory-Funktionen für flexible Instanziierung
 */

export function createEmbedder(fake: boolean = false) {
  if (fake) {
    return new FakeEmbedder();
  }
  // EMBEDDING_PROVIDER=openai → Cloud-Embeddings (text-embedding-3-small, 1536-dim).
  // Bewusste, gegatete local-first-Abweichung; nur für nicht-sensibles Material.
  // Ingestion UND Retrieval lesen dieselbe Variable → konsistenter Vektorraum.
  if (process.env.EMBEDDING_PROVIDER === "openai") {
    return new OpenAIEmbedder();
  }
  return new OllamaEmbedder();
}

export function createVectorStore(fake: boolean = false) {
  if (fake) {
    return new FakeVectorStore();
  }
  return new QdrantStore();
}

export function createBlobStore(fake: boolean = false) {
  if (fake) {
    return new FakeBlobStore();
  }
  return new S3BlobStore();
}
