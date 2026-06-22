# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projektstatus

**Planungs- und Architekturphase. Es existiert noch kein Code.** Vorhanden: `README.md` (committet), `CLAUDE.md`, `PLAN.md`. Alles ausser `README.md` ist git-untracked (`git status`: `??`). `data/` und `scripts/` existieren, sind aber leer.

**Stolperfalle:** `PLAN.md` verlinkt rund zwanzig `docs/`-Dateien (ADRs, `docs/architecture/*`, `docs/security/*`, `docs/rag/*`, `docs/operations/*`, `docs/decisions/*`) — **keine davon existiert** (`docs/` enthält nur leere Unterordner). Die Links sind Soll-Struktur, nicht vorhandene Dokumente. Ebenso noch nicht angelegt: `.env.example`, `package.json`, `LICENSE-DECISION.md`, `scripts/verify-docs.sh` (geplantes Doku-Gate, in der DoD referenziert).

**`PLAN.md` ist Source of Truth** für Scope, Roadmap (M0–M4), Datenflüsse und offene Entscheidungen — vor Architekturarbeit lesen.

Konsequenz: Build-/Test-/Lint-Befehle (siehe unten) sind **Sollzustand**, nicht lauffähig. Beim Anlegen der ersten Implementierung den im README/PLAN dokumentierten Stack einhalten, nicht eigenmächtig ersetzen.

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

| Stufe | Produktiver RAG-Einsatz |
| --- | --- |
| `OFFICIAL_BINDING` (amtliche Lehrpläne/Rechtsquellen) | ja |
| `OFFICIAL_GUIDANCE` (LISA-/Ministeriums-Handreichungen) | ja, nach Prüfung |
| `OPEN_CURATED` (offen lizenziert, redaktionell geprüft) | ja, nach Freigabe |
| `USER_APPROVED` (von Schule/Lehrkraft freigegeben) | ja, mandantenbezogen |
| `UNVERIFIED` (Recherchekandidat) | **nein** |

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
