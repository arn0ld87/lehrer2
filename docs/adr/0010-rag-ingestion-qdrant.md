# 0010: RAG-Ingestierung via Qdrant — Eine Collection mit Payload-Filtern

## Status

**Akzeptiert, 2026-06-22** — vom Maintainer im Review angenommen.
0010: EINE Qdrant-Collection `ua_lsa_chunks` mit harten Payload-Filtern (trust_level, subject, confession_context) statt separater Collections pro Fach/Konfession. Local-first Embedding via Ollama (qwen3-embedding:4b), kein Cloud-Pfad. Textextraktion Schritt 1: text/plain/html + pdf-parse; OCR (Scan-PDFs) ausgenommen → M2.4.

## Kontext

Die RAG-Pipeline der Unterrichtsassistenz LSA muss Konfessionstrennung (evangelisch/katholisch/konfessionssensibel/ethik) und Fachkontext (Deutsch, Religion, Ethik) **zwingend** durchsetzen — ein Schüler evangelischer Konfession darf nicht auf katholische Lehrinhalte zugreifen, und Religion-Quellen dürfen sich nicht mit Deutsch-Materialien vermischen.

Die Frage war: Separate Qdrant-Collections pro Fach/Konfession (Index-Explosion, aber strikte Separation) oder EINE Collection mit serverseitigen Payload-Filtern (schlanker, aber Fehlerrisiko bei fehlerhafter Filterung)?

Anforderungen:

- **Konfessionstrennung**: fail-closed, nicht verhandelbar.
- **Local-first**: Ollama default, keine Cloud-Embedding-APIs.
- **Skalierbarkeit**: Schritt 1 bewältigt ein MVP-Quellenset (ca. 500–1000 Chunks).
- **Einfachheit**: Embedding-Modell-Updates sollen nicht zur Index-Neuorganisation führen.

## Optionen

| Architektur                                | Vorteile                                             | Nachteile                                                |
| ------------------------------------------ | ---------------------------------------------------- | -------------------------------------------------------- |
| **EINE Collection + Payload-Filter**       | Schlank, eine Embedding-Dimension, einfach zu warten | Filterlogik fehlbar, serverseitig erzwungen              |
| Separate Collections pro Fach              | Strikte Separation, schnelle Fach-Filter-Queries     | Index-Verwaltung (6–9 Collections), Embedding-Duplikate  |
| Separate Collections pro Fach + Konfession | Maximal strikte Separation (bis zu 12+ Collections)  | Hochkomplex, Ingestion-Overhead, Partition-Fragmentation |
| Hybrid: Core-Collection + Konfessions-Tags | Mittelweg Komplexität/Sicherheit                     | Dual-Layer-Filterung nötig, Design-Overhead              |

## Entscheidung

**EINE Qdrant-Collection `ua_lsa_chunks`** mit Pflicht-Payload-Filtern:

- **Collection-Name**: `ua_lsa_chunks`
- **Payload-Pflichtfelder**:
  - `trust_level` (OFFICIAL_BINDING, OFFICIAL_GUIDANCE, OPEN_CURATED, USER_APPROVED, UNVERIFIED)
  - `subject` (DEUTSCH, RELIGION, ETHIK)
  - `confession_context` (EVANGELISCH, KATHOLISCH, KONFESSIONSSENSIBEL_UEBERGREIFEND, RELIGIONSKUNDLICH, NICHT_ANWENDBAR)
  - `valid_from`, `valid_to` (Gültigkeitsfenster)
  - `revoked_at` (NULL = aktiv, sonst Revocation-Datum)
  - `content_hash` (SHA-256 für Duplikat-Erkennung)
  - `source_id` (UUID der Quelle)
  - `page_or_section` (Bezug zur Originalquelle für Zitation)
- **Embedding-Modell**: Ollama `qwen3-embedding:4b` (Default, lokal).
- **Vektordimension**: 384 (qwen3-4b).
- **Textextraktion Schritt 1**: `text/plain`, `text/html`, `application/pdf` (via `pdf-parse`); **OCR-PDFs ausgenommen** (Scan-PDFs ohne Text-Layer scheitern fail-laut bis OCR-Worker verfügbar, vgl. M2.4).

### Retrieval-Filter (serverseitig, NOT OPTIONAL)

Jede Query wird mit **Pflicht-Filtern** ausgeführt:

```
trust_level IN (OFFICIAL_BINDING, OFFICIAL_GUIDANCE, OPEN_CURATED, USER_APPROVED)
AND confession_context IN (<user_confession_scope>)
AND subject = <current_subject>
AND (valid_from IS NULL OR valid_from <= today)
AND (valid_to IS NULL OR valid_to >= today)
AND revoked_at IS NULL
```

Diese Filter sind **nicht optional** — sie werden von der Applikation erzwungen, nicht vom User deaktivierbar.

### Konfessions-Invariante (DB-CHECK am `curriculum_strand`)

Existierende DB-Invariante (ADR 0006, `src/lib/db/schema/curriculum.ts`):

- RELIGION → confession_context IN (EVANGELISCH, KATHOLISCH, KONFESSIONSSENSIBEL_UEBERGREIFEND)
- ETHIK → confession_context IN (RELIGIONSKUNDLICH, NICHT_ANWENDBAR)
- DEUTSCH → NICHT_ANWENDBAR
- Cross-Strang-Retrieval ist durch Payload-Filter ausgeschlossen.

## Wichtigste Gegenstimmen (dokumentiert)

- **Separate Collections pro Fach/Konfession gäbe maximal Sicherheit** — kein Filterlogik-Risiko, Index-Separation. Entgegnung: Für MVP unjustifiziert komplex; eine Collection + **serverseitig erzwungene** Filter + **kontinuierliche Audit-Logs** (jeder gefilterte Zugriff protokolliert) bieten gleiche fail-closed-Garantie bei 1/6 der Komplexität.
- **Hybrid-Ansatz (Core + Tags)** hätte Mittelweg-Appeal — Entgegnung: Dual-Layer-Filterung erhöht Fehlerrisiko; single-layer (Collection + Payload) ist einfacher zu verifizieren.

## Offene Fragen (für Post-Akzeptanz-Review)

1. Wann wird der OCR-Worker (M2.4) verfügbar sein, um Scan-PDFs zu unterstützen?
2. Audit-Logging: Welche Abfragepatterns (Fach, Konfession, Quellen-Ranking) sollen pro Query protokolliert werden?
3. Embedding-Drift: Falls `qwen3-embedding:4b` durch besseres lokales Modell ersetzt wird — wie wird Re-Embedding aller bestehenden Chunks orchestriert (Downtime-Fenster)?

## Konsequenzen

- **M2 Schritt 1 (Quellen-RAG-Gerüst)**:
  - Ingestion-Job (`src/lib/rag/ingestion/index.ts` o.ä.) schreibt Chunks nur nach Qdrant, wenn `trust_level != UNVERIFIED` und alle Payload-Pflichtfelder vollständig.
  - Qdrant-Client-Wrapper (`src/lib/rag/qdrant/search.ts`) setzt **immer** die Konfessions-/Fachkontext-Filter vor Query.
  - Textextraktion: `text/plain`, `text/html`, `pdf-parse` (native Bindings); Scan-PDFs landen in Fehler-Queue.
  - Tests: Vitest + `@qdrant/js-client` (Mock/Integration); Payload-Filter-Ablauf muss zu 100 % dekken.
- **M2 Schritt 4 (OCR-Worker)**: Separate Infrastruktur für Scan-PDF-Verarbeitung (z.B. Tesseract + Ollama-Embedding).
- **Audit & Monitoring**: Alle erfolgreichen + gefilterten Retrievals loggen (subject, confession, result_count, latency).

## Verweise

- [../architecture/RAG_ARCHITECTURE.md](../architecture/RAG_ARCHITECTURE.md) — Retrieval-Pipeline, Trust-Levels, Chunk-Pflichtfelder.
- [../rag/INGESTION_POLICY.md](../rag/INGESTION_POLICY.md) — Governance vor Ingestierung, Embedding-Abschnitt 5.
- [../architecture/DATA_MODEL.md](../architecture/DATA_MODEL.md) — RagChunk-Schema, curriculum_strand-Konfessions-CHECK.
- Qdrant Docs: <https://qdrant.tech/documentation/>
- Ollama Models: <https://ollama.ai> (qwen3-embedding:4b)
- pdf-parse: <https://github.com/modesty/pdf-parse>
