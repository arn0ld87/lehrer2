/**
 * deps.ts — Gemeinsamer GenerationDeps-Typ für planning.ts und worksheet.ts
 *
 * Alle Abhängigkeiten werden injiziert — kein direkter DB/Provider-Import
 * in den Service-Modulen selbst (ermöglicht Fake-Implementierungen in Tests).
 */

import type { Db } from "@/lib/db/client";
import type { LLMProvider } from "@/lib/llm/provider";
import type { Embedder } from "@/lib/infra/ollama";
import type { VectorStore } from "@/lib/infra/qdrant";
import type { SourceRefReader } from "@/lib/rag/retrieve";
import type { AuditSink } from "@/lib/llm/gate";

export interface GenerationDeps {
  /** Drizzle-DB-Instanz (aus src/lib/db/client.ts) */
  db: Db;
  /**
   * Bereits gate-gesicherter LLM-Provider (withGate(createLLMProvider(), ...)).
   * Der Caller ist verantwortlich für den Gate-Wrap — dieser Service ruft
   * callStructured direkt auf.
   */
  provider: LLMProvider;
  /** Ollama-kompatibler Embedder (OllamaEmbedder oder FakeEmbedder) */
  embedder: Embedder;
  /** Qdrant-VectorStore (QdrantStore oder FakeVectorStore) */
  store: VectorStore;
  /** SourceRef-Lese-Adapter (PgSourceRefReader oder Fake) */
  sourceRefReader: SourceRefReader;
  /** Audit-Sink — record() schreibt in audit_log; KEIN PII in details */
  audit: AuditSink;
}
