# Sicherheitsanforderungen für Dokument-Upload und OCR

Dieses Dokument spezifiziert die Sicherheitsanforderungen für den Upload von Dokumenten und deren Verarbeitung mittels OCR (Optical Character Recognition) im Rahmen der Unterrichtsassistenz LSA.

## 1. Upload-Beschränkungen

Um die Systemstabilität zu gewährleisten und Missbrauch zu verhindern, gelten folgende Einschränkungen für Dateiuploads:

### 1.1 Dateityp-Whitelisting

Es werden ausschließlich folgende Dateiformate akzeptiert:

- `.pdf` (Dokumente)
- `.docx` (Microsoft Word)
- `.txt` (Textdateien)
- `.jpg`, `.jpeg`, `.png` (Bildformate für OCR-Scans)

Dateien mit ausführbaren Inhalten (z. B. `.exe`, `.js` in PDFs) werden serverseitig abgelehnt.

### 1.2 Größenbeschränkungen

- Maximale Dateigröße: **50 MB** pro Upload.
- Größere Dateien führen zu einem sofortigen Abbruch der Übertragung.

### 1.3 Rate Limiting und Kontingente

- Maximal **10 Uploads pro Minute** pro Lehrkraft.
- Maximales Tageskontingent pro Lehrkraft (z. B. 1 GB) zur Vermeidung von Storage-Erschöpfung.
- Umsetzung erfolgt via Redis-basiertem Rate-Limiting und BullMQ Backpressure.

### 1.4 Malware-Scanning

- Alle hochgeladenen Dateien werden **vor** der weiteren Verarbeitung durch einen Virenscanner (z. B. ClamAV) geprüft.
- **Fail-closed**: Bei Fund oder Scan-Fehler wird die Datei sofort gelöscht, die Verarbeitung abgebrochen und der Vorfall auditiert. Die Lehrkraft erhält eine generische Fehlermeldung.

---

## 2. OCR-Sicherheit

Der OCR-Prozess verarbeitet potenziell sensitive Schülerdaten und muss daher besonders geschützt werden.

### 2.1 Isolation (Sandboxing)

- Der OCR-Worker läuft in einem isolierten Container mit minimalen Berechtigungen.
- Kein direkter Zugriff auf das Internet oder das interne Schulnetzwerk (ausgenommen die notwendigen Verbindungen zum Object Store und der Job-Queue).

### 2.2 Ressourcen-Limits

- Der OCR-Prozess ist durch CPU- und Memory-Limits begrenzt, um DoS-Angriffe durch speziell präparierte "Decompression Bombs" oder hochkomplexe PDFs zu verhindern.
- Zeitüberschreitungen (Timeouts) führen zum Abbruch des Jobs.

### 2.3 Output-Sanitierung

- Der extrahierte Text wird bereinigt:
  - Entfernung von potenziell gefährlichen Zeichenfolgen (z. B. LaTeX-Injections, HTML-Tags).
  - Normalisierung der Zeichenkodierung (UTF-8).

---

## 3. Pseudonymisierung und Datenschutz-Workflow

Schülerarbeiten enthalten hochsensible Daten (`SENSITIVE_STUDENT`). Der Schutz dieser Daten hat oberste Priorität.

### 3.1 Pseudonymisierung vor Speicherung

Der Workflow für den Ingest von Schülerarbeiten ist wie folgt definiert:

1. **Upload**: Datei wird im temporären, verschlüsselten Object Store abgelegt (**AES-256-Verschlüsselung at-rest**).
2. **OCR/Extraktion**: Text wird im isolierten Worker extrahiert.
3. **Redaction (lokal)**: Der extrahierte Text durchläuft den `RedactionService`, BEVOR er dauerhaft gespeichert oder an LLMs gesendet wird.
   - Schülernamen werden durch stabile Pseudonyme (`student_id` -> `pseudonym_id`) ersetzt.
   - Weitere PII (Adressen, Geburtsdaten) werden entfernt.
4. **Speicherung**: **NUR der pseudonymisierte/redigierte Text** wird in der Datenbank (PostgreSQL) und dem Vektorspeicher (Qdrant) abgelegt.
   - **Invariante**: Unredigierte OCR-Rohdaten werden niemals dauerhaft in der Datenbank oder im Vektor-Index gespeichert.
5. **Löschung des Originals**: Das Originaldokument wird nach erfolgreicher Verarbeitung gemäß Löschkonzept gelöscht, sofern kein expliziter Grund für eine Aufbewahrung (z.B. Korrektur-Ansicht durch Lehrkraft im UI) besteht.

### 3.2 Schutz des Mappings

Das Mapping zwischen `student_id` und `pseudonym_id` verbleibt ausschließlich im lokalen Schulnetzwerk in einer verschlüsselten PostgreSQL-Tabelle.

---

## 4. Querverweise

- **[DATA_PROTECTION.md](./DATA_PROTECTION.md)**: Grundsätze der Pseudonymisierung und Datenklassen.
- **[RETENTION_AND_DELETION.md](./RETENTION_AND_DELETION.md)**: Fristen für die Löschung von Uploads und OCR-Ergebnissen.
- **[SECURITY.md](./SECURITY.md)**: Allgemeiner Sicherheitsrahmen und Defense-in-Depth.
- **[THREAT_MODEL.md](./THREAT_MODEL.md)**: Bedrohungsanalyse für Uploads und RAG-Ingestion.
- **[INGESTION_POLICY.md](../rag/INGESTION_POLICY.md)**: Governance-Prozess für die Aufnahme von Dokumenten in die RAG-Pipeline.

---

**Status**: Entwurf
**Version**: 0.2
**Zuständig**: Backend / Security Team
