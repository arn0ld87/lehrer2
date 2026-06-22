# RAG-Architektur

Das RAG-System (Retrieval-Augmented Generation) der Unterrichtsassistenz ist nach Vertrauensstufen, Quellen-Governance und Konfessions-/Fachkontext strukturiert. Es gewährleistet, dass Lehrkräfte und Schüler nur auf geprüfte, lizenzgeklärte und zitierbare Quellen zugreifen.

## Vertrauensstufen (TrustLevel)

| Stufe                 | Definition                                                                                                 | Beispiel                                                                              | Charakteristika                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **OFFICIAL_BINDING**  | Verbindliche Lehrpläne, Rechtsnormen, staatliche Handreichungen mit Normkraft                              | Kernlehrplan NRW Mathematik; GG Art. 3 (Gleichheitssatz); KMK-Beschluss               | Höchste Priorität, zitierpflichtig, nicht verhandelbar                 |
| **OFFICIAL_GUIDANCE** | Offizielle Materialien von Kultusministerien, Schulbehörden, staatlichen Bildungsinstituten ohne Normkraft | Unterrichtsmaterialien der Bundeszentrale für politische Bildung; IQSH-Handreichungen | Nutzbar, gekennzeichnet als „offizielle Handreichung", einsortierbar   |
| **OPEN_CURATED**      | Geprüfte, offene Bildungsressourcen (OER) mit geklärter Lizenz und Qualitätskuration                       | Khan Academy (CC-BY), Serlo (CC-BY-SA)                                                | Fachlich validiert, lizenzkonform, nachnutzbar unter Lizenzbedingungen |
| **USER_APPROVED**     | Von Schule/Lehrkraft explizit freigegebenes Eigenmaterial (Arbeitsblätter, schulinterne Handreichungen)    | Schulinterner Lehrplan, Fachabsprachen der Mathematik-Fachkonferenz                   | Eigener Geltungsscope, kein automatischer Einsatz in anderen Schulen   |
| **UNVERIFIED**        | Ungepräfte Quellen, keine Governance durchlaufen                                                           | Web-Snippets, Social-Media-Posts, vorläufig eingesteuerte Texte                       | **NIE produktiv**; nur interne Evaluationszwecke                       |

## Quellen-Lebenszyklus (Statusmaschine)

```
DISCOVERED → UNDER_REVIEW → REGISTERED → APPROVED → INGESTED → VERSIONED → EVALUATED → {REVOKED, DELETED}
```

### Übergänge

1. **DISCOVERED**: Metadaten erfasst (URL, Titel, Autor, Publikationsdatum); noch keine Lizenz-, Autoritäts- oder Aktualitätsprüfung.

2. **UNDER_REVIEW**: Automatische oder manuelle Überprüfung eingeleitet.
   - Lizenzklärung (OER-Check, Schulbehörden-Status, Copyright)
   - Autoritätsprüfung (Herausgeber-/Autor-Verifizierung)
   - Aktualitätsprüfung (Gültigkeitsdatum, Lehrplan-Alignment)
   - Erste TrustLevel-Zuordnung

3. **REGISTERED**: Pflichtmetadaten vollständig, TrustLevel zugeordnet, in `SourceDocument` persistiert, noch nicht indexiert.
   - `source_url`, `title`, `author_organization`, `published_date`
   - `trust_level`, `license_info`, `valid_from`, `valid_to`
   - `subject_alignment`, `confession_context`

4. **APPROVED**: Admin/Fachkonferenz erteilt Freigabe (für USER*APPROVED; für OFFICIAL*\* oft automatisch).
   - Signal an Ingestion-Pipeline: Diese Quelle darf in Qdrant aufgenommen werden.

5. **INGESTED**: OCR/Parsing, Chunking, Embedding.
   - Text → RagChunk-Records mit Vollständigkeit-Prüfung (siehe Pflichtfelder).
   - UNVERIFIED-Chunks werden **nicht** nach Qdrant geschrieben (Ingestion-Gate).
   - Embedding via lokales Modell (Ollama-Default).
   - Vektoren → Qdrant-Collection mit Metadaten.

6. **VERSIONED**: Nachträgliche Neuaufbereitung (z.B. verbesserte OCR, neue Chunk-Granularität) erzeugt neue Chunks mit `source_version` inkrementiert.
   - Alte Chunks bleiben referenzierbar für Zitat-Stabilität.
   - Nur neueste Version wird aktiv gerankt; Fallback auf ältere Versionen für bereits zitierte Stellen.

7. **EVALUATED**: Qualitätsmetriken (Embedding-Kohärenz, Abruf-Häufigkeit, User-Feedback, Drift-Detection) dokumentiert.
   - Indiz für mögliche Revocation (z.B. Lehrplan-Update macht Quelle obsolet).

8. **REVOKED / DELETED**:
   - **REVOKED**: Quelle wird als nicht mehr produktiv markiert. Chunks in Qdrant verlieren Sichtbarkeit (Metadaten-Filter), in PG als `revoked_at` gekennzeichnet.
   - **DELETED** (kaskadierend): Chunks aus Qdrant, Qdrant-Points gelöscht, `RagChunk`-Records in PG als `deleted_at` markiert, Object Store (MinIO) säubert alte Binärdateien, Referenzen in `TeacherCitation` → referenzielle Integrität prüfen (orphaned citations markieren oder archivieren).

## RagChunk — Pflichtfelder

Jeder Chunk, der nach Qdrant ingested wird, muss diese Felder vollständig erfüllen:

| Feld                 | Typ                    | Beschreibung                                                                                    | Constraint                            |
| -------------------- | ---------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------- |
| `source_document_id` | UUID                   | Verweis auf `SourceDocument`                                                                    | NOT NULL, FK                          |
| `chunk_text`         | TEXT                   | Tatsächlicher Textinhalt (nach OCR/Parsing)                                                     | NOT NULL, min. 50 Zeichen             |
| `embedding_ref`      | UUID (Qdrant Point-ID) | Vektorp-ID in Qdrant                                                                            | NOT NULL nach erfolgreicher Ingestion |
| `page_or_section`    | VARCHAR                | Wo in der Quelle: Seitennummer, Kapitelüberschrift, etc.                                        | NOT NULL                              |
| `source_version`     | INT                    | Version der Quelle (z.B. Neufassung nach OCR-Verbesserung)                                      | NOT NULL, default 1                   |
| `license`            | VARCHAR (enum)         | Lizenzstatus: CC-BY, CC-BY-SA, School-Internal, Proprietary, Public-Domain                      | NOT NULL                              |
| `retrieved_at`       | TIMESTAMP              | Zeitpunkt der Ingestion                                                                         | NOT NULL                              |
| `content_hash`       | VARCHAR(64)            | SHA256(chunk_text) zur Duplikatserkennung                                                       | NOT NULL, unique per source_version   |
| `trust_level`        | ENUM                   | OFFICIAL_BINDING, OFFICIAL_GUIDANCE, OPEN_CURATED, USER_APPROVED, UNVERIFIED                    | NOT NULL                              |
| `subject`            | VARCHAR                | Schulisches Fach: Mathematik, Deutsch, Biologie, ...                                            | NOT NULL                              |
| `confession_context` | ENUM                   | Konfessions-/Ethik-Zuordnung: evangelical, catholic, multiconfessional, ethics_secular, neutral | NOT NULL                              |
| `valid_from`         | DATE                   | Gültigkeitsbeginn (Lehrplan-Fasung, Rechtsnorm ab-Datum)                                        | nullable                              |
| `valid_to`           | DATE                   | Gültigkeitsende (Außerkraftsetzung, Übergangsregelung)                                          | nullable                              |

**Invariante**: Ein Chunk ohne vollständige Erfüllung dieser Felder wird vom Ingestion-Gate **abgewiesen** und landet in einer Fehler-Queue für manuelle Nachbearbeitung.

## Garantien

### 1. UNVERIFIED nie produktiv — Doppelte Absicherung

**Schicht A (Ingestion-Gate)**: Chunks mit `trust_level = UNVERIFIED` werden **nicht** nach Qdrant geschrieben. Sie landen in einer Staging/Evaluation-Datenbank für interne Audits.

**Schicht B (Retrieval-Filter)**: Jede Retrieval-Query wird mit serverseitigem `trust_level`-Filter ausgeführt:

```
WHERE trust_level IN (OFFICIAL_BINDING, OFFICIAL_GUIDANCE, OPEN_CURATED, USER_APPROVED)
```

Diese Trennung garantiert, dass auch bei fehlerhafter Konfiguration (z.B. irrtümlich UNVERIFIED markiert) keine ungeprüften Quelle in ein Teacher-Workflow oder Schüler-Interface gelangen.

### 2. Beleg-Pflicht / Confidence-Markierung

Jede generierte Aussage wird klassifiziert:

- **GROUNDED**: ≥ 1 SourceReference mit sichtbarem Zitat (via [CITATION_STANDARD](../rag/CITATION_STANDARD.md)).
  - Zitat muss direkt aus Chunk stammen oder verifizierbar zusammengefasst sein.
  - Nur GROUNDED-Aussagen sind unterrichtsfähig.

- **UNSUPPORTED_DRAFT**: Kein SourceReference oder indirekter Beleg (z.B. Hintergrundwissen des Modells).
  - **Keine Freigabe für Lehrplan-Aussagen** ohne OFFICIAL_BINDING oder OFFICIAL_GUIDANCE-Beleg.
  - Im UI: Deutlich als „Entwurf ohne Quellennachweis" gekennzeichnet, nicht freigabefähig, rot/gelb hervorgehoben.
  - Nur für Brainstorming/Lehrkraft-Notizen (off-record) zulässig.

### 3. Konfessions- und Fachkontext als Pflichtfilter

Jede Retrieval-Query berücksichtigt zwingend:

- **Konfessions-Scope** des Schülers/Kurses (evangelisch, katholisch, multiconfessional, ethics_secular).
  - Religion wird **strikt getrennt**: Evangelische, katholische und konfessionsübergreifende Inhalte dürfen nicht vermischt werden.
  - Nur Quellen mit passendem `confession_context` werden gerankt (oder neutral-markierte Quellen).

- **Schulfach** (Mathematik, Deutsch, …).
  - Chunks außerhalb des aktuellen Fachs werden deprioritär.

Diese Filter sind **nicht optional**; sie werden von der Applikation erzwungen.

## Retrieval- und Embedding-Pipeline (konzeptionell)

```
┌─────────────────────────────────────────────────────────────┐
│ User Query (z.B. "Erklär mir Prozentrechnung")              │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Query Normalization & Intent Extraction                  │
│    - Fach aus Kontext (z.B. Mathematik)                     │
│    - Konfession aus Schüler-Profil                          │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Embedding (lokal via Ollama)                             │
│    - Query-Vector generieren                                │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Qdrant Vector Search                                     │
│    - Similarity-basierte Kandidaten                         │
│    - Metadaten-Filter anwenden:                             │
│      * trust_level ∉ UNVERIFIED                             │
│      * confession_context MATCHES user-scope                │
│      * subject MATCHES current-fach                         │
│      * valid_from <= today <= valid_to (falls gesetzt)     │
│      * revoked_at IS NULL                                   │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Reranking (optional)                                     │
│    - Lokalität, Chunk-Länge, Aktualität berücksichtigen    │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Citation Assembly                                        │
│    - Top-K Chunks → SourceReferences formatieren            │
│    - Zitate gemäß CITATION_STANDARD strukturieren           │
│    - Konfidenz-Scoring (GROUNDED vs. UNSUPPORTED_DRAFT)     │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. LLM-Prompt mit Retrieval Context                         │
│    - Chunk-Inhalte + Metadaten in Context                   │
│    - Anweisung: GROUNDED-Output erzeugen oder DRAFT         │
│    - fallback: "Ich habe keine verlässliche Quelle dazu"    │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Output Validation & Redaction (Schüler-Scope)            │
│    - Personendaten-Check (PERSONAL_TEACHER → redact)        │
│    - Konfessions-Fairness-Check                             │
│    - Sensitivity-Markierungen (SENSITIVE_STUDENT → warn)    │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ Lehrkraft/Schüler-Interface                                 │
│ - Zitate angezeigt, Source-Links klickbar                   │
│ - UNSUPPORTED_DRAFT deutlich markiert, nicht freigabbar     │
└─────────────────────────────────────────────────────────────┘
```

## Verweise

- [Datensicherheitsmodell](./DATA_MODEL.md) — RagChunk-Schema, SourceDocument, TeacherCitation
- [Ingestion Policy](../rag/INGESTION_POLICY.md) — Ablauf und Fehlerbehandlung beim Chunking/Embedding
- [Citation Standard](../rag/CITATION_STANDARD.md) — Zitierformat, Transparenzanforderungen
- [Source Registry](../rag/SOURCE_REGISTRY.md) — Verwaltung registrierter Quellen
- [ADR-0003: Source Governance Before Ingestion](../adr/0003-source-governance-before-ingestion.md) — Kontextualisierung dieser Architektur-Entscheidung
- [ADR-0010: RAG-Ingestierung via Qdrant](../adr/0010-rag-ingestion-qdrant.md) — Vektorraum-Strategie (EINE Collection + Payload-Filter, local-first Embedding, Schritt-1-Textextraktion)
