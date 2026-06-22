# Ingestion-Policy: Governance vor Ingestierung

## Grundsatz

Die RAG-Pipeline des LSA folgt dem Prinzip **Governance vor Ingestierung**: Kein Dokument wird in den Vektorspeicher aufgenommen, ohne vorher die Freigabe-Schritte durchlaufen zu haben. Dies sichert Rechtskonformität (Datenschutz, Urheberrecht, Unterrichtslegalität) und Qualitätsstandards für sächsisch-anhaltische Lehrkräfte.

Die Basis ist der Dokumentenlebenszyklus:

```
DISCOVERED → UNDER_REVIEW → REGISTERED → APPROVED → INGESTED → VERSIONED → EVALUATED → REVOKED/DELETED
```

Nur Dokumente im Status **APPROVED** und mit `license_verified=true` dürfen ingestiert werden.

---

## Freigabe-Gate vor Ingestierung

### Voraussetzungen (Überprüfung durch Maintainer)

Bevor ein Dokument aus dem Status `REGISTERED` in `APPROVED` überführt wird, müssen folgende Prüfungen abgeschlossen sein:

1. **Lizenz und Nutzungsbedingungen**
   - Lizenztyp (z. B. CC-BY-SA, amtlich, urheberrechtsfrei) nachweisen
   - Zuordnung zu Trust-Level gemäß [./SOURCE_REGISTRY.md](./SOURCE_REGISTRY.md)
     - `OFFICIAL_BINDING`: Lehrplan, amtliche Curricula Sachsen-Anhalt
     - `OFFICIAL_GUIDANCE`: Ministerium-Handreichungen, Richtlinien
     - `OPEN_CURATED`: frei lizenzierte Inhalte, redaktionell überprüft
     - `USER_APPROVED`: von Lehrkräften eingereichte, noch nicht validiert
     - `UNVERIFIED`: wird NICHT ingestiert (siehe Filterung unten)
   - Feld `license_verified` muss `true` sein; Nachweise in Metadaten archiviert

2. **Aktualität und Geltung**
   - Gültigkeitszeitraum (`valid_from`, `valid_to`) gesetzt
   - Versionsnummer konsistent mit bisherigen Ausgaben
   - Superseded Versionen: als `REVOKED` markieren, nicht löschen

3. **Inhaltsüberprüfung**
   - Sachliche Korrektheit (Lehrplan-Konformität, Fachkorrektheit)
   - **Religion**: Konfessionszuordnung korrekt
     - Evangelisch / Katholisch / Übergreifend / Ethik getrennt dokumentieren
     - Sensible Aussagen: Review durch Fachberatern für Konfessionsbegleitung
   - Keine diskriminierenden oder schuld- oder haftbaren Aussagen

4. **Quellenangabe**
   - Originale Quelle identifiziert und dokumentiert
   - Seite/Abschnitt für Chunks vorbereitet (wird bei Chunking gespeichert)
   - Abrufdatum (`retrieved_at`) gespeichert

**Ablage**: Alle Überprüfungsergebnisse werden in den Metadaten des Dokuments erfasst (Feld: `approval_metadata`). Das Freigabe-Gate wird von einem Maintainer (nicht vom System) durchlaufen und müssen schriftlich dokumentiert werden (z. B. als GitHub Issue mit Label `governance:approved`).

---

## Ingestion-Schritte

### 1. Download und Validierung

- **Quelle**: Dokument wird heruntergeladen (PDF, Webpage, Officedokument, etc.)
- **Content-Hash**: SHA-256-Fingerprint des Rohdokuments berechnet und gespeichert (`content_hash`)
- **Größe und Format**: Größe, Dateiformat, Zeichenkodierung validieren
- **Fehlerbehandlung**: Unerreichbare oder beschädigte Quellen → Fehler-Issue für Maintainer, nicht automatisch ignorieren

### 2. Metadaten-Erfassung

Für jedes Dokument werden vor der Extraktion folgende Felder erfasst:

| Feld | Typ | Pflicht | Notizen |
|---|---|---|---|
| `source_id` | UUID | ja | eindeutig pro Originalquelle |
| `source_url` | URL | ja | Persistente URL oder Archiv-URL |
| `title` | string | ja | Dokumententitel |
| `subject` | string | ja | Fachbereich: Deutsch, Religion, Übergreifend |
| `confession_context` | enum | nein | evangelisch / katholisch / übergreifend / ethik (nur bei Religion) |
| `version` | string | ja | z. B. "2024-01", "Lehrplan 2021, rev. 3" |
| `license` | string | ja | Lizenztyp, z. B. "CC-BY-SA-4.0", "Amtlich" |
| `license_verified` | bool | ja | `true` nur nach Freigabe-Gate |
| `trust_level` | enum | ja | OFFICIAL_BINDING / OFFICIAL_GUIDANCE / OPEN_CURATED / USER_APPROVED / UNVERIFIED |
| `valid_from` | date | ja | Gültig ab (z. B. Schuljahr 2024/2025) |
| `valid_to` | date | nein | Gültig bis; leer = unbegrenzt |
| `retrieved_at` | timestamp | ja | Abrufdatum des Dokuments |
| `content_hash` | string | ja | SHA-256 des Rohdokuments |
| `approval_metadata` | object | ja | Details des Freigabe-Gates (Reviewer, Datum, Anmerkungen) |

### 3. Extraktion und OCR

- **Format-Spezifisch**:
  - PDF: Text-Extraktion (ggfs. OCR bei gescannten Dokumenten)
  - Webseite: HTML-Parsing und Text-Extraktion
  - Office (DOCX, XLSX): strukturierter Text mit Erhalt der Überschriften-Hierarchie
- **OCR-Fehler**:
  - Fehlerquoten > 5 % oder erkannte Kodierungsfehler → Fehler-Issue für Maintainer
  - Nicht automatisch kürzen oder raten

### 4. Chunking und Segmentierung

- **Strategie**: Überschrift-basiertes Chunking mit Rollover-Kontext
  - Chunk maximal 1000 Token (im Kontext des LLM-Providers)
  - Jeder Chunk erhält:
    - `chunk_id` (eindeutig pro Dokument)
    - `page` oder `section` (Bezug zur Originalquelle)
    - `parent_document_id` (Rücklink)
    - `heading_hierarchy` (Kontext: "Deutsch > Hauptschule > Schreiben")
- **Religion**: Konfessionszuordnung wird auf Chunk-Ebene vererbt
- **Markierungen**: Ungestützte oder entworfene Aussagen als `marked_as_draft` = `true` taggen, **nicht** als Lehrplanallegation servieren

### 5. Embedding und Ingestierung in Qdrant

- **Embedding-Modell**: Standard lokal Ollama (z. B. `qwen3-embedding:4b`), kein Hard-Dependency auf Cloud-APIs
- **Vektorraum**: Pro Fach/Konfession ggfs. separate Collections (Deutsch, Religion-Ev, Religion-Kath, etc.) — noch zu implementieren
- **Batch-Ingestierung**:
  - Chunks in Batches von 100–500 parallel eingebettet
  - Fehler in einer Batch-Operation → Transaction rollback, Issue für Maintainer
- **Metadaten-Speicherung**: Payload in Qdrant beinhaltet Quellen-Metadaten (source_id, page, retrieved_at, license, trust_level)

---

## Harte Filter gegen UNVERIFIED-Daten

Das System implementiert **zwei Filterschichten**, um zu verhindern, dass ungeprüfte Daten in die Antworten gelangen:

### Layer 1: Ingestierungs-Gate
- Nur Status `APPROVED` und `license_verified=true` dürfen ingestiert werden
- `UNVERIFIED`-Dokumente werden explizit blockiert (Code: Prüfung im Ingestierungs-Job)
- Kein Fallback auf "später überprüfen" — entweder Freigabe jetzt, oder nicht ingestieren

### Layer 2: Query-Filter (serverseitig)
- Bei jeder Suche in Qdrant wird der Metadaten-Filter auf `trust_level != UNVERIFIED` gesetzt
- Falls trotz Layer 1 ein UNVERIFIED-Chunk in der Collection landet (z. B. durch manuelle DB-Bearbeitung): wird von der Query ausgeschlossen
- **Logging**: Jeder gefilterte Zugriff wird protokolliert (für Audit)

### Auswirkung auf Benutzer-Eingaben (USER_APPROVED)
- USER_APPROVED-Dokumente (z. B. von einer Lehrkraft hochgeladene Materialien) dürfen ingestiert werden, müssen aber deutlich gekennzeichnet sein
  - Im Response: `"source": "user-approved, Lehrkraft XYZ, 2026-01-15"`
  - UI-Warnung: "Dieses Material wurde von der Schulgemeinschaft eingereicht und von Fachleuten noch nicht überprüft"
  - Optional: Schalter für Lehrkräfte, solche Quellen ein-/auszublenden

---

## Versionierung neuer Dokumentfassungen

Wenn eine aktualisierte Version eines existierenden Dokuments erscheint (z. B. neuer Lehrplan, revidierte Handreichung):

1. **Alte Version**:
   - Status auf `REVOKED` setzen
   - `valid_to` auf Datum der Supersession setzen
   - **Nicht löschen** — für Audit- und Rückverfolgung archivieren

2. **Neue Version**:
   - Neuer Dokumenten-Record mit erhöhter `version` (z. B. "2024-01" → "2024-02" oder "Lehrplan 2024, rev. 2")
   - Neuer `content_hash` (weil Inhalt sich geändert hat)
   - Neue Chunks, neue Embeddings
   - Wieder durch Freigabe-Gate

3. **Query-Logik**:
   - Qdrant-Suche bevorzugt `valid_to` = NULL oder `valid_to` > heute
   - Bei gleicher Relevanz: neuere Version zuerst
   - Optional: Historische Versionen als separate Collection für Recherche-Zwecke

---

## Fehlerbehandlung und Maintainer-Eskalation

| Fehler | Behandlung |
|---|---|
| **Fehlende Lizenz-Info** | Ingestierung stoppen, GitHub-Issue `triage:licensing` öffnen |
| **OCR-Fehler > 5%** | Ingestierung stoppen, Issue `triage:ocr` öffnen, Manual Review anfordern |
| **Konflikt: zwei aktive Versionen** | Beide sperren, Issue `triage:versioning` öffnen, Maintainer entscheidet |
| **Unerreichbare Quelle** | Issue `triage:source-unavailable` öffnen, nicht automatisch entfernen |
| **Ungültige Konfessions-Zuordnung** | Ingestierung stoppen, Issue `triage:confessional-context` öffnen |
| **Großfehler in Chunk-Extraktion** | Transaction rollback, Chunk-Preview für Maintainer zur Validierung |

**Prinzip**: Im Zweifelsfall stoppen und eskalieren. Keine automatischen Umgehungen, keine Annahmen. Die Fachkompetenz (Lehrplan, Konfessionssensibilität) ist zu kostbar für Heuristiken.

---

## Bezug: Widerruf und Löschung

Für die Behandlung von Dokumenten-Widerruf (z. B. bei neuer Rechtslage, fehlerhaften Inhalten oder Lizenz-Problemen) siehe [../security/RETENTION_AND_DELETION.md](../security/RETENTION_AND_DELETION.md). Wichtig:

- **Revoked**: Status-Änderung zu `REVOKED`, bleibt in DB (historisch abrufbar)
- **Deleted**: Nur bei Rechtspflicht (DSGVO, Vorwurf von IP-Verletzung) — anonymisierte Archive mit `anonymized_at`-Zeitstempel

---

## Referenzen und weiterführende Dokumentation

- [./SOURCE_REGISTRY.md](./SOURCE_REGISTRY.md) — Trust-Level-Definitionen und Quellen-Masterdaten
- [./CITATION_STANDARD.md](./CITATION_STANDARD.md) — Zitation von Chunks im Response
- [../architecture/RAG_ARCHITECTURE.md](../architecture/RAG_ARCHITECTURE.md) — technische Architektur (Qdrant, Ollama, etc.)
- [../adr/0003-source-governance-before-ingestion.md](../adr/0003-source-governance-before-ingestion.md) — Architektur-Entscheidung und Begründung
