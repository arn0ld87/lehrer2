# OCR-Worker — Asynchrone Scan-PDF-Ingestion

## Überblick

Scan-PDFs (gescannte Dokumente ohne digitalen Text) können von `pdf-parse` nicht extrahiert werden.
Der OCR-Worker löst dieses Problem durch asynchrone, isolierte OCR-Verarbeitung via
[BullMQ](https://docs.bullmq.io/) und [Tesseract](https://github.com/tesseract-ocr/tesseract).

Architektur-Grundlage: [ADR 0001 — Modularer Monolith](../adr/0001-modular-monolith-first.md)
(synchrone OCR-Calls verboten; separater Worker-Entrypoint).

---

## Architektur

```
Scan-PDF erkannt (extract.ts: pdf-parse liefert leer)
    ↓
enqueueOcrJob(sourceRefId)          ← src/lib/rag/ocr/queue.ts
    ↓ (BullMQ, Redis)
Worker empfängt Job                 ← worker/ocr-worker.ts
    ↓
processOcrJob(deps, jobData)        ← pure Funktion, testbar ohne Redis
    ↓
ingestSource(deps, sourceRefId)     ← src/lib/rag/ingest.ts (mit deps.ocr)
    ↓
extractContent(..., ocrEngine)      ← src/lib/rag/extract.ts
    ↓
TesseractOcrEngine.recognizePdf()   ← src/lib/rag/ocr/tesseract-engine.ts
    ↓
sanitizeOcrText()                   ← src/lib/rag/ocr/engine.ts
    ↓
Text → chunkText → embed → Qdrant + PG
```

---

## Komponenten

### `src/lib/rag/ocr/engine.ts`

- `OcrEngine` — Interface für alle OCR-Implementierungen
- `sanitizeOcrText(raw)` — Bereinigung (Steuerzeichen, HTML-Tags; siehe §Sicherheit)
- `FakeOcrEngine` — konfigurierbarer Fake für Tests

### `src/lib/rag/ocr/tesseract-engine.ts`

- `TesseractOcrEngine implements OcrEngine`
- Rastert PDF-Seiten via `pdftoppm` (poppler) zu PNG (300 DPI)
- OCR via `tesseract` (deutsch + englisch: `-l deu+eng`)
- Temp-Verzeichnis wird immer bereinigt (auch bei Fehler)
- **Laufzeit-only** — nicht in CI getestet (keine Binaries in CI)

### `src/lib/rag/ocr/queue.ts`

- BullMQ-Queue-Definition (`ocr`-Queue)
- `OcrJobData { sourceRefId: string }`
- `enqueueOcrJob(sourceRefId)` — lazy Redis-Verbindung (kein Top-Level-Connect)
- Redis-URL aus `REDIS_URL` (Env)

### `src/lib/rag/extract.ts` (erweitert)

- `extractContent(uri, buf, mime, ocrEngine?)` — optionaler 4. Parameter
- PDF + leerer Text + `ocrEngine` → OCR-Fallback
- PDF + leerer Text + kein `ocrEngine` → `ExtractionFailedError` (bisheriges Verhalten bleibt)

### `src/lib/rag/ingest.ts` (erweitert)

- `IngestDeps.ocr?: OcrEngine` — optional, wird an `extractContent` weitergereicht

### `worker/ocr-worker.ts`

- `processOcrJob(deps, jobData)` — pure Kern-Logik, unit-testbar
- BullMQ-Worker als dünner Glue (kein Connect bei Import)
- Graceful Shutdown (SIGTERM, SIGINT)
- Start via `OCR_WORKER_AUTOSTART=1` (Dockerfile) oder direktem Aufruf

---

## Sicherheit

Gemäß [UPLOAD_AND_OCR_SECURITY.md §2.3](../security/UPLOAD_AND_OCR_SECURITY.md) und
[THREAT_MODEL.md §3](../security/THREAT_MODEL.md):

**`sanitizeOcrText` wendet an:**

1. C0/C1-Steuerzeichen entfernen (außer `\t`, `\n`, `\r`) — kein LaTeX/JS-Durchschlag
2. `<script>`/`<style>`-Blöcke entfernen — kein XSS
3. Alle HTML-Tags entfernen
4. HTML-Entities normalisieren
5. Mehrfache Leerzeichen normalisieren
6. Trimmen

`recognizePdf` MUSS `sanitizeOcrText` anwenden (Interface-Verpflichtung).

---

## Fehlerbehandlung

| Situation                                   | Verhalten                         |
| ------------------------------------------- | --------------------------------- |
| `pdftoppm` nicht gefunden                   | `Error` mit Installationshinweis  |
| `tesseract` nicht gefunden                  | `Error` mit Installationshinweis  |
| OCR liefert leeren Text                     | `Error` (fail-laut)               |
| OCR-Engine in `extractContent` liefert leer | `ExtractionFailedError` mit URI   |
| BullMQ-Job schlägt fehl                     | Retry (3×, exponentiell); Logging |

---

## Deployment (Docker Compose)

```yaml
ocr-worker:
  build: ./services/ocr-worker
  depends_on: [redis, minio, postgres]
  environment:
    DATABASE_URL: ...
    REDIS_URL: ...
    OCR_WORKER_AUTOSTART: "1"
```

Container installiert: `tesseract-ocr`, `tesseract-ocr-deu`, `poppler-utils`.

---

## Tests

| Test                                                        | Art                          | Läuft in CI? |
| ----------------------------------------------------------- | ---------------------------- | ------------ |
| `engine.test.ts` — `sanitizeOcrText`, `FakeOcrEngine`       | Unit                         | Ja           |
| `extract-ocr.test.ts` — `extractContent` mit OCR-Fallback   | Unit (pdf-parse gemockt)     | Ja           |
| `process-ocr-job.test.ts` — `processOcrJob` mit Fakes + PG  | Integration (Testcontainers) | Ja           |
| `tesseract-engine.e2e.test.ts` — echte `TesseractOcrEngine` | E2E (nur `OCR_E2E=1`)        | Nein         |

---

## Referenzen

- [ADR 0001 — Modularer Monolith](../adr/0001-modular-monolith-first.md)
- [INGESTION_POLICY.md §3](./INGESTION_POLICY.md)
- [UPLOAD_AND_OCR_SECURITY.md](../security/UPLOAD_AND_OCR_SECURITY.md)
- [THREAT_MODEL.md §3](../security/THREAT_MODEL.md)
