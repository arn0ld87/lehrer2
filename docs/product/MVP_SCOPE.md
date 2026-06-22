# MVP Scope

## In Scope (Geplant für Phase 1)

### Kernfunktionalität

- **Lehrplangebundene Unterrichtsplanung**
  - Abfragemasken für Klassenstufe, Fach (Deutsch, Religion), Lehrplanbereich
  - RAG-gestützte Materialabfrage aus OFFICIAL_BINDING Quellen (sächsisch-anhaltinische Lehrpläne, Schulbuch-Metadaten)
  - Generierung von Stundenentwürfen mit Lernzielen, Methoden, Zeitbudget
  - Quellenketten transparent (Lehrplan § X → Schulbuch Kap. Y → Arbeitsblatt Z)

- **Aufgaben- und Arbeitsblatt-Generierung**
  - Differenzierte Aufgabensätze (Basis, Erweiterung, Förder)
  - Export in DOCX/PDF
  - Konfessions-Scope für Religion (z.B. evangelisch, katholisch, übergreifend, Ethik)
  - Quellenangabe im Export

- **Korrekturassistenz (Deutsch + Religion)**
  - Pseudonymisierung von Schülernamen vor KI-Verarbeitung
  - Feedback-Generierung mit Kriterium + Beleg + Unsicherheitsmetriken
  - Vorschlagscharakter explizit (»Mögliche Verbesserung«, »Bedenken gegenüber«)
  - Lehrkraft editiert, finalisiert, entscheidet

- **Schulbasierte RAG-Quelle**
  - Lokale Vektorisierung (Ollama `qwen3-embedding:4b` oder äquivalent)
  - Indexierung von Schullehrplänen, Schulbüchern, genehmigten Arbeitsblattsammlungen (PDF)
  - Trust-Levels: OFFICIAL_BINDING, OFFICIAL_GUIDANCE, OPEN_CURATED, USER_APPROVED
  - Query-Redaction: Redaction erfolgt VOR RAG-Abfrage

- **Administration (Schuladmin)**
  - User-Rollen: Lehrkraft, Schuladmin
  - Freigabeflow für externe LLM-Nutzung (CloudReleaseGrant)
  - Audit-Log (Abfragen, Quellenreferenzen, keine Schülertextinhalte)
  - API-Token-Management (optional; für systemische Integration)

### Technische Annahmen

- **LLM**: Lokal Ollama (default), optional Claude API mit Freigabe
- **Datenspeicher**: PostgreSQL (Metadaten, Audit), MinIO (PDF-Upload), Qdrant (Embeddings)
- **Stack**: Next.js App Router, TypeScript, Tailwind; BullMQ für Batch-Jobs
- **Auth**: Schulserver-SSO (LDAP-Integration sekundär; MVP: lokale Benutzer + einfacher API-Token)
- **Infrastruktur**: Docker Compose; Schulserver-Host oder lokale Workstation

## Out of Scope / Nicht-Ziele

- **Keine Endnotenvergabe durch System**
  - Bewertungsassistenz ja (Feedback, Kriterien), Noteneingabe nein
  - Grading-Automatisierung nicht implementiert

- **Keine Entscheidung ohne Mensch**
  - Kein automatisiertes Ranking von Arbeitsblättern
  - Kein Auto-Korrektur-Mode (»hier ist die richtige Antwort«)
  - Vorschläge müssen immer vom Menschen validiert werden

- **Keine Weitergabe von Schülerdaten**
  - Schülernamen, Lernergebnisse, Klassenzusammensetzung: pseudonymisiert vor Cloud-LLM
  - Nur Lehrkraft kann explizit (mit Audit-Trail) Cloud-Nutzung aktivieren

- **Keine öffentliche Schülerplattform**
  - Schüler loggen sich nicht selbst ein
  - Schüler erhalten Material über klassische Kanäle (Schulplattform, Papier, LMS)
  - Lehrkraft verwaltet Freigaben manuell

- **Kein Scraping geschützter Materialien**
  - Nur mit Schulbuch-Lizenz und schulinterner Genehmigung
  - RAG-Indexierung beschränkt auf legale Quellenbestände

- **Keine Multi-Schule-Kollaboration (MVP)**
  - Isolierte Schulinstanzen
  - Später: föderiertes Sharing zwischen Schulen

- **Keine Echtzeitkollaboration**
  - Entwürfe sind Single-User
  - Freigabe erfolgt manuell (Export + Mail/Schulplattform)

## MVP-Annahmen

1. **Kleine Datenmenge**: Eine Schule mit ≤100 Lehrkräften, Textmaterial ≤500 MB Äquivalent (PDFs, Lehrplan-HTML)
2. **Inferenz-Latenz**: Ollama-Durchsatz akzeptabel (3–10 sec/Request); Cloud-API nur wenn Schulfreigabe
3. **Redaction-Zuverlässigkeit**: Pattern-basierte Maskenierung (Schülernamen-Liste) ausreichend für Pilotphase
4. **Benutzer-Training**: Lehrkräfte haben Schulung zu Datenschutz + Werkzeug-Nutzung erhalten
5. **Lehrplan-Verfügbarkeit**: Sächsisch-anhaltinische Lehrpläne sind maschinenlesbar oder manuell erfasst
6. **Konfessions-Kategorisierung**: Material ist bereits oder wird bei Upload kategorisiert

## Priorisierung der Funktionsbereiche

| Bereich                                    | Priority   | Begründung                                                                                   |
| ------------------------------------------ | ---------- | -------------------------------------------------------------------------------------------- |
| **Korrekturassistenz + Pseudonymisierung** | 1 (Must)   | Höchster Datenschutz-Risiko; ohne Redaction kein Schulstart                                  |
| **Aufgabengenerierung**                    | 1 (Must)   | Kernnutzen; zeigt ROI schnell                                                                |
| **RAG + Lehrplan-Quellen**                 | 1 (Must)   | Differenziert LSA von ChatGPT; Quellenpflicht non-negotiable                                 |
| **Admin + Freigabeflow**                   | 2 (Should) | Notwendig für Schulfreigabe; MVP könnte mit Schulleiter-Freigabe per Formular starten        |
| **Konfessions-Scope**                      | 2 (Should) | Religion-Lehrkräfte brauchen es; gut abgrenzbar; Deutsch könnte ohne erste Iteration starten |
| **Batch-Korrektur**                        | 3 (Nice)   | Stapelverarbeitung; nice-to-have für MVP                                                     |
| **API für LMS-Integration**                | 3 (Nice)   | Später; MVP fokussiert auf Web-UI                                                            |

## Nächste Schritte

- Siehe [ACCEPTANCE_CRITERIA.md](./ACCEPTANCE_CRITERIA.md) für Überprüfbarkeit
- Architektur in [../architecture/DATA_MODEL.md](../architecture/DATA_MODEL.md)
- Sicherheit in [../security/DATA_PROTECTION.md](../security/DATA_PROTECTION.md)
- Allgemeiner Plan [../../PLAN.md](../../PLAN.md)
