# Unterrichtsassistenz LSA

Datenschutzsensibler, quellengebundener KI-Assistent für Lehrkräfte an Gesamtschulen und Gemeinschaftsschulen in Sachsen-Anhalt.

## Status

**M0 (Fundament & Governance) abgeschlossen; M1 in Umsetzung — Schritt 1 (UI-Shell) und Schritt 2 (Datenmodell + Export) sind in `main` gemergt (CI grün).** Lauffähig sind: die Next.js-UI-Shell (sechs Routen, statisch prerendered), die persistente Datenschicht (PostgreSQL via Drizzle — Auth/Tenant, Curriculum mit Konfessions-CHECK, Artefakte, Provenienz/Audit), Better Auth (single-tenant, ADR 0007) und das Export-Subsystem (DOCX/PDF hinter `exportArtifact`, ADR 0008).

**Noch nicht real:** RAG/Retrieval, LLM-Provider-Anbindung, Planungs-/Arbeitsblatt-Logik (M2) sowie Korrekturassistenz mit Pseudonymisierung/Redaction (M3). Die UI zeigt ausschließlich synthetische Demodaten (Mock-Layer) — keine echten Schülerdaten. Dieses Repository macht **keine überprüfte Konformitätsbehauptung**; jede solche Aussage wird erst getroffen, wenn sie vollständig umgesetzt und überprüft ist.

Repository: `arn0ld87/lehrer2` (privat).

## Zielgruppe und Fächerschwerpunkt

- **Schultyp:** Gesamt- und Gemeinschaftsschulen in Sachsen-Anhalt
- **Klassenstufen:** 5 bis 12
- **Fächer (MVP):** Deutsch und Religion (evangelisch, katholisch, konfessionssensibel/übergreifend; Ethik getrennt modelliert)
- **Nutzende:** Lehrkräfte; später Fachkonferenzen und Schuladministration

## Übersicht und Links

### Einstieg

- **[PLAN.md](PLAN.md)** — Scope, Roadmap, Zielgruppen, Problemstellung, Datenflüsse (Source of Truth)
- **[LICENSE-DECISION.md](LICENSE-DECISION.md)** — Lizenzentscheidung (Status: offen)

### Produktgestaltung

- **[docs/product/PRODUCT_VISION.md](docs/product/PRODUCT_VISION.md)** — Vision und Nutzenversprechen
- **[docs/product/MVP_SCOPE.md](docs/product/MVP_SCOPE.md)** — In-Scope und Out-of-Scope (MVP)
- **[docs/product/USER_FLOWS.md](docs/product/USER_FLOWS.md)** — Hauptaufgaben und Nutzungsszenarien
- **[docs/product/ACCEPTANCE_CRITERIA.md](docs/product/ACCEPTANCE_CRITERIA.md)** — Definition of Done und Qualitätsmetriken

### Architektur

- **[docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md)** — Systemübersicht, Komponenten und Integrationspunkte
- **[docs/architecture/DATA_MODEL.md](docs/architecture/DATA_MODEL.md)** — Kerndatenklassen (Curriculum, Unterrichtsmaterial, Schülerarbeit usw.)
- **[docs/architecture/INTEGRATION_BOUNDARIES.md](docs/architecture/INTEGRATION_BOUNDARIES.md)** — API-Kontrakte und Systemgrenzen
- **[docs/architecture/RAG_ARCHITECTURE.md](docs/architecture/RAG_ARCHITECTURE.md)** — Retrieval-Augmented Generation, Quellenbindung und Kontext

### Architekturchentscheidungen (ADRs)

- **[docs/adr/0001-modular-monolith-first.md](docs/adr/0001-modular-monolith-first.md)** — Modular Monolith statt Microservices für MVP
- **[docs/adr/0002-provider-agnostic-llm-layer.md](docs/adr/0002-provider-agnostic-llm-layer.md)** — Abstraktion über LLM-Provider (lokal/Cloud)
- **[docs/adr/0003-source-governance-before-ingestion.md](docs/adr/0003-source-governance-before-ingestion.md)** — Quellen-Governance vor jeder Ingestion
- **[docs/adr/0004-local-first-student-data.md](docs/adr/0004-local-first-student-data.md)** — Lokale Speicherung und Pseudonymisierung vor Cloud-Übertragung
- **[docs/adr/0005-orm-drizzle.md](docs/adr/0005-orm-drizzle.md)** — Drizzle ORM für PostgreSQL
- **[docs/adr/0006-curriculum-modeling.md](docs/adr/0006-curriculum-modeling.md)** — Curriculum-Modellierung: Sek-II-Scope, Konfessionsstrang, Ethik als eigenes Fach
- **[docs/adr/0007-auth-solution.md](docs/adr/0007-auth-solution.md)** — Authentifizierung (Status _Akzeptiert_ 2026-06-22; Better Auth, single-tenant)
- **[docs/adr/0008-document-export-stack.md](docs/adr/0008-document-export-stack.md)** — DOCX/PDF-Export-Stack (Status _Akzeptiert_ 2026-06-22; docx + pdfkit)
- **[docs/adr/0009-pseudonym-retention.md](docs/adr/0009-pseudonym-retention.md)** — Pseudonym-Stabilität und Mapping-Löschung (DSGVO Art. 17)

### RAG und Quellengovernance

- **[docs/rag/SOURCE_REGISTRY.md](docs/rag/SOURCE_REGISTRY.md)** — Verwaltung von Lehrplandokumenten, Fachliteratur und Metadaten
- **[docs/rag/INGESTION_POLICY.md](docs/rag/INGESTION_POLICY.md)** — Prozess für Dokumenteingestion und Versionierung
- **[docs/rag/EVALUATION_PLAN.md](docs/rag/EVALUATION_PLAN.md)** — Evaluation von Abdeckung und Relevanz
- **[docs/rag/CITATION_STANDARD.md](docs/rag/CITATION_STANDARD.md)** — Format für Quellenangaben und Belegung

### Datenschutz und Sicherheit

- **[docs/security/SECURITY.md](docs/security/SECURITY.md)** — Sicherheitsarchitektur und Bedrohungsmodell
- **[docs/security/THREAT_MODEL.md](docs/security/THREAT_MODEL.md)** — Identifizierung und Bewertung von Risiken
- **[docs/security/ASVS_COMPLIANCE.md](docs/security/ASVS_COMPLIANCE.md)** — Review gegen OWASP ASVS
- **[docs/security/DATA_PROTECTION.md](docs/security/DATA_PROTECTION.md)** — Datenschutzvorkehrungen und Rechtsgrundlagen
- **[docs/security/DATA_PROTECTION_CHECKLIST.md](docs/security/DATA_PROTECTION_CHECKLIST.md)** — Datenschutz-Checkliste
- **[docs/security/SECURITY_FINDINGS.md](docs/security/SECURITY_FINDINGS.md)** — Identifizierte Sicherheitslücken (Review-Ergebnisse)
- **[docs/security/RETENTION_AND_DELETION.md](docs/security/RETENTION_AND_DELETION.md)** — Aufbewahrungsrichtlinien und Löschungsverfahren

### Betrieb und Entwicklung

- **[docs/operations/DEVELOPMENT.md](docs/operations/DEVELOPMENT.md)** — Lokale Entwicklung starten (Quickstart)
- **[docs/operations/GITHUB_SETUP.md](docs/operations/GITHUB_SETUP.md)** — Workflow, Branches und PR-Prozess
- **[docs/operations/PILOT_PLAN.md](docs/operations/PILOT_PLAN.md)** — Pilotplan mit synthetischen Testdaten und Feedbackprozess
- **[docs/operations/CI_CD.md](docs/operations/CI_CD.md)** — CI/CD-Pipeline und Automation
- **[docs/operations/BACKUP_AND_RECOVERY.md](docs/operations/BACKUP_AND_RECOVERY.md)** — Backup, Disaster Recovery und Datenintegrität

### Offene Fragen

- **[docs/decisions/OPEN_QUESTIONS.md](docs/decisions/OPEN_QUESTIONS.md)** — Ungelöste Designentscheidungen und Blinder Flecke

---

## Quickstart

Zum Starten der lokalen Entwicklung siehe **[docs/operations/DEVELOPMENT.md](docs/operations/DEVELOPMENT.md)**.

### Verfügbare Scripts

Paketmanager ist **`pnpm`** (niemals npm/yarn).

```bash
pnpm dev             # Next.js Dev-Server (http://localhost:3000)
pnpm build           # Produktionsbuild
pnpm start           # Produktionsserver
pnpm lint            # ESLint
pnpm typecheck       # tsc --noEmit (strict)
pnpm format          # Prettier (schreibend)
pnpm format:check    # Prettier (prüfend, für CI)
pnpm verify:docs     # Doku-Gate: prüft verlinkte Dateien auf Existenz
pnpm test            # Vitest mit Testcontainers (benötigt Docker)
pnpm db:generate     # Drizzle-Kit: Migrationsdatei aus Schema generieren
pnpm db:migrate      # Drizzle-Kit: Migrationen auf die DB anwenden
pnpm db:check        # Drizzle-Kit: Schema-Drift prüfen (kein DB-Zugriff nötig)
```

## Beitrag und Feedback

Dieses Projekt ist privat. Fragen, Ideen und Feedback von Stakeholdern werden erfasst und in Issues dokumentiert.

## Lizenz

Die Lizenzentscheidung ist noch nicht abgeschlossen. Siehe **[LICENSE-DECISION.md](LICENSE-DECISION.md)** für den aktuellen Stand und die Optionen.
