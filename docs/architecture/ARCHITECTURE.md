# Architektur: Unterrichtsassistenz LSA

## Architekturprinzipien

Die LSA folgt vier Leitprinzipien:

**Modularer Monolith mit austauschbaren Grenzen**  
Ein Single-Codebase-Monolith (Next.js + Backend-Domänenmodule), aber strikte, vertragliche Grenzen zu kritischen Services: LLM-Provider, Object Store, Vektor-DB, Job-Queue, OCR-Worker. Jede Grenze hat einen definierten Adapter-Layer für einfachen Austausch (siehe [INTEGRATION_BOUNDARIES.md](INTEGRATION_BOUNDARIES.md)).

**Local-first, Provider-agnostisch**  
Der Betrieb startet lokal (Ollama, MinIO, PostgreSQL) mit vollständiger Datenkontrolle. Cloud-LLM-Provider sind Alternativen hinter einem einzigen Datenschutz-Gate, niemals Pflichtsystem.

**Datenschutz-First durch Guards vor jedem LLM-Call**  
Alle Daten durchlaufen eine Redaction-Pipeline und ein Entscheidungs-Gate (Datenklasse → Erlaubnis), BEVOR sie den LLM-Provider erreichen. Schüler-Klarnamen verlassen das System im Normalbetrieb nicht (siehe [../security/DATA_PROTECTION.md](../security/DATA_PROTECTION.md)).

**Kostenkontrolle & Skalierung ohne Redesign**  
Asynchrone Job-Verarbeitung (Redis + BullMQ), vektorisierte Suche (Qdrant) statt Volltext-Brute-Force, und Provider-Abstraktionen ermöglichen Skalierung von Ein-Schulen-Piloten bis zu Landesverbünden ohne Neuarchitektur.

---

## Komponentenübersicht

```
┌─────────────────────────────────────────────────────────────────┐
│  Web-Frontend (Next.js App Router + TypeScript + Tailwind)      │
│  - Lehrkraft-Dashboard, Klassen, Materialdatenbank              │
│  - React-Komponenten, Form-Validation (Zod/Pydantic)           │
│  - Authentifizierung (OAuth2 SAML, später Schulverbund)         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  API Gateway & Middleware Layer                                  │
│  - Tenant-Isolation (Schule-ID, Lehrkraft-ID)                   │
│  - Datenschutz-Gate: Redaction + Access-Control vor Queries     │
│  - Error Boundary & Audit-Logging                               │
└──────────┬─────────┬─────────┬─────────┬─────────┬──────────────┘
           │         │         │         │         │
    ┌──────▼──────┐ │         │         │         │
    │ PostgreSQL  │ │         │         │         │
    │ + Drizzle   │ │         │         │         │
    │ ORM         │ │         │         │         │
    └─────────────┘ │         │         │         │
                    │         │         │         │
           ┌────────▼────────┐│         │         │
           │  App-Domänen    ││         │         │
           │  Module:        ││         │         │
           │  - Unterrichtsp.││         │         │
           │  - Material-Gen ││         │         │
           │  - Korrektur    ││         │         │
           │  - RAG-Retrieval││         │         │
           └────────┬────────┘│         │         │
                    │         │         │         │
                    │   ┌─────▼────────┐│         │
                    │   │ Qdrant       ││         │
                    │   │ Vektorsuche  ││         │
                    │   └──────────────┘│         │
                    │                   │         │
                    │           ┌───────▼─────────┐
                    │           │ Object Store    │
                    │           │ (S3 / MinIO)    │
                    │           │ - Unterlagen    │
                    │           │ - Extrakte      │
                    │           └─────────────────┘
                    │
           ┌────────▼──────────────────────────────┐
           │ Redis + BullMQ                         │
           │ - Async Job Queue                      │
           │ - OCR/Extraktion, LLM-Calls            │
           │ - Cache (nur für nicht-sensitive Daten)│
           └────────┬──────────────────────────────┘
                    │
           ┌────────▼──────────────────────────────┐
           │ OCR- & Extraktions-Worker             │
           │ (separater Prozess / Container)       │
           │ - Tesseract / PyMuPDF                 │
           │ - Unstrukturierte Inputs → Extrakt   │
           └──────────────────────────────────────┘
```

### Kern-Services

**Web-Frontend (Next.js App Router)**

- Dashboard für Lehrkräfte (Klasse, Fächerzuordnung, Stundplan)
- Materialdatenbank (Filter, Tagging, Upload)
- Formulare (Unterrichtsplan-Generator, Korrektions-Batch)
- Server Components für Datenfluss-Isolation, Client für Interaktivität

**App-Domänenmodule**

- Unterrichtsplanung (Lernziele ↔ Fachstandards, Zeitbudget)
- Materialgenerierung (Templates, LLM-gesteuert, Quellennachweis)
- Korrektur (Batch-Verarbeitung, Bewertungsrubrik, Feedback-Generierung)
- RAG-Retrieval (Query → Kontext-Auswahl → LLM-Prompt mit Quellenangabe)

**PostgreSQL + Drizzle ORM**

- Relationales Kern-Datenmodell (siehe [DATA_MODEL.md](DATA_MODEL.md))
- Lehrkräfte, Klassen, Unterrichtsmaterialien, Schüler-Anonymisierungs-Mappings
- Audit-Log (wer, wann, welche Aktion, IP, Resultat)

**Qdrant (Vektorsuche)**

- Eingebettete Materialien (Lernvideos, Textblöcke, Aufgaben)
- Semantische Suche über Lehrplan-Standards
- Abruf der Top-K relevanten Kontexte für RAG

**Object Store (S3-kompatibel, lokal MinIO)**

- Unterlagen (PDF, DOCX) im Rohmaterial-Zustand
- Generierte Outputs (Arbeitsblätter, Lösungen)
- Versioning & Backup-Integration

**Redis + BullMQ (Job-Queue)**

- Asynchrone Verarbeitung von OCR, LLM-Calls, Datengenerierung
- Dead-Letter-Queue für fehlerhafte Jobs
- Exponential Backoff bei API-Ausfällen

**OCR- & Extraktions-Worker**

- Separater Docker-Container oder lokaler Worker-Prozess
- Input: Bilddateien, Scans, Tabellen
- Output: Strukturierte JSON-Extrakte (Text, Tabellen, Strukturierung)

**LLM-Provider-Abstraction**

- Einziger Einstiegspunkt für alle LLM-Calls
- Provider-Adapter (siehe [INTEGRATION_BOUNDARIES.md](INTEGRATION_BOUNDARIES.md)): Ollama (lokal), OpenAI (Cloud), beliebige OpenAI-kompatible APIs
- **Kritisch**: Datenschutz-Gate PRE-Call, nicht POST-Call

---

## Hauptdatenflüsse

### 1. Unterrichtsplanung

```
Lehrkraft gibt ein:
  - Klasse (7c, Religion, 2 Stunden/Woche)
  - Fachstandard (LISA-Lehrplan, Thema "Biblische Wundererzählungen")
  - Zeitbudget (4 Wochen)
           │
           ▼
  Datenschutz-Gate:
    - Klasse/Fach → INTERNAL (kann an LLM)
    - Schüler-Lernstände? → Falls vorhanden: PERSONAL_TEACHER
      (Redaction: nur Aggregat "Niveau", nicht Klarnamen)
           │
           ▼
  LLM-Prompt:
    "Erstelle einen Stundenplan für 4 Wochen, Klasse 7, Wundererzählungen,
     Schüler im Schnitt Niveau B1. Quellenangaben verpflichtend."
           │
           ▼
  Output: Strukturierter Plan
    - Stundenziele
    - Material-Anforderungen
    - Bewertungskriterien
    - Quellenreferenzen (z.B. LISA-Lehrplan, Fachliteratur)
           │
           ▼
  Speichern in PostgreSQL + Audit-Log
```

### 2. Materialgenerierung

```
Lehrkraft oder Unterrichtsplan → "Generiere Arbeitsblatt zu Stunde 3"
           │
           ▼
  Datenschutz-Gate:
    - Template-ID → OFFICIAL_BINDING (Fachstandards)
    - Schüler-Anzahl, Klassenstufe → INTERNAL
    - Schüler-Namen? → Blockiert / Redaction zu "SuS 1, SuS 2, ..."
           │
           ▼
  RAG-Retrieval:
    - Query: "Wunder AT und NT, Klasse 7, Arbeitsblatt-Level"
    - Qdrant-Suche: Top-5 semantisch ähnliche Materialien
    - Kontext-Auswahl unter Vertrauensstufen (RAG_ARCHITECTURE.md)
           │
           ▼
  LLM-Call:
    Prompt: "Basierend auf folgenden Quellen [with citations]
             erstelle ein Arbeitsblatt für Klasse 7:
             - LISA Lehrplan (OFFICIAL_BINDING)
             - Beispiel-Arbeitsblatt ähnliche Klasse (USER_APPROVED)
             - Wiki-Eintrag (OPEN_CURATED)
             Anforderungen: differenziert, Niveau A1–C2, mit Lösung."
           │
           ▼
  Output: Arbeitsblatt (DOCX/PDF) + Quellennachweis
  Speichern in Object Store + Audit-Log + Datenbank-Metadaten
```

### 3. Korrektur

```
Lehrkraft lädt Schüler-Lösungen hoch (anonymisiert, z.B. "SuS_001.pdf")
           │
           ▼
  OCR-Worker (async Job):
    - Tesseract: Scan → Text
    - Strukturierung: Fragen → Antworten
    - Extrakt: JSON {frage_1: "text", ...}
           │
           ▼
  Datenschutz-Gate (für Batch):
    - Eingabedatei: SENSITIVE_STUDENT (enthält Schüler-Antworten)
    - Redaction: Strippe Name, ID → nur "SuS_001_Antwort"
    - Batch-ID, Rubrik-ID → INTERNAL
           │
           ▼
  LLM-Call (mit Rubrik):
    "Bewerte diese 3 Antworten nach Rubrik [details].
     Input ist anonymisiert, nur Antwort-Text + Frage-Nr.
     Gib Punktzahl, Feedback pro Antwort, keine Schüler-Namen."
           │
           ▼
  Output: Bewertungs-Resultat (JSON)
           - SuS_001: Punkte, Feedback
           - SuS_002: Punkte, Feedback
           - ...
           │
           ▼
  Speichern: PostgreSQL (Ergebnisse), Object Store (Raw-Korrekturen)
```

### 4. RAG-Retrieval (beim Materialgenerierungs-Prompt)

```
Query: "Arbeitsblatt Wundererzählungen Klasse 7"
           │
           ▼
  Qdrant-Anfrage: top_k=10
    - Embedding der Query
    - Ähnlichkeitssuche
    - Rückgabe: Material-IDs + Scores + Vertrauensstufen
           │
           ▼
  Kontext-Ranking (RAG_ARCHITECTURE.md):
    - OFFICIAL_BINDING (LISA) → immer einbinden
    - OFFICIAL_GUIDANCE (Landesbildungsserver) → wenn Score > Threshold
    - OPEN_CURATED (manuell verifizierte externe Quellen) → wenn Score > 0.8
    - USER_APPROVED (Lehrkraft-eigene Materialien) → wenn Lehrkraft das freigibt
    - UNVERIFIED (Community) → nur auf explizite Anfrage
           │
           ▼
  Kontext-Vorbereitung:
    - Quellenangabe mit Link / Referenz
    - Hypernymen (z.B. "LISA Lehrplan Klasse 5–10, Fach Religion")
           │
           ▼
  LLM-Prompt mit Citations:
    "Hier sind relevante Quellen [with links]:
     [Citation 1: LISA Lehrplan ...]
     [Citation 2: Beispiel-Arbeitsblatt ...]
     Generiere basierend darauf..."
           │
           ▼
  Audit: Welche Quellen wurden verwendet, Score-Threshold
```

---

## Datenschutz-Gate vor LLM-Calls

**Regel**: Keine Daten an externen LLM-Provider ohne Redaction + Freigabe.

**Gate-Logik** (vereinfacht):

```python
def can_send_to_llm(data: Dict, destination: LLMProvider) -> bool:
    if destination.is_cloud:
        # Cloud-Provider wie OpenAI
        for field_name, field_value in data.items():
            data_class = classify_field(field_name, field_value)
            if data_class in [SENSITIVE_STUDENT, PERSONAL_TEACHER]:
                # Nur wenn explizit freigegeben und redacted
                if not field_is_redacted(field_value):
                    return False
                if not school_has_cloud_approval(context.school_id):
                    return False
    else:
        # Lokaler Ollama-Provider
        # Weniger strikt, aber Audit-Log noch Pflicht
        pass

    return True
```

Praktisch heißt das:

1. **Datenklassifikation** beim Laden aus PostgreSQL
2. **Redaction-Pipeline** (Klarnamen → Pseudonym, Individualdaten → Aggregat)
3. **Provider-Check** (lokal vs. Cloud)
4. **Approval-Check** (hat die Schule Cloud-LLM freigegeben?)
5. **Logging** (welche Felder, mit welcher Klassifikation, an welchen Provider)
6. **Fail-Closed**: Bei Unsicherheit blocken, nicht propagieren

---

## Mandantentrennung

**Isolation auf drei Ebenen:**

1. **Datenbank-Ebene**
   - `schools` Tabelle, Tenant-ID
   - Alle Queries mit `WHERE school_id = current_school_id`
   - Drizzle-ORM erzwingt via Middleware

2. **API-Ebene**
   - Middleware extrahiert `Authorization` Header → JWT Decode → Lehrkraft-ID + Schule-ID
   - Alle Requests mit Tenant-Kontext
   - API-Response filtert nach Lehrkraft-Zugriff (z.B. nur eigene Klassen)

3. **Audit-Ebene**
   - Jeder Read/Write mit Tenant-ID, Lehrkraft-ID, Timestamp
   - Querys über Tenant-Grenzen sind loggbar & blockierbar

---

## Skalierungs- und Austauschstrategie

### Horizontal

**Early-Stage (eine Schule, < 500 Lehrkräfte)**

- Alles in einem Docker-Compose (Next.js, PostgreSQL, Redis, Qdrant, MinIO)
- Lokal Ollama oder OpenAI-API
- Single-Node PostgreSQL

**Growth (5–20 Schulen, > 2000 Lehrkräfte)**

- App-Tier horizontal (Load Balancer, mehrere Next.js Replicas)
- PostgreSQL Replication (Primary–Replica)
- Redis Cluster
- Qdrant Cluster
- Separater OCR-Worker-Pool (Job-Queue verteilt)

**Scale (100+ Schulen, Landesverbund)**

- Microservice-Migration OPTIONAL (if needed)
  - Unterrichtsplanung als Service
  - Materialgenerierung als Service
  - Korrektur als Service
- Managed PostgreSQL (z.B. AWS RDS)
- Managed Qdrant (Qdrant Cloud)
- S3 statt MinIO
- Kubernetes (wenn Overhead justifiziert)

### Austausch bei kritischen Grenzen

Jede Grenze hat einen dokumentierten Adapter:

| Komponente      | Adapter-Interface                                  | Alternative 1       | Alternative 2    |
| --------------- | -------------------------------------------------- | ------------------- | ---------------- |
| **LLM**         | `LLMProvider { call(prompt, context) → response }` | Ollama (lokal)      | OpenAI (Cloud)   |
| **VectorDB**    | `VectorStore { search(query, top_k) → hits }`      | Qdrant              | Weaviate, Milvus |
| **ObjectStore** | `ObjectStore { put(key, data), get(key) → data }`  | MinIO (lokal)       | AWS S3           |
| **JobQueue**    | `JobQueue { enqueue(type, payload), dequeue() }`   | BullMQ + Redis      | RabbitMQ, Kafka  |
| **OCRWorker**   | `Worker { extract(file) → json }`                  | Tesseract + PyMuPDF | Cloud Vision API |

Alle Adapter implementieren Fehlerbehandlung, Retry-Logik und Logging einheitlich. Austausch erfordert nur neue Adapter-Impl, keine API-Änderungen.

---

## Verwandte Dokumente

- [DATA_MODEL.md](DATA_MODEL.md) — Relationales Schema, Datenklassen
- [RAG_ARCHITECTURE.md](RAG_ARCHITECTURE.md) — Vektor-Embedding, Citation-Standard
- [INTEGRATION_BOUNDARIES.md](INTEGRATION_BOUNDARIES.md) — Adapter-Verträge, Austauschbarkeits-Details
- [../adr/0001-modular-monolith-first.md](../adr/0001-modular-monolith-first.md) — Entscheidung: Monolith statt Microservices
- [../adr/0002-provider-agnostic-llm-layer.md](../adr/0002-provider-agnostic-llm-layer.md) — Lokale Default-Strategie
- [../adr/0005-orm-drizzle.md](../adr/0005-orm-drizzle.md) — TypeScript ORM-Wahl
- [../security/DATA_PROTECTION.md](../security/DATA_PROTECTION.md) — Redaction, Approval, Audit
