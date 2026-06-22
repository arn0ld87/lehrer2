# Austauschbare Integrationsgrenzen

Jede kritische externe Abhängigkeit (LLM-Provider, Speicher, Vektor-Suche, Job-Queue, OCR) ist hinter einer klar definierten Schnittstelle versteckt. Ein Austausch braucht nur eine neue Adapter-Implementierung, keine API-Änderungen.

---

## 1. LLM-Provider-Adapter

### Zweck

Alle Interaktionen mit großen Sprachmodellen (Unterrichtsplanung, Materialgenerierung, Korrektur-Feedback, Prompt-Bearbeitung) laufen durch eine einzige abstrahierte Schnittstelle, unabhängig davon, ob das Modell lokal (Ollama) oder in der Cloud (OpenAI, Anthropic) läuft.

### Schnittstellenvertrag

```typescript
interface LLMProvider {
  // Einfacher LLM-Call
  call(prompt: string, context?: CallContext): Promise<string>;

  // Strukturierter Output (z.B. JSON)
  callStructured<T>(prompt: string, schema: JSONSchema, context?: CallContext): Promise<T>;

  // Token-Zählung (für Budgeting)
  estimateTokens(prompt: string): number;
}

interface CallContext {
  schoolId: string;
  userId: string;
  destinationProvider: "ollama" | "openai" | "anthropic" | "custom";
  timeout?: number;
  maxTokens?: number;
}
```

**Eingaben**

- `prompt`: Fertig redacted, datenschutz-approved Text
- `context`: Tenant-Info, Provider-Ziel, Optional-Parameter

**Ausgaben**

- `response`: Textvollständigung oder strukturiertes Objekt
- Fehlerbehandlung: Timeout, Rate-Limit, Network-Error (mit Retry-Logik)

### Austauschbarkeit

**Standard-Implementierung: Ollama (lokal)**

- URL: `http://localhost:11434`
- Modell: Konfigurierbar (z.B. `mistral`, `neural-chat`)
- Kosten: 0 € (läuft im Schulnetz)
- Datenschutz: Vollständig lokal, keine Datenübertragung nach außen

**Alternative 1: OpenAI (Cloud)**

- API-Key aus Umgebungsvariable / Vaultwarden
- Modell: z.B. `gpt-4o-mini`
- Kosten: Pay-as-you-go (~$0.003 pro 1K Prompt-Tokens)
- Datenschutz: Cloud-Speicherung, nur mit Schulfreigabe (siehe Gate unten)

**Alternative 2: Anthropic Claude (Cloud)**

- API-Key aus Vaultwarden
- Modell: z.B. `claude-3-haiku-20240307`
- Kosten: Pay-as-you-go
- Datenschutz: Cloud-Speicherung, Schulfreigabe erforderlich

**Alternative 3: OpenAI-kompatible lokale APIs**

- z.B. vLLM, llama.cpp mit OpenAI-Wrapper
- Interface identisch mit OpenAI
- Kosten: 0 € oder Eigeninfrastruktur
- Datenschutz: Lokal oder auf Schulserver

### Datenschutz- und Sicherheitsauflagen

**KRITISCH: Datenschutz-Gate PRE-Call, nicht POST-Call**

Jede Anfrage an einen LLM-Provider MUSS die folgende Prüfung durchlaufen:

```python
def validate_before_llm_call(payload: Dict, provider: str) -> bool:
    """
    Gate-Logik VOR jedem LLM-Call.
    Fail-Closed: Bei Unsicherheit blocken.
    """

    # Schritt 1: Datenklassifikation
    for field_name, field_value in payload.items():
        data_class = classify_data(field_name, field_value)

        # PERSONAL_TEACHER oder SENSITIVE_STUDENT
        # darf nie unredacted an Cloud-Provider
        if data_class in [DataClass.PERSONAL_TEACHER,
                         DataClass.SENSITIVE_STUDENT]:

            if provider in ['openai', 'anthropic', 'cloud']:
                # Cloud-Provider: Redaction verpflichtend
                if not is_redacted(field_value):
                    log_block('UNREDACTED SENSITIVE DATA', field_name, payload)
                    return False

                # Zusätzlich: Schulfreigabe erforderlich
                school_id = payload.get('school_id')
                if not school_has_cloud_approval(school_id):
                    log_block('NO CLOUD APPROVAL', school_id, payload)
                    return False

            elif provider == 'ollama':
                # Lokal: Auditable, aber Redaction immer empfohlen
                log_audit('SENSITIVE DATA TO LOCAL LLM', field_name,
                         school_id=payload.get('school_id'))

    # Schritt 2: Provider-Spezifische Auflagen
    if provider in ['openai', 'anthropic']:
        # Keine Schüler-Klarnamen, keine Lehrer-Vollnamen
        if contains_student_name(payload):
            log_block('STUDENT NAMES IN CLOUD CALL', payload)
            return False

    # Schritt 3: Logging
    log_llm_call_request(
        provider=provider,
        school_id=payload.get('school_id'),
        user_id=payload.get('user_id'),
        data_classes=[classify_data(k, v) for k, v in payload.items()],
        approved=True
    )

    return True
```

**Konkrete Regeln**:

1. **Lokale Provider (Ollama, llama.cpp)**
   - Schüler-Klarnamen: NUR REDACTED (z.B. "SuS_001")
   - Lehrer-Namen: Nur Pseudonym oder "Lehrkraft"
   - Loggen: Welche Daten gesendet, an wen, wann

2. **Cloud-Provider (OpenAI, Anthropic, Custom)**
   - **KEIN** Schüler-Klarname je ohne Redaction
   - **KEIN** Lehrer-Klarname (verwende Pseudonym oder Rollen-Bezeichner)
   - **KEIN** Schul-Identifizierer mit Personendaten kombiniert
   - Schulfreigabe-Dokument vorhanden & revisionssicher gelagert (Audit-Table)
   - Transparenz: Lehrkräfte wissen, dass ein Cloud-Call stattfinden wird

3. **Datenschutz-Audit bei Skalierung**
   - Quartalweise Audit-Log-Analyse
   - Welche Schulen nutzten Cloud-Provider, wie viele Calls, welche Datenklassen
   - Anomalien-Detektion (z.B. neue Datenlecks-Pattern)

---

## 2. Objekt-Speicher (S3-kompatibel)

### Zweck

Speichern von Rohunterlagen (PDFs, DOCX), generierten Materialien, Extraktions-Outputs und Korrektur-Batches. Lokale Entwicklung nutzt MinIO, Produktion optional AWS S3.

### Schnittstellenvertrag

```typescript
interface ObjectStore {
  // Upload mit Metadaten
  put(key: string, data: Buffer | Stream, metadata?: Metadata): Promise<string>;

  // Download
  get(key: string): Promise<Buffer>;

  // Metadata auslesen
  getMetadata(key: string): Promise<Metadata>;

  // Löschen
  delete(key: string): Promise<void>;

  // Listing (mit Prefix)
  list(prefix: string): Promise<ObjectSummary[]>;
}

interface Metadata {
  contentType: string;
  contentLength: number;
  createdAt: Date;
  schoolId: string;
  userId: string;
  dataClass: DataClass;
  retentionDays?: number;
}
```

**Eingaben**

- `key`: S3-Pfad, z.B. `schools/01-gymnasium/materials/unterrichtsplan_2024_q1.pdf`
- `data`: Datei-Inhalt (Binär oder Stream)
- `metadata`: School-ID, Datenklasse, Aufbewahrungs-Fristetengo

**Ausgaben**

- `url` oder `etag`: Referenz für spätere Abrufe, Versionskontrolle

### Austauschbarkeit

**Standard: MinIO (lokal, S3-kompatibel)**

- Docker-Image: `minio/minio`
- Zugang: `http://localhost:9000`
- Kosten: 0 €, Eigeninfrastruktur
- Datenschutz: Vollständig lokal, Encryption-at-Rest optional

**Alternative: AWS S3**

- Bucket: `lsa-<environment>`
- Kosten: ~$0.023 pro GB/Monat + API-Calls
- Datenschutz: AWS Dublin Region (EU), SSE-S3 Standard
- Backup: Versionierung & Cross-Region Replication

**Alternative: DigitalOcean Spaces**

- S3-kompatible API, einfacheres Pricing
- Kosten: $5/Monat + Überlauf
- Datenschutz: EU-Region verfügbar

### Datenschutz- und Sicherheitsauflagen

1. **Zugriffskontrolle**
   - Nur Lehrkraft einer Schule kann auf `schools/<schoolId>/*` zugreifen
   - Middleware erzwingt `schoolId` Validierung vor GET/PUT

2. **Speicher-Klassifizierung**
   - Metadaten-Feld `dataClass` (INTERNAL, PERSONAL_TEACHER, SENSITIVE_STUDENT)
   - SENSITIVE_STUDENT-Dateien: Automatische Löschung nach Retention-Periode

3. **Verschlüsselung**
   - In Transit: TLS 1.3
   - At Rest: Server-Side Encryption (MinIO, S3 Standard)
   - Client-side Encryption: Optional für höchste Stufe

4. **Audit-Trail**
   - S3 Object Lock / MFA-Delete optional für Compliance
   - Alle Zugriffe werden in Audit-Log geloggt (who, when, action, IP)

5. **Aufbewahrungsfrist**
   - INTERNAL: 1 Jahr
   - PERSONAL_TEACHER: 3 Jahre (Rechtskonformität)
   - SENSITIVE_STUDENT: Automatisch nach Ende des Schuljahrs + 2 Monate

---

## 3. Vektor-Datenbank (Qdrant)

### Zweck

Semantische Suche über Unterrichtsmaterialien. Embeddings von Lehrplan-Standards, Beispiel-Arbeitsblättern und Lehrkraft-eigenen Materialien ermöglichen relevante Kontext-Auswahl für RAG.

### Schnittstellenvertrag

```typescript
interface VectorStore {
  // Vektor speichern
  upsert(id: string, vector: number[], payload: VectorPayload): Promise<void>;

  // Semantische Suche
  search(query: number[], topK: number, filters?: Filter): Promise<SearchHit[]>;

  // Batch upsert
  upsertBatch(vectors: VectorInput[]): Promise<void>;

  // Löschen
  delete(id: string): Promise<void>;
}

interface VectorPayload {
  schoolId: string;
  materialId: string;
  title: string;
  type: "lehrplan" | "arbeitsblatt" | "aufgabe" | "source";
  trustLevel: RAGTrustLevel; // OFFICIAL_BINDING, OFFICIAL_GUIDANCE, ...
  url?: string;
  createdAt: Date;
}

interface SearchHit {
  id: string;
  score: number;
  payload: VectorPayload;
}
```

**Eingaben**

- `query`: Embedding-Vektor (z.B. 384-Dim für `all-minilm-l6-v2`)
- `topK`: Anzahl Ergebnisse
- `filters`: z.B. `{schoolId: "gymnasium-01", trustLevel: ">= OFFICIAL_GUIDANCE"}`

**Ausgaben**

- `hits`: Ranked List mit IDs, Scores, Metadaten
- Score ist Cosine-Similarity (0–1)

### Austauschbarkeit

**Standard: Qdrant (lokal oder Cloud)**

- Docker: `qdrant/qdrant`
- URL: `http://localhost:6333`
- Kosten (lokal): 0 €; Cloud: ~$19/Monat Starter
- Datenschutz: Lokal vollständig privat, Cloud mit Verschlüsselung

**Alternative 1: Weaviate**

- Docker: `semitechnologies/weaviate`
- Ähnliche API, etwas anders strukturiert
- Kosten: Open-Source oder Cloud

**Alternative 2: Milvus**

- Hochperformant für große Datenmengen
- Komplexer Deployment
- Open-Source

### Datenschutz- und Sicherheitsauflagen

1. **Payload-Klassifizierung**
   - Speicher `trustLevel` als Metadatum jedes Vectors
   - Filterung bei Search: trustLevel-Threshold basierend auf Kontext

2. **Zugriffskontrolle**
   - Collections pro Schule: `materials_<schoolId>`
   - Query erzwingt `schoolId`-Filter

3. **Keine Schüler-Daten**
   - Embeddings enthalten KEINE PERSÖNLICHEN Schüler-Informationen
   - Nur Aggregates ("Lernstand Klasse 7 im Schnitt Niveau B1")

4. **Audit & Retention**
   - Logging: Welche Queries, Filters, Top-K-Werte
   - Alte Embeddings: Löschen nach Material-Archivierung

---

## 4. Job-Queue (Redis + BullMQ)

### Zweck

Asynchrone Verarbeitung von langen Tasks: OCR, LLM-Calls (besonders bei Batch), Datengenerierung. Verhindert Timeouts bei HTTP-Requests, ermöglicht Retry-Logik und Dead-Letter-Handling.

### Schnittstellenvertrag

```typescript
interface JobQueue {
  // Job enqueuen
  enqueue<T>(type: string, payload: T, options?: JobOptions): Promise<Job>;

  // Worker registrieren
  process<T>(type: string, handler: (job: Job<T>) => Promise<void>);

  // Job-Status abfragen
  getJob(jobId: string): Promise<Job | null>;

  // Dead-Letter-Queue
  getDeadLetterJobs(): Promise<Job[]>;
}

interface JobOptions {
  priority?: number;
  attempts?: number;
  backoff?: "exponential" | "linear";
  delay?: number;
  timeout?: number;
}

interface Job<T> {
  id: string;
  type: string;
  payload: T;
  status: "pending" | "active" | "completed" | "failed";
  progress?: number;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}
```

**Eingaben**

- `type`: Job-Typ (z.B. `ocr_extract`, `llm_batch_correction`)
- `payload`: Daten (Datei-Path, LLM-Prompt, Korrektur-Batch)
- `options`: Retry-Strategie, Priorität, Timeout

**Ausgaben**

- `jobId`: Eindeutige Job-Referenz
- Status-Updates: Polling oder Websocket
- Completion: Success-Payload oder Error-Detail

### Austauschbarkeit

**Standard: Redis + BullMQ**

- Redis: Docker `redis:7-alpine`
- BullMQ: npm Package
- Kosten: 0 € lokal; ~$19/Monat Redis Cloud
- Datenschutz: Lokal privat, Cloud mit Verschlüsselung

**Alternative 1: RabbitMQ**

- Docker: `rabbitmq:4-management`
- Komplexerer Setup, aber enterprise-ready
- Kosten: Open-Source oder Cloud

**Alternative 2: Apache Kafka**

- Für sehr hohe Throughput (100k+ Jobs/Tag)
- Overhead für kleine Schulen

### Datenschutz- und Sicherheitsauflagen

1. **Payload-Encryption**
   - Sensitive Job-Payloads (SENSITIVE_STUDENT Korrekturen) müssen encrypted in Queue
   - Entschlüsselung nur beim Worker (lokal)

2. **Job-Isolation**
   - Jobs enthalten `schoolId`, Worker filtert nach Schule
   - Cross-School-Jobs sind nicht erlaubt

3. **Retention & Cleanup**
   - Completed Jobs: 30 Tage
   - Failed Jobs (DLQ): 90 Tage (für Audit)
   - Dann automatisch löschen

4. **Monitoring**
   - Alerts bei: DLQ-Wachstum, Job-Timeouts, Retry-Explosionen
   - Logging: Job-Type, Payload-Size, School-ID, Duration

---

## 5. OCR- & Extraktions-Worker

### Zweck

Unstrukturierte Eingaben (Scans, Bilder, Tabellen) in strukturierte Extrakte (JSON) umwandeln. Entkoppelt vom Haupt-App-Prozess, läuft als separater Container.

### Schnittstellenvertrag

```typescript
interface OCRWorker {
  // Bild → Text
  extractText(imageFile: Buffer): Promise<ExtractedText>;

  // Tabelle → JSON
  extractTable(imageFile: Buffer): Promise<Table>;

  // Multipage PDF → Strukturierter Output
  extractFromPDF(pdfBuffer: Buffer): Promise<DocumentExtrakt>;

  // Async Job-API (für lange PDFs)
  submitExtraction(jobId: string, inputPath: string): Promise<{ jobId: string; statusUrl: string }>;
}

interface ExtractedText {
  text: string;
  confidence: number; // 0.0–1.0
  language: string;
  bbox?: Array<{ text: string; coords: [x0, y0, x1, y1] }>;
}

interface Table {
  rows: Array<Array<string>>;
  confidence: number;
}

interface DocumentExtrakt {
  pages: Array<{
    pageNum: number;
    text: string;
    tables: Table[];
    textBlocks: Array<{ bbox; text }>;
  }>;
  metadata: {
    totalPages: number;
    language: string;
    extractedAt: Date;
  };
}
```

**Eingaben**

- `file`: Image/PDF-Buffer
- `format`: "image" | "pdf"
- Optional: Language-Hint, Retention-Days

**Ausgaben**

- `extract`: Strukturierter Text + Tabellen + Bounding Boxes
- `confidence`: Qualitätsscore für Audit

### Austauschbarkeit

**Standard: Tesseract + PyMuPDF (lokal)**

- Docker: Custom Image mit `tesseract-ocr` + `python3` + `pymupdf`
- Kosten: 0 €
- Datenschutz: Vollständig lokal

**Alternative 1: Google Cloud Vision API**

- Cloud-Service, bessere Genauigkeit
- Kosten: $1.50–$6 pro 1K Bilder
- Datenschutz: Cloud-Upload erforderlich, Schulfreigabe nötig

**Alternative 2: AWS Textract**

- Tabellen-Erkennung sehr zuverlässig
- Kosten: $1–$2 pro Seite
- Datenschutz: Ähnlich Vision API

### Datenschutz- und Sicherheitsauflagen

1. **Worker-Isolation**
   - Worker läuft als separater Container mit reduzierten Permissions
   - Datenzugriff nur über Job-Queue (keine direkte DB-Verbindung)

2. **Input-Validation**
   - Datei-Größe max. 50 MB pro Job
   - Erlaubte MIME-Types: `image/jpeg`, `image/png`, `application/pdf`
   - Timeout: 5 Min pro Extraction

3. **Payload-Handling**
   - Input: PDF-Pfad oder S3-Key (nie Inline-Upload > 10MB)
   - Output: Direkt in Object Store, nicht über Job-Queue zurück
   - Job-Status: `pending → active → completed` (mit Progress %)

4. **Cleanup**
   - Temporäre Extracted-Dateien nach 24h löschen
   - Fehlerhafte Extrakte nach 7 Tagen archivieren

5. **Cloud-Alternativen**
   - Google/AWS Vision-Calls benötigen Cloud-Approval (analog LLM-Gate)
   - Fallback auf lokales Tesseract, wenn Cloud nicht freigegeben

---

## Datenschutz-Gate: Warum JEDER Provider-Adapter dahinter liegen muss

### Das Problem ohne Gate

```
❌ UNSICHER:
  Lehrkraft → Klassenliste mit Schüler-Namen
             → Direkt in LLM
             → Cloud-Speicherung, keine Kontrolle
```

### Die Lösung: Universales Gate PRE-Call

```
✓ SICHER:
  Lehrkraft → Eingabe
             ↓
        [GATE-Modul]
             ├─ Datenklassifikation
             ├─ Redaction (SuS_001, SuS_002)
             ├─ Provider-Check (lokal OK, Cloud braucht Freigabe)
             ├─ Audit-Log
             └─ Approval-Decision: PASS / BLOCK
             ↓
           PASS → LLM-Call
           BLOCK → Error + Log + Admin-Alert
```

### Gate-Logik ist Provider-agnostisch

Ob Ollama, OpenAI oder Weaviate: **Das Gate kommt VOR dem Adapter-Call**.

```typescript
// Pseudocode
class ProviderAgnosticGate {
  async callWithGate(
    adapterName: string,       // 'ollama', 'openai', 'qdrant', ...
    payload: any,
    adapterFn: () => Promise<any>
  ) {
    // 1. Validiere Payload
    const classified = classifyData(payload)

    // 2. Redact wenn nötig
    const redacted = await redactionPipeline(classified)

    // 3. Approval-Check
    const approved = this.checkApproval(
      schoolId: payload.school_id,
      provider: adapterName,
      dataClasses: classified.classes
    )

    if (!approved) {
      logBlock('DENIED', {adapterName, schoolId, reason: approved.reason})
      throw new GateBlockedError(approved.reason)
    }

    // 4. Call an Adapter
    return adapterFn(redacted)
  }
}
```

Das Gate ist wiederverwendbar für:

- LLM-Provider (lokal oder Cloud)
- Vector-DB Queries
- Object Store Reads
- OCR-Worker Jobs

Alle Adapter implementieren das gleiche **Redaction + Approval-Pattern**.

---

## Zusammenfassung Adapter-Austausch

| Komponente      | Interface                          | Gate-Schutz            | Austausch-Kosten      |
| --------------- | ---------------------------------- | ---------------------- | --------------------- |
| **LLM**         | `LLMProvider::call(prompt)`        | KRITISCH (pre-call)    | Gering (neue API-Key) |
| **ObjectStore** | `ObjectStore::put/get(key)`        | Mittel (Zugriff-Check) | Mittel (API anpassen) |
| **VectorDB**    | `VectorStore::search(query)`       | Mittel (Trust-Filter)  | Gering (REST-API)     |
| **JobQueue**    | `JobQueue::enqueue(type, payload)` | Hoch (Payload-Enc)     | Hoch (Worker-Binding) |
| **OCRWorker**   | `OCRWorker::extract(file)`         | Mittel (Input-Val)     | Mittel (Async-API)    |

**Alle Adapter** sind hinter dem universalen Datenschutz-Gate (`ProviderAgnosticGate`) positioniert.

---

## Verwandte Dokumente

- [../security/DATA_PROTECTION.md](../security/DATA_PROTECTION.md) — Redaction-Implementierung, Approval-Workflow
- [../adr/0002-provider-agnostic-llm-layer.md](../adr/0002-provider-agnostic-llm-layer.md) — Entscheidung für Adapter-Pattern
- [../security/UPLOAD_AND_OCR_SECURITY.md](../security/UPLOAD_AND_OCR_SECURITY.md) — Sicherheitsanforderungen für Upload und OCR.
- [ARCHITECTURE.md](ARCHITECTURE.md) — Komponentenübersicht
- [RAG_ARCHITECTURE.md](RAG_ARCHITECTURE.md) — Trust-Levels, Citation-Standards
