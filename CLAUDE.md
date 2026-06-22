# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> **`AGENTS.md` ist die kanonische Orientierungskarte** (tool-agnostisch, kompakt). Diese Datei ergänzt Claude-Code-spezifische Vertiefungen (RAG-Governance, LLM-Request-Fluss, Datenklassifizierung) und widerspricht `AGENTS.md` nicht.

## Projektstatus

**M0 (Foundations & Governance) abgeschlossen; M1 Schritt 1 (UI-Shell) und Schritt 2 (Datenmodell + Export) umgesetzt (Branch `m1/data-model-export`); M2 Schritt 1 (Quellen-RAG-Gerüst) umgesetzt (Branch `m2/rag-geruest`).** Auf der lauffähigen Next.js-UI-Shell steht jetzt die persistente Datenschicht: PostgreSQL via Drizzle (Curriculum-Topologie mit Konfessions-CHECK am `curriculum_strand`, Artefakte Unit→Lesson/Worksheet→Task→Horizon, Rubric, SourceRef, Joins, Provenienz/Audit), Better Auth single-tenant (ADR 0007) und das Export-Subsystem (docx + pdfkit hinter `exportArtifact`, ADR 0008). Die UI-Repository-Verträge aus `src/lib/repositories.ts` haben Postgres-Implementierungen hinter einer Factory (`mock` ↔ `db` per `REPOSITORY_BACKEND`); die UI bleibt unverändert. Noch nicht real: RAG/Retrieval, LLM-Provider-Anbindung, Korrekturassistenz (`SENSITIVE_STUDENT` = M3), Cloud-LLM-Freigaben. Repo-Gerüst und Doku: `README.md`, `CLAUDE.md`, `AGENTS.md`, `PLAN.md`, ein weitgehend vollständiger `docs/`-Baum, das statische Design-Kit (`unterrichtsassistenz-lsa-design-kit/`) sowie Tooling-/CI-Gerüst: `package.json`, `compose.yaml`, `.env.example`, `.editorconfig`, `.nvmrc`, `.prettierrc.json`, `.prettierignore`, `scripts/` (`verify-docs.sh`, `verify-docs.mjs`, `check-schema-drift.mjs`), `data/source-registry.seed.yaml` und `.github/` (CI-Workflow `ci.yml`, Issue-Templates, PR-Template).

**`docs/` ist nahezu vollständig.** Existieren: `docs/architecture/` (ARCHITECTURE, INTEGRATION_BOUNDARIES, DATA_MODEL, RAG_ARCHITECTURE), `docs/product/` (PRODUCT_VISION, MVP_SCOPE, ACCEPTANCE_CRITERIA, USER_FLOWS), `docs/rag/` (EVALUATION_PLAN, INGESTION_POLICY, CITATION_STANDARD, SOURCE_REGISTRY), `docs/security/` (SECURITY, THREAT_MODEL, DATA_PROTECTION, RETENTION_AND_DELETION), `docs/operations/` (CI_CD, DEVELOPMENT, BACKUP_AND_RECOVERY, GITHUB_SETUP), `docs/design/DESIGN_SYSTEM.md`, `docs/adr/0001`–`0009` (0005 Drizzle / 0007 Auth / 0008 Export akzeptiert 2026-06-22), `docs/decisions/OPEN_QUESTIONS.md` (alle 6 Fragen entschieden), `LICENSE-DECISION.md`.

**Stolperfalle:** Alle von `PLAN.md`/`README.md` verlinkten Dokumente existieren inzwischen — die Soll-/Ist-Lücke ist geschlossen. Bei neuen Links dennoch weiter auf Existenz prüfen, nicht blind dem Link vertrauen. Paketmanager ist **`pnpm`** (`pnpm-lock.yaml` + `packageManager`-Pin in `package.json`); `package-lock.json` wurde entfernt.

**`PLAN.md` ist Source of Truth** für Scope, Roadmap (M0–M4), Datenflüsse und offene Entscheidungen — vor Architekturarbeit lesen.

Konsequenz: `pnpm dev`, `pnpm build`, `pnpm start`, `pnpm lint`, `pnpm typecheck`, `pnpm format`, `pnpm format:check`, `pnpm verify:docs`, `pnpm test` (Vitest + Testcontainers) sowie `pnpm db:generate`/`db:migrate`/`db:check` sind real (siehe `package.json`). `pnpm test` und `pnpm db:migrate` benötigen Docker (Postgres-Testcontainer). Beim Erweitern den im README/PLAN dokumentierten Stack einhalten, nicht eigenmächtig ersetzen.

## Design-Kit und UI-Implementierung

`unterrichtsassistenz-lsa-design-kit/` enthält statische HTML-Mockups (`dashboard.html`, `planner.html`, `worksheet-builder.html`, `correction.html`, `sources.html`, `ui-kit.html`) plus `design-tokens.json` und `handoff/CLAUDE_CODE_HANDOFF.md`. Der Handoff war die Arbeitsanweisung für die erste UI-Implementierung — **M1 Schritt 1 ist umgesetzt** (Branch `m1/ui-shell`):

- **Nur UI-Struktur**, keine echten RAG-/Korrektur-/Lehrplan-/LLM-Funktionen (Nicht-Ziele im Handoff) — eingehalten.
- Routen realisiert: `/dashboard`, `/planung`, `/arbeitsblaetter`, `/korrektur`, `/quelle`, `/design-system`.
- Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, `lucide-react`.
- Tokens zentral in `src/app/globals.css` (`@theme`), kanonisch aus `design-tokens.json` — **keine verstreuten Hex-Werte** in Komponenten (Review bestätigt: 0 Inline-Hex außerhalb `design-system/page.tsx` Swatches). Icons via zentralem Mapper `src/components/ui/icon.tsx` (keine Inline-SVG-Duplikate).
- Demodaten über Mock-Factories/Repository-Interfaces (`src/lib/mock/`), keine echten Schülerdaten/Tokens/Lehrplandokumente. Das angezeigte Nutzerprofil (Jana Zwarg) ist die echte Zielnutzerin.
- Desktop-Sidebar 260px, Seitenfläche `#F7F7FB`, Primärfarbe `#5D3DF5`, Kartenradius 22px, max. eine primäre Aktion pro Seitenkopf — umgesetzt.
- Quellen-/Unsicherheitszustände bleiben sichtbar (`StatusChip`, `Notice`); UI übernimmt keine Bewertung automatisch („Prüfen" statt „Übernehmen").

Akzeptanzkriterien des Handoffs sind erfüllt (Reviewer-Check); `pnpm lint`, `typecheck`, `format:check`, `build` sind grün.

## Worum es geht

**Unterrichtsassistenz LSA** — datenschutzsensibler, quellengebundener KI-Assistent für Lehrkräfte an Gesamt- und Gemeinschaftsschulen in Sachsen-Anhalt. Erster Ausbauschritt: Fächer Deutsch und Religion, Klassen 5–12. Unterstützt Planung, Materialerstellung und Korrekturvorbereitung — automatisiert **keine** pädagogische oder Bewertungsentscheidung.

## Bindende Grundsätze (gelten für jede Implementierungsentscheidung)

Diese fünf Prinzipien sind nicht verhandelbar und prägen die Architektur. Vorschläge, die dagegen verstoßen, sind abzulehnen bzw. mit Gegenvorschlag zu versehen:

1. **Lehrplanbezug** — curriculare Aussagen stützen sich auf überprüfbare Quellen, nicht auf Modellwissen.
2. **Quellenpflicht** — jede fachliche/curriculare Aussage trägt Quelle, Version, Abschnitt/Seite und Abrufdatum.
3. **Local-first** — lokale/selbst gehostete Komponenten sind Standard (Ollama / lokale OpenAI-kompatible APIs). Cloud-LLMs nur bei dokumentierter Freigabe + Rechtsgrundlage.
4. **Datensparsamkeit** — Schülerdaten werden pseudonymisiert und vor jeder externen KI-Anfrage technisch reduziert (Redaction). Keine echten Schülernamen an externe Provider.
5. **Menschliche Finalentscheidung** — System liefert Vorschläge, Begründungen, Unsicherheiten; vergibt **keine** verbindlichen Noten.

### MVP-Nicht-Ziele (bewusst ausgeschlossen)

Automatische Endnoten, Schülerkonten/-plattform, unkontrollierte Websuche, Auto-Übernahme unklar lizenzierter Quellen, Upload echter Schülerarbeiten an externe KI, Scraping geschützter Schulbücher/Verlagsmaterialien.

## Architektur (geplant)

Modularer Monolith (bewusst kein früher Microservice-Schnitt). Schichten:

- **Web-App** — Next.js App Router, TypeScript, Tailwind CSS
- **Application Layer** — Unterrichtsplanung, Arbeitsblätter, Korrekturassistenz, Auth
- **Persistenz** — PostgreSQL via **Drizzle ORM** (ADR 0005) (Nutzer, Metadaten, Audit) + Qdrant (Vektorsuche, Chunk-Metadaten)
- **Dokumente** — S3-kompatibel, lokal MinIO
- **RAG-/Job-Layer** — Quellenprüfung, Ingestion, Extraktion, Redaction, Retrieval; Hintergrundjobs über Redis + BullMQ; separater OCR-/Extraktions-Worker
- **LLM-Provider-Abstraktion** — Ollama (lokal = Default) / lokale OpenAI-kompatible APIs, Cloud-Provider hinter Freigaben

ORM ist entschieden (Drizzle, ADR 0005, akzeptiert). **Auth-Lösung (ADR 0007, Better Auth single-tenant) und Export-Stack (ADR 0008, docx + pdfkit) sind akzeptiert (2026-06-22) und umgesetzt** — nicht eigenmächtig abweichen. ADRs: 0001 Modular Monolith, 0002 Provider-agnostische LLM-Schicht, 0003 Source-Governance vor Ingestion, 0004 Local-first Schülerdaten, 0005 Drizzle, 0006 Curriculum-Modellierung (Sek II/Konfession/Ethik), 0007 Auth (Akzeptiert, Better Auth), 0008 Export (Akzeptiert, docx + pdfkit), 0009 Pseudonym-Retention (DSFA-Vorbehalt).

**LLM-Request-Fluss (Datenschutz-Kern, fail-closed):** Intent/Scope → Provider-Policy-Gate (Default lokal) → lokale Pseudonymisierung/Redaction → RAG-Kontext (Pflichtfilter Fach/Konfession/Trust) → **Guard-Assertion (bricht ab, wenn PII durchrutscht)** → Provider-Call → lokale Re-Identifikation (nur lokaler Pfad) → Provenienz-Logging → Zitations-/Confidence-Markierung. Diesen Guard nie umgehen oder abschwächen.

## Quellen-/RAG-Governance

Der RAG-Bestand ist streng kuratiert. Jede Quelle hat eine **Vertrauensstufe**, die über den produktiven Einsatz entscheidet:

| Stufe                                                   | Produktiver RAG-Einsatz |
| ------------------------------------------------------- | ----------------------- |
| `OFFICIAL_BINDING` (amtliche Lehrpläne/Rechtsquellen)   | ja                      |
| `OFFICIAL_GUIDANCE` (LISA-/Ministeriums-Handreichungen) | ja, nach Prüfung        |
| `OPEN_CURATED` (offen lizenziert, redaktionell geprüft) | ja, nach Freigabe       |
| `USER_APPROVED` (von Schule/Lehrkraft freigegeben)      | ja, mandantenbezogen    |
| `UNVERIFIED` (Recherchekandidat)                        | **nein**                |

RAG-Chunks tragen verpflichtend Metadaten (u. a. `source_id`, `trust_level`, `subject`, `school_form`, `grade_range`, `version_or_date`, `license_or_terms`, `retrieved_at`, `content_hash`, `page_or_section`) — vollständiges Schema im README, Abschnitt „Quellen- und RAG-Governance".

Fachliche Modellierung: Sek I und Sek II getrennt; Religion **nicht** pauschal — evangelisch, katholisch und konfessionssensibel/übergreifend müssen curricular unterscheidbar bleiben; **Ethik wird als eigenes Fach getrennt** modelliert (nicht unter Religion subsumieren).

Datenklassifizierung steuert Cloud-Zulässigkeit: `PUBLIC` und `INTERNAL` (Cloud nach Freigabe), `PERSONAL_TEACHER` (nur freigegeben), `SENSITIVE_STUDENT` (nur pseudonymisiert + dokumentierte Schulfreigabe; Klarnamen verlassen das System nie). Cloud-LLM nur mit `CloudReleaseGrant` (Rechtsgrundlage, AVV, DSFA, Provider/Region).

## Befehle

Paketmanager ist **`pnpm`** (nicht npm/yarn). `pnpm dev`/Lint/Typecheck/Build laufen ohne Docker; `pnpm test` und `pnpm db:migrate` benötigen Docker Compose (Postgres).

```bash
cp .env.example .env   # Werte niemals committen
pnpm install
docker compose up -d   # Postgres für db:migrate / test (Testcontainers)
pnpm dev               # Dev-Server (http://localhost:3000)

pnpm lint              # ESLint (flat config)
pnpm typecheck         # tsc --noEmit (strict)
pnpm format:check      # Prettier (md/yml/yaml/json)
pnpm build             # Produktionsbuild (statisches Prerender)
pnpm test              # Vitest + @testcontainers/postgresql (Docker nötig)

pnpm db:generate       # Drizzle-Kit: Migration aus Schema generieren
pnpm db:migrate        # Migrationen auf die DB anwenden
pnpm db:check          # Schema-Drift prüfen (kein DB-Zugriff nötig)
```

Repository-Backend per `REPOSITORY_BACKEND=mock|db` (Default `mock`); `db` nutzt die Postgres-Repositories (`src/lib/db/repositories/`). Vor Commit: `git diff --check`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm build`, `pnpm test`. CI zusätzlich: Schema-Drift-Gate (`scripts/check-schema-drift.mjs`) und Migrations-Review-Flag für `DELETE`/`UPDATE` in `drizzle/*.sql`.

## Beitragsregeln

- Keine unklar lizenzierten Materialien oder Schulbuchkopien einchecken.
- Keine echten Schülerdaten, personenbezogenen Testdaten oder API-Schlüssel committen.
- Änderungen an Quellen, Datenschutz oder Bewertungslogik nachvollziehbar dokumentieren.
- Sicherheitsrelevante Änderungen als `type: security` Issue führen.
- **Migrations-Reviewpflicht (ADR 0005):** jede `.sql`-Migration im PR reviewen; Löschungen nur über benannte Repository-Methoden (`src/lib/db/repositories/deletion.ts`), nie ad-hoc `DELETE`/`UPDATE` — CI flaggt solche Statements in `drizzle/*.sql`.
