# AGENTS.md

Orientierungskarte für Coding Agents. Pointer zu Wissen, nicht das Wissen selbst.
Kanonische Quelle für Projektregeln; `CLAUDE.md` importiert diese Datei.

## What this project is

**Unterrichtsassistenz LSA** — datenschutzsensibler, quellengebundener KI-Assistent für Lehrkräfte an Gesamt-/Gemeinschaftsschulen in Sachsen-Anhalt. MVP-Fächer: Deutsch, Religion (ev./kath./konfessionssensibel), Ethik separat. Klassen 5–12.
Stack (geplant): Next.js App Router, TypeScript strict, Tailwind, PostgreSQL + Drizzle ORM, Qdrant, MinIO, Redis + BullMQ, Ollama (local-first).

## Status — lesen vor jedem Eingriff

**Planungs-/Architekturphase. Kein Produktivcode, keine lauffähige App** — aber Repo-Gerüst und Doku stehen. Committet: `README.md`, `PLAN.md`, `CLAUDE.md`, `AGENTS.md`, ein weitgehend vollständiger `docs/`-Baum, `unterrichtsassistenz-lsa-design-kit/`, Tooling/CI (`package.json`, `compose.yaml`, `.env.example`, `.editorconfig`, `.nvmrc`, `.prettierrc.json`, `.prettierignore`), `scripts/` (`verify-docs.sh`, `verify-docs.mjs`), `data/source-registry.seed.yaml` und `.github/` (CI-Workflow, Issue-Templates, PR-Template).
`PLAN.md` ist Source of Truth für Scope und Roadmap (M0–M4) — zuerst lesen.
Lauffähig sind bislang nur `pnpm format`, `pnpm format:check` und `pnpm verify:docs`; `pnpm lint`/`typecheck`/`test` sind **Sollzustand** (noch kein Anwendungscode). Beim Anlegen der ersten Implementierung den in README/PLAN dokumentierten Stack einhalten, nicht eigenmächtig ersetzen.

## Setup & Commands (Sollzustand)

Paketmanager ist **`pnpm`** (niemals npm/yarn). Lokale Umgebung über Docker Compose.

```bash
cp .env.example .env   # .env.example existiert; .env (Werte) niemals committen
pnpm install
docker compose up -d

pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
```

Vor jedem Commit: `git diff --check`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`.

## Critical constraints (negative instructions — nicht verhandelbar)

- **NEVER** echten Schülernamen oder personenbezogene Testdaten committen — Klarnamen verlassen das System nie.
- **NEVER** API-Schlüssel, Tokens oder `.env`-Werte einchecken.
- **NEVER** unklar lizenzierte Materialien oder Schulbuchkopien/Verlagsmaterialien einchecken.
- **NEVER** den PII-Guard-Assertion im LLM-Request-Fluss umgehen oder abschwächen (fail-closed).
- **NEVER** Cloud-LLM ohne dokumentiertes `CloudReleaseGrant` (Rechtsgrundlage, AVV, DSFA) verwenden.
- **NEVER** verbindliche Noten vergeben oder Bewertungsvorschläge automatisch in finale Ergebnisse übernehmen — menschliche Finalentscheidung wahren.
- **NEVER** `UNVERIFIED`-Quellen produktiv im RAG einsetzen.
- **NEVER** Religion pauschal modellieren — ev./kath./konfessionssensibel trennen; Ethik als eigenes Fach.
- **NEVER** Auth-Lösung oder Export-Stack ad hoc festlegen — beides offen, per ADR in `docs/adr/` entscheiden.
- **NEVER** einem PLAN/Dok-Link vertrauen, ohne Existenz zu prüfen (Teil der Links ist Soll-Struktur).
- Sicherheitsrelevante Änderungen als `type: security` Issue führen und nachvollziehbar dokumentieren.

## Bindende Grundsätze

1. **Lehrplanbezug** — curriculare Aussagen stützen sich auf überprüfbare Quellen, nicht auf Modellwissen.
2. **Quellenpflicht** — jede fachliche/curriculare Aussage trägt Quelle, Version, Abschnitt/Seite, Abrufdatum.
3. **Local-first** — Ollama / lokale OpenAI-kompatible APIs sind Default. Cloud nur mit Freigabe + Rechtsgrundlage.
4. **Datensparsamkeit** — Schülerdaten pseudonymisieren + vor externen KI-Anfragen redacten.
5. **Menschliche Finalentscheidung** — System liefert Vorschläge/Begründungen/Unsicherheiten, vergibt keine Noten.

## What to read before modifying (Pointer)

| Bereich                                                                                 | Zuerst lesen                                                                                             |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Scope, Roadmap, Datenflüsse                                                             | `PLAN.md`                                                                                                |
| Architektur, Integrationsgrenzen                                                        | `docs/architecture/ARCHITECTURE.md`, `INTEGRATION_BOUNDARIES.md`, `DATA_MODEL.md`, `RAG_ARCHITECTURE.md` |
| Entscheidungen (Modular Monolith, LLM-Schicht, Source-Governance, Local-first, Drizzle) | `docs/adr/0001`–`0005`                                                                                   |
| Offene Entscheidungen                                                                   | `docs/decisions/OPEN_QUESTIONS.md`                                                                       |
| Datenschutz, Drohmodell, Löschung                                                       | `docs/security/SECURITY.md`, `THREAT_MODEL.md`, `DATA_PROTECTION.md`, `RETENTION_AND_DELETION.md`        |
| RAG-Ingestion, Evaluierung                                                              | `docs/rag/INGESTION_POLICY.md`, `EVALUATION_PLAN.md`, `CITATION_STANDARD.md`, `SOURCE_REGISTRY.md`       |
| Produktvision, MVP, Akzeptanz, User Flows                                               | `docs/product/PRODUCT_VISION.md`, `MVP_SCOPE.md`, `ACCEPTANCE_CRITERIA.md`, `USER_FLOWS.md`              |
| CI/CD, Entwicklung, Backup                                                              | `docs/operations/CI_CD.md`, `DEVELOPMENT.md`, `BACKUP_AND_RECOVERY.md`                                   |
| Erste UI-Implementierung in Next.js                                                     | `unterrichtsassistenz-lsa-design-kit/handoff/CLAUDE_CODE_HANDOFF.md` (verbindlich)                       |
| Design-Tokens                                                                           | `unterrichtsassistenz-lsa-design-kit/design-tokens.json` (keine verstreuten Hex-Werte)                   |
| Design-System (Doku)                                                                    | `docs/design/DESIGN_SYSTEM.md`                                                                           |

## Project structure

- `docs/` — Architektur, Produkt, RAG, Security, Operations, Design, ADRs, Open Questions (nahezu vollständig)
- `unterrichtsassistenz-lsa-design-kit/` — statische HTML-Mockups, Tokens, Handoff-Anweisung
- `scripts/` — `verify-docs.sh`/`verify-docs.mjs` (Doku-Gate)
- `data/` — `source-registry.seed.yaml` (Seed für das Quellenregister; keine echten Schülerdaten)
- `.github/` — `workflows/ci.yml`, `ISSUE_TEMPLATE/` (bug, feature, research, security, config), `pull_request_template.md`
- `LICENSE-DECISION.md` — Lizenzentscheidung (Status siehe Datei)

## UI-Implementierung (aus dem Handoff)

- Nur UI-Struktur, keine echten RAG-/Korrektur-/Lehrplan-/LLM-Funktionen.
- Routen: `/dashboard`, `/planung`, `/arbeitsblaetter`, `/korrektur`, `/quelle`, `/design-system`.
- Icons via `lucide-react` (keine Inline-SVG-Duplikate); Tokens zentral aus `design-tokens.json`.
- Desktop-Sidebar 260px, Seitenfläche `#F7F7FB`, Primärfarbe `#5D3DF5`, Kartenradius 22px, max. eine primäre Aktion pro Seitenkopf.
- Demodaten als Mock-Factories/Repository-Interfaces — keine echten Schülerdaten/Tokens/Lehrplandokumente.
- Quellen- und Unsicherheitszustände nie verdecken.

## Notes

- `docs/operations/GITHUB_SETUP.md` ist in `PLAN.md`/`README.md` verlinkt, existiert aber **noch nicht** — vor Referenzierung prüfen. Alle übrigen früher fehlenden Dokumente (DATA_MODEL, RAG_ARCHITECTURE, CITATION_STANDARD, SOURCE_REGISTRY) existieren inzwischen.
- `.env.example`, `package.json`, `scripts/verify-docs.sh` existieren inzwischen; `package.json` definiert bislang nur `format`, `format:check`, `verify:docs`.
