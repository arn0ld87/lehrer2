<div align="center">

# Unterrichtsassistenz LSA

**Datenschutzsensibler, quellengebundener KI-Assistent für Lehrkräfte an Gesamt- und Gemeinschaftsschulen in Sachsen-Anhalt.**

Unterrichtsplanung, Arbeitsblätter und Korrekturvorbereitung — gestützt auf überprüfbare Lehrplanquellen, lokal-first betrieben, ohne automatisierte pädagogische oder Bewertungsentscheidung.

[![Repository](https://img.shields.io/badge/GitHub-arn0ld87%2Flehrer2-111?style=flat-square&logo=github)](https://github.com/arn0ld87/lehrer2)
[![License](https://img.shields.io/badge/License-offen-lightgrey?style=flat-square)](./LICENSE-DECISION.md)
[![Next.js](https://img.shields.io/badge/Next.js-16-000?style=flat-square&logo=nextdotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Drizzle](https://img.shields.io/badge/ORM-Drizzle-C5F74F?style=flat-square)](https://orm.drizzle.team/)
[![Status](https://img.shields.io/badge/Status-M2%20in%20Arbeit-orange?style=flat-square)](./PLAN.md)

[Quick Start](#quick-start) · [Betriebsmodi](#betriebsmodi) · [Pipeline](#pipeline) · [Architektur](#architektur) · [Grundsätze](#bindende-grundsätze) · [RAG-Governance](#quellen--und-rag-governance) · [Sicherheit](#sicherheit-und-datenschutz) · [Doku](./docs/)

</div>

---

## Quick Start

Paketmanager ist **`pnpm`** (niemals npm/yarn). `pnpm dev`/Lint/Typecheck/Build laufen ohne Docker; `pnpm test` und `pnpm db:migrate` benötigen Docker Compose (PostgreSQL via Testcontainers).

```bash
cp .env.example .env   # Werte niemals committen
pnpm install
docker compose up -d   # PostgreSQL für db:migrate / test
pnpm dev               # Next.js Dev-Server
```

| Dienst               | URL                                            |
| -------------------- | ---------------------------------------------- |
| Web-App (Dev)        | <http://localhost:3000>                        |
| PostgreSQL (Compose) | `localhost:5432` (siehe `compose.yaml`/`.env`) |

Standardmäßig läuft die UI gegen synthetische Demodaten (`REPOSITORY_BACKEND=mock`). Mit `REPOSITORY_BACKEND=db` greifen die Routen auf die PostgreSQL-Repositories zu.

## Was ist Unterrichtsassistenz LSA?

Ein Assistenzsystem für Lehrkräfte, das bei **Planung, Materialerstellung und Korrekturvorbereitung** unterstützt — und dabei jede fachliche oder curriculare Aussage an überprüfbare Quellen bindet statt an Modellwissen.

Erster Ausbauschritt: die Fächer **Deutsch** und **Religion** (evangelisch, katholisch, konfessionssensibel/übergreifend; **Ethik getrennt** modelliert), Klassen **5–12**, an Gesamt- und Gemeinschaftsschulen in Sachsen-Anhalt.

Das System ist **lokal-first** ausgelegt: lokale bzw. selbst gehostete Komponenten (Ollama / lokale OpenAI-kompatible APIs) sind Standard. Cloud-LLMs werden nur bei dokumentierter Freigabe und Rechtsgrundlage genutzt. Schülerdaten werden pseudonymisiert und vor jeder externen Anfrage technisch reduziert; Klarnamen verlassen das System nie.

## Wofür es gedacht ist

Typische Einsätze:

- Unterrichtsstunden und -reihen entlang des Lehrplans entwerfen
- Arbeitsblätter und Aufgaben mit Quellenbelegen erzeugen
- Korrektur vorbereiten — mit Bewertungsraster, Begründungen und ausgewiesenen Unsicherheiten
- curriculare Bezüge (Kompetenzen, Standards, Konfession) nachvollziehbar machen
- Materialien gegen den kuratierten, vertrauensstufengeprüften Quellenbestand absichern

Das System **ersetzt keine pädagogische Entscheidung**. Es liefert Vorschläge, Begründungen und Unsicherheiten; die Finalentscheidung bleibt bei der Lehrkraft.

## Was es erzeugt

- Unterrichtsplanungen (Unit → Lesson) mit curricularem Bezug
- Arbeitsblätter (Worksheet → Task) mit Aufgaben und Lösungshorizonten
- Korrekturvorbereitungen mit Bewertungsraster (Rubric) — ohne verbindliche Note
- Quellenangaben mit Version, Abschnitt/Seite und Abrufdatum (Zitationsstandard)
- Confidence- und Unsicherheitsmarkierungen statt stiller Übernahme
- DOCX-/PDF-Export mit Quellen- und Lizenz-Footer
- Provenienz-/Audit-Spur für jede generierte Aussage

## Betriebsmodi

| Modus  | Beschreibung                                                                                 | Geeignet für                                       |
| ------ | -------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Lokal  | Web-App, PostgreSQL, Qdrant, LLMs und Embeddings laufen auf eigener Maschine / im Schulnetz  | Datenschutz, Tests, Offline-Workflows (Default)    |
| Hybrid | Infrastruktur lokal oder auf eigenem Server, stärkere Modelle nur über freigegebene Provider | bessere Modellqualität bei dokumentierter Freigabe |
| Server | dauerhafter Betrieb auf eigenem Server, Zugriff über Tailscale, VPN oder Reverse Proxy       | mehrere eigene Geräte, längere Jobs                |

Cloud-LLM-Nutzung ist nur mit dokumentiertem `CloudReleaseGrant` (Rechtsgrundlage, AVV, DSFA, Provider/Region) zulässig — siehe [Sicherheit und Datenschutz](#sicherheit-und-datenschutz).

## Pipeline

Der LLM-Request-Fluss ist der Datenschutz-Kern und **fail-closed** ausgelegt:

1. **Intent / Scope** — Aufgabe, Fach, Konfession, Datenklassifizierung bestimmen
2. **Provider-Policy-Gate** — Default lokal; Cloud nur bei vorhandenem Grant
3. **Pseudonymisierung / Redaction** — Schülerdaten lokal reduzieren
4. **RAG-Kontext** — Pflichtfilter auf Fach, Konfession und Vertrauensstufe
5. **Guard-Assertion** — bricht ab, wenn PII durchrutscht (nicht umgehbar)
6. **Provider-Call** — lokaler oder freigegebener Cloud-Provider
7. **Re-Identifikation** — nur auf dem lokalen Pfad
8. **Provenienz-Logging** — Audit-Spur für jede Aussage
9. **Zitations- / Confidence-Markierung** — Quelle, Version, Abschnitt, Unsicherheit

## Architektur

Modularer Monolith (bewusst kein früher Microservice-Schnitt, ADR 0001):

```text
Next.js 16 App Router + React 19 + Tailwind v4
  └─ Routen: Dashboard, Planung, Arbeitsblätter, Korrektur, Quelle, Design-System

Application Layer (TypeScript, strict)
  ├─ Unterrichtsplanung, Arbeitsblätter, Korrekturassistenz
  ├─ Auth (Better Auth, single-tenant, ADR 0007)
  └─ Export (DOCX/PDF hinter exportArtifact, ADR 0008)

Persistenz & RAG
  ├─ PostgreSQL 16 + Drizzle ORM   Nutzer, Curriculum, Artefakte, Provenienz/Audit
  ├─ Qdrant                         eine Collection ua_lsa_chunks (Payload-Filter, ADR 0010)
  ├─ MinIO (S3-kompatibel)          Dokumente
  └─ Redis + BullMQ                 Ingestion-/OCR-/Extraktions-Jobs (geplant)

LLM-Provider-Abstraktion (ADR 0002)
  ├─ Ollama lokal              Default
  ├─ lokale OpenAI-kompatible  APIs
  └─ Cloud-Provider            nur hinter CloudReleaseGrant
```

Details: [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md), [`DATA_MODEL.md`](docs/architecture/DATA_MODEL.md), [`RAG_ARCHITECTURE.md`](docs/architecture/RAG_ARCHITECTURE.md), [`INTEGRATION_BOUNDARIES.md`](docs/architecture/INTEGRATION_BOUNDARIES.md).

## Bindende Grundsätze

Fünf nicht verhandelbare Prinzipien prägen jede Implementierungsentscheidung:

1. **Lehrplanbezug** — curriculare Aussagen stützen sich auf überprüfbare Quellen, nicht auf Modellwissen.
2. **Quellenpflicht** — jede fachliche/curriculare Aussage trägt Quelle, Version, Abschnitt/Seite und Abrufdatum.
3. **Local-first** — lokale/selbst gehostete Komponenten sind Standard; Cloud nur mit Freigabe und Rechtsgrundlage.
4. **Datensparsamkeit** — Schülerdaten werden pseudonymisiert und vor jeder externen Anfrage technisch reduziert.
5. **Menschliche Finalentscheidung** — das System liefert Vorschläge und Unsicherheiten, vergibt **keine** verbindlichen Noten.

## Quellen- und RAG-Governance

Der RAG-Bestand ist streng kuratiert. Jede Quelle trägt eine **Vertrauensstufe**, die über den produktiven Einsatz entscheidet:

| Stufe               | Beschreibung                           | Produktiver RAG-Einsatz |
| ------------------- | -------------------------------------- | ----------------------- |
| `OFFICIAL_BINDING`  | amtliche Lehrpläne / Rechtsquellen     | ja                      |
| `OFFICIAL_GUIDANCE` | LISA-/Ministeriums-Handreichungen      | ja, nach Prüfung        |
| `OPEN_CURATED`      | offen lizenziert, redaktionell geprüft | ja, nach Freigabe       |
| `USER_APPROVED`     | von Schule/Lehrkraft freigegeben       | ja, mandantenbezogen    |
| `UNVERIFIED`        | Recherchekandidat                      | **nein**                |

RAG-Chunks tragen verpflichtende Metadaten (u. a. `source_id`, `trust_level`, `subject`, `school_form`, `grade_range`, `version_or_date`, `license_or_terms`, `retrieved_at`, `content_hash`, `page_or_section`). Konfessionstrennung wird serverseitig per Retrieval-Filter erzwungen — **kein Cross-Strang-Retrieval**.

Details: [`docs/rag/SOURCE_REGISTRY.md`](docs/rag/SOURCE_REGISTRY.md), [`INGESTION_POLICY.md`](docs/rag/INGESTION_POLICY.md), [`CITATION_STANDARD.md`](docs/rag/CITATION_STANDARD.md), [`EVALUATION_PLAN.md`](docs/rag/EVALUATION_PLAN.md).

## Konfiguration

Konfiguration über `.env` (Vorlage: `.env.example`). Werte niemals committen.

| Variable             | Zweck                                                           |
| -------------------- | --------------------------------------------------------------- |
| `REPOSITORY_BACKEND` | `mock` (Default, synthetische Demodaten) oder `db` (PostgreSQL) |
| `DATABASE_URL`       | PostgreSQL-Verbindung für Drizzle                               |
| `QDRANT_URL`         | Qdrant-Endpunkt für die Vektorsuche                             |
| LLM-/Embedding-Vars  | Provider, Modell und Embedding-Dimension                        |

Wichtig: Embedding-Modell und Vektordimension müssen zusammenpassen — falsche Dimensionen führen zu unbrauchbaren Indizes. Die Ingestion- und Retrieval-Pfade müssen dieselbe Provider-/Modell-Konfiguration verwenden.

## LLM- und Embedding-Provider

Das System ist nicht auf einen einzelnen Provider festgelegt (ADR 0002):

- **Ollama lokal** — Default für Local-first-Betrieb
- **lokale OpenAI-kompatible APIs** — selbst gehostete Gateways
- **Cloud-Provider** (z. B. OpenAI) — ausschließlich hinter `CloudReleaseGrant`
- getrennte Provider für Chat-Modelle und Embeddings möglich

## Sicherheit und Datenschutz

Das System reduziert die Angriffsfläche bewusst und ist für den datenschutzsensiblen Schulkontext ausgelegt.

Harte Grenzen (fail-closed, nicht verhandelbar):

- Klarnamen von Schülerinnen und Schülern verlassen das System **nie**
- der PII-Guard im LLM-Request-Fluss wird nie umgangen oder abgeschwächt
- Cloud-LLM nur mit dokumentiertem `CloudReleaseGrant` (Rechtsgrundlage, AVV, DSFA)
- `UNVERIFIED`-Quellen werden produktiv nicht im RAG eingesetzt
- keine echten Schülerdaten, Tokens oder unklar lizenzierten Materialien im Repository

Datenklassifizierung steuert die Cloud-Zulässigkeit: `PUBLIC`/`INTERNAL` (nach Freigabe), `PERSONAL_TEACHER` (nur freigegeben), `SENSITIVE_STUDENT` (nur pseudonymisiert + dokumentierte Schulfreigabe).

Details: [`docs/security/SECURITY.md`](docs/security/SECURITY.md), [`THREAT_MODEL.md`](docs/security/THREAT_MODEL.md), [`DATA_PROTECTION.md`](docs/security/DATA_PROTECTION.md), [`RETENTION_AND_DELETION.md`](docs/security/RETENTION_AND_DELETION.md).

## Grenzen

Das System ist Entscheidungsunterstützung, kein Autopilot. Bewusst ausgeschlossen (MVP-Nicht-Ziele):

- automatische Endnoten oder verbindliche Bewertungsentscheidungen
- Schülerkonten oder -plattform
- unkontrollierte Websuche
- Auto-Übernahme unklar lizenzierter Quellen
- Upload echter Schülerarbeiten an externe KI
- Scraping geschützter Schulbücher oder Verlagsmaterialien

Dieses Repository macht **keine überprüfte Konformitätsbehauptung**; jede solche Aussage wird erst getroffen, wenn sie umgesetzt und überprüft ist.

## Entwicklungsstatus

**M0 (Fundament & Governance) abgeschlossen. M1 gemergt. M2 in Umsetzung.**

- **Real:** Next.js-UI-Shell (sechs Routen, statisch prerendered); PostgreSQL-Datenschicht via Drizzle (Curriculum mit Konfessions-CHECK, Artefakte, Provenienz/Audit); Better Auth (ADR 0007); DOCX/PDF-Export (ADR 0008); RAG-Gerüst mit Qdrant-Collection `ua_lsa_chunks` (ADR 0010); LLM-Provider-Abstraktion mit fail-closed PII-Gate; Retrieval/Reranking/Zitation; vertikaler Slice `/planung` + `/arbeitsblaetter`.
- **Noch nicht real:** OCR-/Extraktions-Worker für Scan-PDFs; vollständige Ingestion-Pipeline; Korrekturassistenz mit Pseudonymisierung/Redaction (`SENSITIVE_STUDENT` = M3); produktive Cloud-LLM-Freigaben.

Roadmap und Source of Truth: **[PLAN.md](PLAN.md)**. Architekturentscheidungen: **[docs/adr/](docs/adr/)** (0001–0010).

## Mitarbeiten

Dieses Projekt ist privat. Orientierungskarte für Coding Agents: **[AGENTS.md](AGENTS.md)**. Claude-Code-spezifische Vertiefungen: **[CLAUDE.md](CLAUDE.md)**. Beiträge halten den dokumentierten Stack ein; jede `.sql`-Migration ist reviewpflichtig (ADR 0005), Löschungen laufen nur über benannte Repository-Methoden.

Vor jedem Commit: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm build`, `pnpm test`.

### Verfügbare Scripts

```bash
pnpm dev             # Next.js Dev-Server (http://localhost:3000)
pnpm build           # Produktionsbuild
pnpm start           # Produktionsserver
pnpm lint            # ESLint (flat config)
pnpm typecheck       # tsc --noEmit (strict)
pnpm format          # Prettier (schreibend)
pnpm format:check    # Prettier (prüfend, für CI)
pnpm verify:docs     # Doku-Gate: prüft verlinkte Dateien auf Existenz
pnpm test            # Vitest + Testcontainers (benötigt Docker)
pnpm db:generate     # Drizzle-Kit: Migration aus Schema generieren
pnpm db:migrate      # Drizzle-Kit: Migrationen anwenden
pnpm db:check        # Drizzle-Kit: Schema-Drift prüfen (kein DB-Zugriff)
```

## Lizenz

Die Lizenzentscheidung ist noch nicht abgeschlossen. Siehe **[LICENSE-DECISION.md](LICENSE-DECISION.md)** für Stand und Optionen.
