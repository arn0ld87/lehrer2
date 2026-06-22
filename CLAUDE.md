# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> **`AGENTS.md` ist die kanonische Orientierungskarte** (tool-agnostisch, kompakt). Diese Datei ergänzt Claude-Code-spezifische Vertiefungen (RAG-Governance, LLM-Request-Fluss, Datenklassifizierung) und widerspricht `AGENTS.md` nicht.

## Projektstatus

**Planungs- und Architekturphase. Es existiert noch kein Produktivcode/keine lauffähige App** — aber das Repo-Gerüst steht. Committet: `README.md`, `CLAUDE.md`, `AGENTS.md`, `PLAN.md`, ein weitgehend vollständiger `docs/`-Baum, das statische Design-Kit (`unterrichtsassistenz-lsa-design-kit/`) sowie Tooling-/CI-Gerüst: `package.json`, `compose.yaml`, `.env.example`, `.editorconfig`, `.nvmrc`, `.prettierrc.json`, `.prettierignore`, `scripts/` (`verify-docs.sh`, `verify-docs.mjs`), `data/source-registry.seed.yaml` und `.github/` (CI-Workflow `ci.yml`, Issue-Templates, PR-Template).

**`docs/` ist nahezu vollständig.** Existieren: `docs/architecture/` (ARCHITECTURE, INTEGRATION_BOUNDARIES, DATA_MODEL, RAG_ARCHITECTURE), `docs/product/` (PRODUCT_VISION, MVP_SCOPE, ACCEPTANCE_CRITERIA, USER_FLOWS), `docs/rag/` (EVALUATION_PLAN, INGESTION_POLICY, CITATION_STANDARD, SOURCE_REGISTRY), `docs/security/` (SECURITY, THREAT_MODEL, DATA_PROTECTION, RETENTION_AND_DELETION), `docs/operations/` (CI_CD, DEVELOPMENT, BACKUP_AND_RECOVERY, GITHUB_SETUP), `docs/design/DESIGN_SYSTEM.md`, `docs/adr/0001`–`0005`, `docs/decisions/OPEN_QUESTIONS.md`, `LICENSE-DECISION.md`.

**Stolperfalle:** Alle von `PLAN.md`/`README.md` verlinkten Dokumente existieren inzwischen — die Soll-/Ist-Lücke ist geschlossen. Bei neuen Links dennoch weiter auf Existenz prüfen, nicht blind dem Link vertrauen. Paketmanager ist **`pnpm`** (`pnpm-lock.yaml` + `packageManager`-Pin in `package.json`); `package-lock.json` wurde entfernt.

**`PLAN.md` ist Source of Truth** für Scope, Roadmap (M0–M4), Datenflüsse und offene Entscheidungen — vor Architekturarbeit lesen.

Konsequenz: Von den unten gelisteten Befehlen sind nur `pnpm format`, `pnpm format:check` und `pnpm verify:docs` real (siehe `package.json`); `pnpm lint`/`typecheck`/`test` sind **Sollzustand**, weil noch kein Anwendungscode existiert. Beim Anlegen der ersten Implementierung den im README/PLAN dokumentierten Stack einhalten, nicht eigenmächtig ersetzen.

## Design-Kit und UI-Implementierung

`unterrichtsassistenz-lsa-design-kit/` enthält statische HTML-Mockups (`dashboard.html`, `planner.html`, `worksheet-builder.html`, `correction.html`, `sources.html`, `ui-kit.html`) plus `design-tokens.json` und `handoff/CLAUDE_CODE_HANDOFF.md`. Der Handoff ist die Arbeitsanweisung für die erste UI-Implementierung in Next.js — verbindlich für diesen Schritt:

- **Nur UI-Struktur**, keine echten RAG-/Korrektur-/Lehrplan-/LLM-Funktionen (Nicht-Ziele im Handoff).
- Routen: `/dashboard`, `/planung`, `/arbeitsblaetter`, `/korrektur`, `/quelle`, `/design-system`.
- Next.js App Router, TypeScript strict, Tailwind; Tokens zentral aus `design-tokens.json` (keine verstreuten Hex-Werte), Icons via `lucide-react` (keine Inline-SVG-Duplikate).
- Demodaten als Mock-Factories/Repository-Interfaces trennen — keine echten Schülerdaten, Tokens oder Lehrplandokumente.
- Desktop-Sidebar 260px, Seitenfläche `#F7F7FB`, Primärfarbe `#5D3DF5`, Kartenradius 22px, max. eine primäre Aktion pro Seitenkopf.
- Quellen- und Unsicherheitszustände dürfen nie verdeckt werden; UI kopiert keine Bewertung automatisch in ein finales Ergebnis (menschliche Finalentscheidung wahren).

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

ORM ist entschieden (Drizzle, ADR 0005). **Auth-Lösung und Export-Stack sind weiterhin offen** und werden per **ADR in `docs/adr/`** entschieden — nicht ad hoc festlegen. Bestehende ADRs (laut PLAN): 0001 Modular Monolith, 0002 Provider-agnostische LLM-Schicht, 0003 Source-Governance vor Ingestion, 0004 Local-first Schülerdaten, 0005 Drizzle.

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

## Geplante Befehle

Paketmanager ist **`pnpm`** (nicht npm/yarn). Lokale Umgebung über Docker Compose.

```bash
cp .env.example .env
pnpm install
docker compose up -d

pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
```

Vor Commit erwartet (siehe README „Beitragen"): `git diff --check`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`.

## Beitragsregeln

- Keine unklar lizenzierten Materialien oder Schulbuchkopien einchecken.
- Keine echten Schülerdaten, personenbezogenen Testdaten oder API-Schlüssel committen.
- Änderungen an Quellen, Datenschutz oder Bewertungslogik nachvollziehbar dokumentieren.
- Sicherheitsrelevante Änderungen als `type: security` Issue führen.
