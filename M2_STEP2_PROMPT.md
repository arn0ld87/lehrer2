# Kickoff-Prompt — M2 Schritt 2: Retrieval + Reranking + Zitation

> Kopiere alles ab der Trennlinie in ein neues Claude-Code-Fenster (Projekt `jana_lehrerin`).
> Scratch-Datei, nicht committen — nach Gebrauch löschen.

---

nutze ultracode und workflows mit günstigen subagenten und nutze auch crg und ctx für **M2 Schritt 2 — Quellen-RAG: Retrieval + Reranking + Zitation** (Issue #18).

## Context

M0 (Governance/Docs), M1 (UI-Shell + Drizzle-Datenmodell + DOCX/PDF-Export) und **M2 Schritt 1 (Quellen-RAG-Gerüst)** sind in `main` gemergt (HEAD `3d236e4`, PR #38, CI grün). Schritt 1 lieferte das Gerüst: persistente Quellen mit Lebenszyklus + fail-closed Trust-Gate, Ingestion-Pipeline (Extraktion → Chunking → Embedding → Qdrant), local-first Embedding via Ollama. **Noch nicht real: Retrieval/Reranking/Zitation — genau das ist dieser Schritt.**

Dieser Schritt liefert die **Abruf- und Nachweis-Schicht**: aus einer Anfrage quellengebundene, gefilterte, gerankte Chunks mit vollständiger Zitation (Quelle, Version, Abschnitt/Seite, Abrufdatum, Vertrauensstufe, Confidence). **Noch nicht in Schritt 2:** Eval-Suite (Schritt 3, #19), kaskadierte Widerruf/Löschung (Schritt 4, #20), die eigentliche LLM-Antwortgenerierung (Provider-Schicht, ADR 0002), Korrekturassistenz (M3).

## Bestand (verifiziert aus M2 Schritt 1 — nicht neu herleiten, aber per CRG/ctx gegenprüfen)

- **Vektorraum:** EINE Qdrant-Collection `ua_lsa_chunks` mit Payload-Indizes auf `trust_level`, `subject`, `confession_context` (ADR 0010). Vektor-Dim aus `OLLAMA_EMBEDDING_DIM` (Default 2560, qwen3-embedding:4b), Cosine.
- **Infra-Clients (hinter Interfaces + deterministische Fakes):**
  - `src/lib/infra/qdrant.ts` — `VectorStore { ensureCollection(); upsertPoints(); search(vector, filter, limit?); deleteByFilter(); }`; `SearchFilter { trustLevelNot?; subject?; confessionContextIn?; sourceId? }`; `QdrantStore` (REST) + `FakeVectorStore` (in-memory, deterministisch).
  - `src/lib/infra/ollama.ts` — `Embedder { embed(texts): Promise<number[][]> }`; `OllamaEmbedder` (local-only, `${OLLAMA_BASE_URL}/api/embeddings`, qwen3-embedding:4b) + `FakeEmbedder` (dim aus Env).
- **Chunk-Speicher:** `src/lib/db/schema/rag.ts` → `rag_chunk` (`sourceRefId`, `chunkText`, `pageOrSection`, `sourceVersion`, `contentHash`, `embeddingRef` = Qdrant-Point-ID, `trustLevel`, `subject`, `confessionContext`, `license`, `retrievedAt`). Qdrant-Payload je Punkt: `source_id, trust_level, subject, confession_context, page_or_section, source_version, license, retrieved_at, content_hash`.
- **Quellen-Metadaten für Zitation:** `source_ref` (`title`, `uri`, `authorOrganization`, `licenseInfo`, `publishedDate`, `sourceVersion`, `retrievedAt`, `subjectAlignment`, `confessionContext`, `lifecycleStatus`, `sourceType` = Trust). `src/lib/db/repositories/sources.pg.ts` (`SourceRepository`, fail-closed Trust-Gate).
- **Ingestion:** `src/lib/rag/ingest.ts` (`ingestSource`), `src/lib/rag/{extract,chunk,qdrant}.ts`.
- **Repository-Backend:** Factory `mock ↔ db` per `REPOSITORY_BACKEND` (`src/lib/db/repositories/factory.ts`). Tests: Vitest + Testcontainers (`postgres:16`, `fileParallelism:false`, `pool:forks`, datei-eindeutige IDs), Qdrant/Ollama über Fakes.

## Bindende Grundsätze + Governance (kritisch, nicht verhandelbar)

1. **Quellenpflicht** — jeder zurückgegebene Treffer trägt Quelle, Version, Abschnitt/Seite, Abrufdatum. Kein Treffer ohne vollständige Zitation.
2. **Konfessionstrennung — kein Cross-Strang-Retrieval.** Der Konfessionsfilter ist serverseitig PFLICHT. **Achtung (TODO(M2-RAG) in `src/lib/db/repositories/mapping.ts`):** Ein UI-Filter `evangelische-religion` muss auf `confession_context IN ('EVANGELISCH','KONFESSIONSSENSIBEL_UEBERGREIFEND')` abbilden — **NICHT** Gleichheit `= 'EVANGELISCH'`, sonst werden konfessionssensibel-übergreifende Stränge fälschlich ausgeblendet. Ethik (`RELIGIONSKUNDLICH`) ist getrennt; nie Religion und Ethik vermischen.
3. **UNVERIFIED nie produktiv** — Retrieval filtert `trust_level != UNVERIFIED` hart (fail-closed). Optional konfigurierbare Mindest-Trust-Stufe.
4. **Local-first** — Embedding/Reranking local (Ollama / lokale Modelle). KEIN Cloud-LLM ohne `CloudReleaseGrant`.
5. **Menschliche Finalentscheidung** — Retrieval liefert Vorschläge + Confidence/Unsicherheit, trifft keine Bewertung. „Prüfen", nicht „Übernehmen".

## Scope Schritt 2

- **Query-Embedding** (Embedder) → **Qdrant-Retrieval** mit Pflicht-Payload-Filtern (Fach, Konfession via IN-Liste, `trust_level != UNVERIFIED`).
- **Reranking** der Kandidaten (local-first — z. B. score-/MMR-basiert oder lokaler Cross-Encoder; Wahl in Plan-Mode begründen, nicht ungefragt schwere Deps ziehen).
- **Zitations-Assemblierung** nach `docs/rag/CITATION_STANDARD.md`: aus `rag_chunk` + `source_ref` je Treffer eine Zitation (Titel, Herausgeber, Version, Abschnitt/Seite, Abrufdatum, Lizenz, Trust, URI) + Confidence-Markierung.
- **Öffentliche API** z. B. `retrieve(query, { subject, confession, minTrust, k }): Promise<RankedCitation[]>` — fail-closed, deterministisch testbar gegen `FakeVectorStore`/`FakeEmbedder`.
- Optional minimal: Read-Anbindung an die UI (kein neuer Freigabe-/Admin-Workflow = M4).

## Relevante offene Issues (Bezug herstellen, ggf. mit-erledigen)

- **#18** (dieser Schritt) Retrieval, Reranking und Zitationsstandard.
- **#39** (p1) `entries()`/Retrieval: RELIGION/ETHIK dürfen nicht als „deutsch" verdeckt werden — Konfession real auflösen. Direkt relevant für korrekte Retrieval-Filter.
- **#44** `rag_chunk` Drizzle-Relations — nützlich für typsichere Joins rag_chunk ↔ source_ref bei der Zitation.
- **#45** echter Qdrant/Ollama-E2E-Test (gegated) — passt zur Retrieval-Verifikation.

## Constraints / Workflow

- **pnpm** only, TypeScript strict. PR-Workflow, **nie auf `main`**. Neuer Branch z. B. `m2/retrieval-zitation` von `main` (`3d236e4`).
- Migrations-Reviewpflicht (ADR 0005): keine ad-hoc `DELETE`/`UPDATE` in `drizzle/*.sql`; Schema-Drift-Gate.
- Vor Commit: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm db:check`, `pnpm verify:docs`.
- **Auto-Commit-Hook greift NICHT bei Workflow-Subagenten** — nach dem Lauf `git status` prüfen und selbst committen.
- **CRG-Hook:** bei langem Lauf läuft die 15-min-Grace ab → Bash mit `tail -N`/`--stat` wird geblockt; einen CRG-Tool-Call absetzen reaktiviert die Grace.

## Zuerst lesen

`PLAN.md` (Roadmap M2), `docs/rag/CITATION_STANDARD.md`, `docs/architecture/RAG_ARCHITECTURE.md`, `docs/adr/0010-rag-ingestion-qdrant.md`, `docs/rag/INGESTION_POLICY.md`. Bestand per CRG (`semantic_search_nodes`, `query_graph`) + ctx verifizieren, nicht blind dem Prompt vertrauen.

## Erwartetes Vorgehen

Plan-Mode zuerst: Bestand gegen Codestand verifizieren (CRG/ctx), Reranking-Ansatz begründet wählen, dann dynamischen Workflow (günstige Agenten für Mechanik, stärkeres Modell für Filter-/Zitations-Korrektheit) mit adversarialem Review der Governance-Garantien (Konfessions-IN-Filter, UNVERIFIED-Ausschluss, Zitations-Vollständigkeit). Plan vor Ausführung vorlegen.
