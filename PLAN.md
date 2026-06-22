# PLAN — Unterrichtsassistenz LSA

> **Status: Fundament / Planung.** Dieses Repository enthält **keine** lauffähige Anwendung, **keinen** Produktivcode und **keine** überprüfte RAG-, Datenschutz- oder Lehrplankonformität. Es legt Struktur, Architekturentscheidungen, Governance und Planung fest. Jede Konformität wird erst behauptet, wenn sie überprüft umgesetzt ist.

Repository: `arn0ld87/lehrer2` (privat). Einstieg/Übersicht: [README.md](README.md).

---

## 1. Problem, Zielgruppen, Produktversprechen

**Problem.** Lehrkräfte verbringen viel Zeit mit lehrplankonformer Unterrichtsplanung, Materialerstellung und Korrektur. Bestehende KI-Werkzeuge sind selten an konkrete Landeslehrpläne gebunden, belegen ihre Aussagen nicht und sind aus Datenschutzsicht für Schülerdaten ungeeignet.

**Zielgruppen.**

- Lehrkräfte an Gesamt-/Gemeinschaftsschulen in Sachsen-Anhalt, Klassenstufen 5–12.
- Zunächst Fächer **Deutsch** und **Religion** (evangelisch, katholisch, konfessionssensibel/übergreifend) — Ethik getrennt modelliert.
- Später: Fachkonferenz-/Schuladmin-Rollen.

**Produktversprechen.** Ein kostensensibler, selbst hostbarer Assistent, der Unterrichtsplanung, Materialerstellung und Korrektur unterstützt — **lehrplan- und quellengebunden**, mit **vollständigen Quellennachweisen**, **datenschutzkonform** (lokal zuerst, Pseudonymisierung als Standard) und **immer unter menschlicher Letztentscheidung**.

## 2. In-Scope / Out-of-Scope (MVP)

**In-Scope (geplant, noch nicht umgesetzt):**

- Curriculummodell (Schulform, Bildungsgang, Fach, Konfession, Klasse, Gültigkeit) — siehe [DATA_MODEL.md](docs/architecture/DATA_MODEL.md).
- Lehrplangebundene Unterrichtsplanung mit Quellenpflicht.
- Arbeitsblatt-/Aufgaben-/Erwartungshorizont-/Bewertungsraster-Generierung mit Differenzierung.
- Korrekturassistenz mit Bewertungsraster und menschlicher Finalentscheidung.
- Quellen-RAG mit Nachweisen (Quelle, Seite/Abschnitt, Version, Lizenz, Abrufdatum, Hash) — siehe [RAG_ARCHITECTURE.md](docs/architecture/RAG_ARCHITECTURE.md), [CITATION_STANDARD.md](docs/rag/CITATION_STANDARD.md).
- Administration: Rollen, Mandantentrennung, Audit-Log (konzeptionell).

**Out-of-Scope (MVP):**

- Automatische Endnotenvergabe.
- Pädagogisch relevante Entscheidung ohne menschliche Kontrolle.
- Veröffentlichung/Weitergabe von Schülerdaten, öffentliche Schülerplattform.
- Intransparente Websuche ohne Quellenerfassung und Freigabe.
- Scraping urheberrechtlich geschützter Schulbücher/Verlagsmaterialien/Paywall-Inhalte.

## 3. Funktionsbereiche

1. **Unterrichtsplanung** — lehrplanorientierter Planungsassistent, Quellen verpflichtend.
2. **Arbeitsblattgenerator** — Aufgaben, Differenzierung, Export (DOCX/PDF).
3. **Korrekturassistenz** — strukturierte Analyse, begründete Punktvorschläge, Feedback; nur Vorschläge mit Kriterien, Belegen und Unsicherheiten. Siehe [DATA_PROTECTION.md](docs/security/DATA_PROTECTION.md).
4. **Quellen-RAG** — Quellenentdeckung, Prüfung, Freigabe, Ingestion, Versionierung, Evaluierung, Widerruf.
5. **Administration** — Rollen, Mandantentrennung, Auditierbarkeit, Löschkonzept.

## 4. Qualitätsziele

| Ziel                | Bedeutung                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------- |
| Nachvollziehbarkeit | Jede fachliche/curriculare Aussage belegt; Generierungs-Provenienz protokolliert.            |
| Datenschutz         | Datenminimierung, Pseudonymisierung-by-default, lokaler Default-Provider, fail-closed Guard. |
| Curriculum-Fit      | Inhalte an konkrete LSA-Lehrpläne gebunden, Konfessionen strikt getrennt.                    |
| Kostenkontrolle     | Self-hostbar, austauschbarer Stack, lokale Modelle als Default.                              |
| Local-first         | Schülerdaten bleiben standardmäßig lokal; Cloud nur dokumentiert freigegeben.                |

## 5. Architekturübersicht und Datenflüsse

Modularer Monolith (Next.js App Router) + austauschbare Infrastruktur. Komponenten: PostgreSQL (Drizzle ORM), Qdrant (Vektorsuche), S3-kompatibler Object Store (lokal MinIO), Redis + BullMQ (Jobs), separater OCR-/Extraktions-Worker, provider-agnostische LLM-Abstraktion (Ollama lokal als Default). Details: [ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md), [INTEGRATION_BOUNDARIES.md](docs/architecture/INTEGRATION_BOUNDARIES.md).

**LLM-Request-Fluss (Datenschutz-Kern):** Intent/Scope → Provider-Policy-Gate (Default lokal) → **lokale Pseudonymisierung/Redaction** → RAG-Kontext (Pflichtfilter Fach/Konfession/Trust) → **Guard-Assertion (fail-closed)** → Provider-Call → lokale Re-Identifikation (nur lokaler Pfad) → Provenienz-Logging → Zitations-/Confidence-Markierung. Siehe [DATA_PROTECTION.md](docs/security/DATA_PROTECTION.md).

## 6. RAG-Lebenszyklus

`DISCOVERED → UNDER_REVIEW → REGISTERED → APPROVED → INGESTED → VERSIONED → EVALUATED → REVOKED/DELETED`

Quellen werden entdeckt → geprüft (Lizenz, Autorität, Aktualität) → registriert → freigegeben → ingestiert (nur ab `APPROVED`) → versioniert → evaluiert → bei Bedarf widerrufen/gelöscht (kaskadiert über PostgreSQL, Qdrant, Object Store). Vertrauensstufen: `OFFICIAL_BINDING`, `OFFICIAL_GUIDANCE`, `OPEN_CURATED`, `USER_APPROVED`, `UNVERIFIED` (nie produktiv). Details: [RAG_ARCHITECTURE.md](docs/architecture/RAG_ARCHITECTURE.md), [INGESTION_POLICY.md](docs/rag/INGESTION_POLICY.md), [SOURCE_REGISTRY.md](docs/rag/SOURCE_REGISTRY.md).

## 7. Datenklassifizierung

| Klasse              | Beispiele                              | Cloud erlaubt?                                                   |
| ------------------- | -------------------------------------- | ---------------------------------------------------------------- |
| `PUBLIC`            | offen lizenzierte Lehrplan-Codes       | ja                                                               |
| `INTERNAL`          | generische Vorlagen ohne Personenbezug | ja (freigegeben)                                                 |
| `PERSONAL_TEACHER`  | Urheberschaft/Notizen der Lehrkraft    | nur freigegeben                                                  |
| `SENSITIVE_STUDENT` | Schülerarbeiten, Korrekturen           | nur pseudonymisiert + dokumentierte Schulfreigabe; Klarnamen nie |

Maßgeblich: [DATA_PROTECTION.md](docs/security/DATA_PROTECTION.md), [RETENTION_AND_DELETION.md](docs/security/RETENTION_AND_DELETION.md).

## 8. Sicherheits- und Datenschutzanforderungen

- Pseudonymisierung-by-default; Schüler-Klarnamen verlassen das System im Normalbetrieb nie.
- Lokaler Redaction-Schritt **vor jeder** Provider-Anfrage; Guard-Assertion fail-closed.
- Cloud-LLM nur mit dokumentierter Schulfreigabe (`CloudReleaseGrant`: Rechtsgrundlage, AVV, DSFA, Provider/Region); lokaler Ollama = Default.
- Rollenmodell, Mandantentrennung, Verschlüsselung, Secrets-Verwaltung, Auditierbarkeit, Löschkonzept.
- Threat Model: [THREAT_MODEL.md](docs/security/THREAT_MODEL.md). Grundsätze: [SECURITY.md](docs/security/SECURITY.md).

## 9. Teststrategie

- Unit-Tests (Domänenlogik, Constraints, Redaction-Guard), Integrationstests (DB/Drizzle, Qdrant, Jobs), spätere Playwright-E2E.
- RAG-Evaluierung mit Golden Questions je Fach/Konfession; Zitations-Korrektheit als Pflichtmetrik. Siehe [EVALUATION_PLAN.md](docs/rag/EVALUATION_PLAN.md).
- Sicherheits-/Datenschutz-Checks (PII-Leak-Tests gegen den Guard) als CI-Gate, sobald App-Code existiert.
- Qualität: ESLint, Prettier, TypeScript strict. Doku-Gate aktiv: [CI_CD.md](docs/operations/CI_CD.md).

## 10. Betriebsstrategie

- Lokale Entwicklung via Docker Compose; `.env.example` ohne echte Secrets; Ollama lokal. Siehe [DEVELOPMENT.md](docs/operations/DEVELOPMENT.md).
- Observability: strukturierte Logs, Audit-Log, Health Checks, Metrik-/Tracing-Schnittstellen (konzeptionell).
- Backup/Restore inkl. Wiederherstellungstest: [BACKUP_AND_RECOVERY.md](docs/operations/BACKUP_AND_RECOVERY.md).
- Secret-Management und Deployment: in M4 zu spezifizieren.

## 11. Roadmap nach Milestones (ohne Zeitversprechen)

- **M0 – Foundations & Governance** _(weitgehend abgeschlossen, Stand 2026-06-22)_: Vision/Scope, ADRs (0001–0009; 0007/0008 _Proposed_), Datenschutz-/Löschkonzept, Threat Model, Quellenpolicy, initiale Quellenregistry, Curriculummodell, Dev-/CI-Grundgerüst (Paketmanager auf pnpm vereinheitlicht), UX-Flows, alle sechs offenen Grundsatzentscheidungen getroffen. Verbleibend: Übergang zu M1 (erstes Code-Grundgerüst).
- **M1 – Unterrichtsplanung MVP**: Datenmodell Artefakte, Planungsassistent, Arbeitsblattgenerator, Bewertungsraster/Erwartungshorizont, Export-Architektur. _Schritt 1 (UI-Shell) abgeschlossen. Schritt 2 (Branch `m1/data-model-export`): Drizzle-Schema (Auth/Tenant/Curriculum/Artefakte/Provenienz), 4 Migrationen, Postgres-Repositories + Mapping, Export-Subsystem (DOCX/PDF), CI-Gates (Schema-Drift, Migration-Review-Flag) — umgesetzt (Stand 2026-06-22). Noch ausstehend: Planungsassistent-/Arbeitsblattgenerator-Logik (LLM, hängt an M2-RAG)._
- **M2 – Quellen-RAG mit Nachweisen**: Quellenverwaltung, Ingestion, Chunking, Retrieval/Reranking/Zitation, Eval-Suite, Widerruf/Löschung.
- **M3 – Korrekturassistenz MVP**: Korrekturworkflow, Pseudonymisierung/Redaction, Feedbackformat, Upload-/OCR-Sicherheit.
- **M4 – Security, Pilot & Betrieb**: Rollen/Mandanten/Audit, Backup/Restore (Planung abgeschlossen: [BACKUP_AND_RECOVERY.md](docs/operations/BACKUP_AND_RECOVERY.md), [RECOVERY_TEST_PLAN.md](docs/operations/RECOVERY_TEST_PLAN.md)), Deployment/Secrets, Pilotplan ([PILOT_PLAN.md](docs/operations/PILOT_PLAN.md)), Security-Review (OWASP ASVS).

## 12. Risiken, offene Entscheidungen, Abbruchkriterien

**Risiken:** Lehrplan-Lizenzunsicherheit; Re-Identifikation aus pseudonymisiertem Freitext; Rechtslage Cloud-LLM + Schülerdaten in LSA; Curriculum-Versionskonflikte; Kostenkontrolle bei Cloud-Nutzung.

**Entscheidungen (vormals offen):** alle sechs Grundsatzfragen sind entschieden (Stand 2026-06-22) — Sek-II-Scope (MVP Kl. 5–10), `KONFESSIONSSENSIBEL_UEBERGREIFEND` als eigener Strang, Ethik als eigenes Fach (ADR 0006); Pseudonym-Retention mit 12-Monats-Fenster und DSFA-Vorbehalt (ADR 0009); kein Cloud-LLM im MVP, nur Ollama (ADR 0002/0004); Lehrplankonflikte werden dokumentiert statt geraten (ADR 0003). Herleitung und Vorbehalte: [OPEN_QUESTIONS.md](docs/decisions/OPEN_QUESTIONS.md).

**Abbruchkriterien:** Kein lizenzkonformer Quellenzugang → kein produktives RAG. Keine belastbare Pseudonymisierung → keine Korrekturassistenz mit Schülerdaten. Keine dokumentierte Rechtsgrundlage → kein Cloud-LLM für personenbezogene Daten.

## 13. Definition of Done je Arbeitsphase

- **Doku/Spec-Phase:** Dokument vollständig, intern verlinkt, widerspruchsfrei; offene Punkte als Issue erfasst; `scripts/verify-docs.sh` grün.
- **Architektur-Phase:** ADR mit Status/Kontext/Optionen/Entscheidung/Konsequenzen; Datenmodell mit Constraints; Review durch Maintainer.
- **Implementierungs-Phase (später):** Tests grün (Unit/Integration), Lint/Typecheck grün, Sicherheits-/Datenschutz-Checks bestanden, Quellennachweise verifiziert, menschliche Kontrolle gewährleistet, Doku aktualisiert.
- **Pilot-Phase:** nur synthetische Testdaten; Go/No-Go-Kriterien dokumentiert; Datenschutz-Review bestanden.

---

### Bezug zu den Ausführungs-/Governance-Dokumenten

ADRs: [0001](docs/adr/0001-modular-monolith-first.md) · [0002](docs/adr/0002-provider-agnostic-llm-layer.md) · [0003](docs/adr/0003-source-governance-before-ingestion.md) · [0004](docs/adr/0004-local-first-student-data.md) · [0005](docs/adr/0005-orm-drizzle.md) · [0006](docs/adr/0006-curriculum-modeling.md) · [0007](docs/adr/0007-auth-solution.md) _(Proposed)_ · [0008](docs/adr/0008-document-export-stack.md) _(Proposed/Angekündigt)_ · [0009](docs/adr/0009-pseudonym-retention.md). Offene Entscheidungen: alle 6 aus [OPEN_QUESTIONS.md](docs/decisions/OPEN_QUESTIONS.md) entschieden (Stand 2026-06-22). GitHub-Planung & Status: [GITHUB_SETUP.md](docs/operations/GITHUB_SETUP.md).
