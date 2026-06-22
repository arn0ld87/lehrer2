# AGENTS.md

Orientierungskarte für Coding Agents. Pointer zu Wissen, nicht das Wissen selbst.
Kanonische Quelle für Projektregeln; `CLAUDE.md` importiert diese Datei.

## What this project is

**Unterrichtsassistenz LSA** — datenschutzsensibler, quellengebundener KI-Assistent für Lehrkräfte an Gesamt-/Gemeinschaftsschulen in Sachsen-Anhalt. MVP-Fächer: Deutsch, Religion (ev./kath./konfessionssensibel), Ethik separat. Klassen 5–12.
Stack: Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, PostgreSQL 16 + Drizzle ORM, Better Auth, Vitest + Testcontainers, docx + pdfkit (Export). Geplant: Qdrant, MinIO, Redis + BullMQ, Ollama (local-first).

## Status — lesen vor jedem Eingriff

**M0 (Foundations & Governance) abgeschlossen; M1 Schritt 1 (UI-Shell) und Schritt 2 (Datenmodell + Export) umgesetzt (Branch `m1/data-model-export`).** Repo-Gerüst, Doku, lauffähige Next.js-UI-Shell und persistente Datenschicht stehen. Committet: `README.md`, `PLAN.md`, `CLAUDE.md`, `AGENTS.md`, ein weitgehend vollständiger `docs/`-Baum, `unterrichtsassistenz-lsa-design-kit/`, Tooling/CI (`package.json`, `compose.yaml`, `.env.example`, `.editorconfig`, `.nvmrc`, `.prettierrc.json`, `.prettierignore`), `scripts/` (`verify-docs.sh`, `verify-docs.mjs`, `check-schema-drift.mjs`), `data/source-registry.seed.yaml` und `.github/` (CI-Workflow, Issue-Templates, PR-Template).
`PLAN.md` ist Source of Truth für Scope und Roadmap (M0–M4) — zuerst lesen.

**M1 Schritt 1 — UI-Shell (Branch `m1/ui-shell`):** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, `lucide-react`. Sechs Routen (`/dashboard`, `/planung`, `/arbeitsblaetter`, `/korrektur`, `/quelle`, `/design-system`) sind navigierbar und werden statisch prerendered. **Nur UI-Struktur** — keine echten RAG-/LLM-/Korrektur-/Funktionen. Demodaten über Mock-Factories/Repository-Interfaces (`src/lib/mock/`), keine echten Schülerdaten/Tokens/Lehrpläne. Tokens zentral in `src/app/globals.css` (`@theme`), kanonisch abgeleitet aus `unterrichtsassistenz-lsa-design-kit/design-tokens.json` — **keine Inline-Hex-Werte** in Komponenten (Ausnahme: `design-system/page.tsx` Swatches dokumentieren das Token-System). Icons via zentralem `src/components/ui/icon.tsx`-Mapper auf `lucide-react`.

**M1 Schritt 2 — Datenmodell + Export (Branch `m1/data-model-export`):** Persistente Datenschicht unter `src/lib/db/` (Drizzle-Schema `schema/` mit `curriculum`, `artifacts`, `auth`, `tenant`, `provenance`; Postgres-Client `client.ts`; gemeinsame `enums.ts`/`columns.ts`; Repositories `repositories/` mit `factory.ts`, `mapping.ts`, `sources.pg.ts`, `deletion.ts`). Better Auth unter `src/lib/auth/` (single-tenant, ADR 0007). Export unter `src/lib/export/` (`exportArtifact`-Abstraktion, `docx-renderer.ts`, `pdf-renderer.ts`, Quellen-/Lizenz-Footer, ADR 0008). Konfessionstrennung wird per DB-CHECK am `curriculum_strand` erzwungen; Artefakte erben Konfession über `strand_id`. UI-Repository-Verträge (`src/lib/repositories.ts`) haben Postgres-Implementierungen hinter Factory `mock` ↔ `db` per `REPOSITORY_BACKEND`. Noch nicht real: RAG/Retrieval, LLM-Provider, Korrekturassistenz (`SENSITIVE_STUDENT` = M3), Cloud-LLM-Freigaben.

Lauffähig: `pnpm dev`, `pnpm build`, `pnpm start`, `pnpm lint`, `pnpm typecheck`, `pnpm format`, `pnpm format:check`, `pnpm verify:docs`, `pnpm test` (Vitest + Testcontainers, Docker nötig), `pnpm db:generate`/`db:migrate`/`db:check`. Beim Erweitern den dokumentierten Stack einhalten, nicht eigenmächtig ersetzen.

## Setup & Commands

Paketmanager ist **`pnpm`** (niemals npm/yarn). `pnpm dev`/Lint/Typecheck/Build ohne Docker; `pnpm test` und `pnpm db:migrate` benötigen Docker Compose (Postgres).

```bash
cp .env.example .env   # .env.example existiert; .env (Werte) niemals committen
pnpm install
docker compose up -d   # Postgres für db:migrate / test (Testcontainers)
pnpm dev               # Next.js Dev-Server

pnpm lint              # ESLint (flat config, eslint-config-next)
pnpm typecheck         # tsc --noEmit (strict)
pnpm format:check      # Prettier (md/yml/yaml/json)
pnpm build             # Produktionsbuild (statisches Prerender)
pnpm test              # Vitest + @testcontainers/postgresql (Docker nötig)

pnpm db:generate       # Drizzle-Kit: Migration aus Schema generieren
pnpm db:migrate        # Migrationen auf die DB anwenden
pnpm db:check          # Schema-Drift prüfen (kein DB-Zugriff nötig)
```

Repository-Backend per `REPOSITORY_BACKEND=mock|db` (Default `mock`). Vor jedem Commit: `git diff --check`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm build`, `pnpm test`. CI zusätzlich: Schema-Drift-Gate (`scripts/check-schema-drift.mjs`) und Migrations-Review-Flag für `DELETE`/`UPDATE` in `drizzle/*.sql`.

## Critical constraints (negative instructions — nicht verhandelbar)

- **NEVER** echten Schülernamen oder personenbezogene Testdaten committen — Klarnamen verlassen das System nie.
- **NEVER** API-Schlüssel, Tokens oder `.env`-Werte einchecken.
- **NEVER** unklar lizenzierte Materialien oder Schulbuchkopien/Verlagsmaterialien einchecken.
- **NEVER** den PII-Guard-Assertion im LLM-Request-Fluss umgehen oder abschwächen (fail-closed).
- **NEVER** Cloud-LLM ohne dokumentiertes `CloudReleaseGrant` (Rechtsgrundlage, AVV, DSFA) verwenden.
- **NEVER** verbindliche Noten vergeben oder Bewertungsvorschläge automatisch in finale Ergebnisse übernehmen — menschliche Finalentscheidung wahren.
- **NEVER** `UNVERIFIED`-Quellen produktiv im RAG einsetzen.
- **NEVER** Religion pauschal modellieren — ev./kath./konfessionssensibel trennen; Ethik als eigenes Fach. Konfessionstrennung ist DB-CHECK am `curriculum_strand` — kein Cross-Strang-Retrieval.
- **NEVER** Auth-Lösung oder Export-Stack ad hoc ändern — ADR 0007 (Better Auth) / 0008 (docx + pdfkit) sind Akzeptiert (2026-06-22) und umgesetzt; Abweichungen nur per Maintainer-Review/ADR.
- **NEVER** Schema-Migrationen mit `DELETE`/`UPDATE` ohne Review committen — Löschungen nur über benannte Repository-Methoden (`src/lib/db/repositories/deletion.ts`); CI flaggt `DELETE`/`UPDATE` in `drizzle/*.sql` (ADR 0005).
- **NEVER** einem PLAN/Dok-Link vertrauen, ohne Existenz zu prüfen (Teil der Links ist Soll-Struktur).
- Sicherheitsrelevante Änderungen als `type: security` Issue führen und nachvollziehbar dokumentieren.

## Bindende Grundsätze

1. **Lehrplanbezug** — curriculare Aussagen stützen sich auf überprüfbare Quellen, nicht auf Modellwissen.
2. **Quellenpflicht** — jede fachliche/curriculare Aussage trägt Quelle, Version, Abschnitt/Seite, Abrufdatum.
3. **Local-first** — Ollama / lokale OpenAI-kompatible APIs sind Default. Cloud nur mit Freigabe + Rechtsgrundlage.
4. **Datensparsamkeit** — Schülerdaten pseudonymisieren + vor externen KI-Anfragen redacten.
5. **Menschliche Finalentscheidung** — System liefert Vorschläge/Begründungen/Unsicherheiten, vergibt keine Noten.

## What to read before modifying (Pointer)

| Bereich                                                                                                                                | Zuerst lesen                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Scope, Roadmap, Datenflüsse                                                                                                            | `PLAN.md`                                                                                                |
| Architektur, Integrationsgrenzen                                                                                                       | `docs/architecture/ARCHITECTURE.md`, `INTEGRATION_BOUNDARIES.md`, `DATA_MODEL.md`, `RAG_ARCHITECTURE.md` |
| Entscheidungen (Modular Monolith, LLM-Schicht, Source-Governance, Local-first, Drizzle, Curriculum, Auth, Export, Pseudonym-Retention) | `docs/adr/0001`–`0009` (0005/0007/0008 Akzeptiert 2026-06-22)                                            |
| Offene Entscheidungen                                                                                                                  | `docs/decisions/OPEN_QUESTIONS.md`                                                                       |
| Datenschutz, Drohmodell, Löschung                                                                                                      | `docs/security/SECURITY.md`, `THREAT_MODEL.md`, `DATA_PROTECTION.md`, `RETENTION_AND_DELETION.md`        |
| RAG-Ingestion, Evaluierung                                                                                                             | `docs/rag/INGESTION_POLICY.md`, `EVALUATION_PLAN.md`, `CITATION_STANDARD.md`, `SOURCE_REGISTRY.md`       |
| Produktvision, MVP, Akzeptanz, User Flows                                                                                              | `docs/product/PRODUCT_VISION.md`, `MVP_SCOPE.md`, `ACCEPTANCE_CRITERIA.md`, `USER_FLOWS.md`              |
| CI/CD, Entwicklung, Backup                                                                                                             | `docs/operations/CI_CD.md`, `DEVELOPMENT.md`, `BACKUP_AND_RECOVERY.md`, `GITHUB_SETUP.md`                |
| M1-Schritt-2-Implementierungsplan                                                                                                      | `docs/superpowers/plans/2026-06-22-m1-step2-data-model-export.md`                                        |
| Erste UI-Implementierung in Next.js                                                                                                    | `unterrichtsassistenz-lsa-design-kit/handoff/CLAUDE_CODE_HANDOFF.md` (verbindlich)                       |
| Design-Tokens                                                                                                                          | `unterrichtsassistenz-lsa-design-kit/design-tokens.json` (keine verstreuten Hex-Werte)                   |
| Design-System (Doku)                                                                                                                   | `docs/design/DESIGN_SYSTEM.md`                                                                           |

## Project structure

- `src/app/` — Next.js App Router: Root-Layout (`layout.tsx`), `globals.css` (zentrale `@theme`-Tokens), eine Route pro Handoff-Screen (`dashboard`, `planung`, `arbeitsblaetter`, `korrektur`, `quelle`, `design-system`) je mit `page.tsx`; `/` leitet auf `/dashboard` weiter
- `src/components/` — `app-shell/` (Sidebar, Header, Context-Switcher), `ui/` (Primitive: button, card, badge, status-chip, empty-state, icon, shared), bereichsspezifische Komponenten je Route (`dashboard/`, `planner/`, `worksheet/`, `correction/`, `sources/`)
- `src/lib/` — `types.ts` (Domain-Typen), `repositories.ts` (UI-Verträge), `mock/` (synthetische Demodaten), `db/` (Drizzle-Schema `schema/`, Postgres-Repositories `repositories/` mit `factory.ts`/`mapping.ts`/`sources.pg.ts`/`deletion.ts`, `client.ts`, `enums.ts`, `columns.ts`; Tests in `__tests__/` via Testcontainers), `auth/` (Better Auth, ADR 0007), `export/` (docx/pdf-Renderer hinter `exportArtifact`, ADR 0008)
- `public/` — statische Assets (`logo.svg`)
- `docs/` — Architektur, Produkt, RAG, Security, Operations, Design, ADRs, Open Questions, `superpowers/plans/` (nahezu vollständig)
- `unterrichtsassistenz-lsa-design-kit/` — statische HTML-Mockups, Tokens, Handoff-Anweisung (Referenz, nicht Produktcode)
- `scripts/` — `verify-docs.sh`/`verify-docs.mjs` (Doku-Gate), `check-schema-drift.mjs` (Schema-Drift-Gate für CI)
- `drizzle/` — Drizzle-Kit SQL-Migrationen + `meta/`-Snapshots (`drizzle.config.ts` → Schema `src/lib/db/schema/index.ts`)
- `data/` — `source-registry.seed.yaml` (Seed für das Quellenregister; keine echten Schülerdaten)
- `.github/` — `workflows/ci.yml` (Doku-Gate, Format, Build/Test + Schema-Drift + Migrations-Review), `ISSUE_TEMPLATE/` (bug, feature, research, security, config), `pull_request_template.md`
- `LICENSE-DECISION.md` — Lizenzentscheidung (Status siehe Datei)

## UI-Implementierung (aus dem Handoff)

- Nur UI-Struktur, keine echten RAG-/Korrektur-/Lehrplan-/LLM-Funktionen.
- Routen: `/dashboard`, `/planung`, `/arbeitsblaetter`, `/korrektur`, `/quelle`, `/design-system`.
- Icons via `lucide-react` (keine Inline-SVG-Duplikate); Tokens zentral aus `design-tokens.json`.
- Desktop-Sidebar 260px, Seitenfläche `#F7F7FB`, Primärfarbe `#5D3DF5`, Kartenradius 22px, max. eine primäre Aktion pro Seitenkopf.
- Demodaten als Mock-Factories/Repository-Interfaces — keine echten Schülerdaten/Tokens/Lehrplandokumente.
- Quellen- und Unsicherheitszustände nie verdecken.

## Notes

- Alle in `PLAN.md`/`README.md` verlinkten Dokumente existieren inzwischen (zuletzt ergänzt: `docs/operations/GITHUB_SETUP.md`). Bei neuen Links dennoch vor Referenzierung auf Existenz prüfen.
- `package.json` definiert `dev`, `build`, `start`, `lint`, `typecheck`, `format`, `format:check`, `verify:docs`, `test` (Vitest + Testcontainers), `test:watch`, `db:generate`, `db:migrate`, `db:check`.
- Paketmanager ist **`pnpm`**: `pnpm-lock.yaml` ist vorhanden und in `package.json` via `packageManager`-Feld (`pnpm@10.28.2`) + `engines.pnpm` gepinnt. `package-lock.json` wurde entfernt — kein npm/yarn verwenden.
- **Token-Disziplin:** Farben/Radien/Schatten ausschließlich über `src/app/globals.css` (`@theme`) bzw. `:root`-Gradient-Variablen. Keine Inline-Hex-Literale in `src/components/**` oder `src/app/**` (Ausnahme: `design-system/page.tsx` Swatches). Neue Werte dort zentral pflegen und mit `design-tokens.json` abstimmen.
- **Mock-Layer:** `src/lib/mock/` enthält ausschließlich synthetische Demodaten. Das angezeigte Nutzerprofil (Jana Zwarg) ist die echte Zielnutzerin; alle fachlichen Inhalte (KPIs, Listen, Quellenregister, Korrekturbeispiel) sind Mock und beim Übergang auf echte Repositories zu ersetzen — die Komponenten greifen über `repositories.ts`-Interfaces zu, nicht direkt auf Factories. Mit `REPOSITORY_BACKEND=db` nutzen sie die Postgres-Implementierungen (`src/lib/db/repositories/factory.ts`).
- **Migrations-Reviewpflicht (ADR 0005):** jede `.sql`-Datei in `drizzle/` im PR reviewen; `DELETE`/`UPDATE` werden von CI markiert. Löschungen nur über benannte Methoden in `src/lib/db/repositories/deletion.ts`.
