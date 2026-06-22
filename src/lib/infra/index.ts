/**
 * Infra-Clients — zentrale Exports für Embedder, VectorStore, BlobStore
 * Wählt zwischen Produktions- und Fake-Implementierungen
 */

import { OllamaEmbedder, FakeEmbedder } from "./ollama";
import { QdrantStore, FakeVectorStore } from "./qdrant";
import { S3BlobStore, FakeBlobStore } from "./minio";

export { OllamaEmbedder, FakeEmbedder, type Embedder } from "./ollama";
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
