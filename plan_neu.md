# Plan: Komplette funktionierende App — Vertical Slice /planung + /arbeitsblaetter

## Context

Das Projekt **Unterrichtsassistenz LSA** hat eine überraschend reife Datenschicht:
Drizzle-Schema, fail-closed Quellen-Lifecycle, eine **vollständige, getestete RAG-Pipeline**
(Ingestion → Chunking → Embedding → Qdrant-Upsert; Retrieval mit Pflicht-Trust-/Konfessionsfiltern,
MMR-Reranking und strikter Zitations-Assemblierung) sowie ein fertiges Export-Modul (docx/pdf).
**Was fehlt, ist die „letzte Meile" zu einer wirklich benutzbaren App:** Es gibt keine
LLM-**Generierung** (nur Embeddings), keine Anbindung der UI-Seiten an echte Daten
(nur `/quelle` liest die DB; alle anderen Seiten zeigen Mock-Daten), keinen Login, keine
Server Actions und noch keine real ingestierten Lehrpläne.

Ziel (vom Nutzer entschieden): ein **durchgängig lauffähiger vertikaler Durchstich** für
**Unterrichtsplanung** und **Arbeitsblätter** — echtes Login, UI an echte Repositories/Server Actions,
echtes RAG-Retrieval mit Zitaten, **LLM-Generierung** (lokal Ollama default + Cloud hinter
fail-closed `CloudReleaseGrant`-Gate), GROUNDED/UNSUPPORTED_DRAFT-Kennzeichnung, **reale amtliche
LSA-Lehrpläne** als `OFFICIAL_BINDING` ingestiert, und Export nach DOCX/PDF.
**M3 /korrektur ist bewusst NICHT Teil dieses Durchstichs** (Folgeschritt).

Bindende Grundsätze bleiben unverhandelbar: Quellenpflicht, Local-first-Default, Datensparsamkeit
(PII-Redaction vor jedem externen Call), menschliche Finalentscheidung, fail-closed PII-Guard,
UNVERIFIED nie produktiv. Spezifikationen existieren bereits:
`docs/security/REDACTION_AND_GUARD_SPEC.md`, `docs/product/PLANNING_ASSISTANT_SPEC.md`,
`docs/product/WORKSHEET_GENERATOR_SPEC.md`, `docs/product/ACCEPTANCE_CRITERIA.md`,
`docs/architecture/INTEGRATION_BOUNDARIES.md` §1.

## Invarianten, an die sich jede Phase halten muss

- `retrieve(deps:{embedder,store,sourceRefReader}, query, opts?:{subject,confession,minTrust,k})`
  in `src/lib/rag/retrieve.ts` — UNVERIFIED IMMER ausgeschlossen, Konfessionsfilter bei
  Religion/Ethik serverseitig PFLICHT, kein Treffer ohne vollständige Zitation. **Nicht ändern.**
- `RankedCitation.confidence` ist bereits `GROUNDED|UNSUPPORTED_DRAFT` (`deriveConfidence`,
  `src/lib/rag/citation.ts`). Die LLM-Schicht erbt dieses Schema pro Statement.
- Subject-/Konfessions-Mapping nur über `src/lib/db/repositories/mapping.ts`.
- Quellen-Lifecycle fail-closed (`src/lib/db/repositories/sources.pg.ts`):
  create→register→approve→ingest. `ingestSource()` (`src/lib/rag/ingest.ts`) setzt `INGESTED`
  selbst atomar — **danach NICHT zusätzlich `ingestMark()` aufrufen** (würde werfen).
- `REPOSITORY_BACKEND=mock` muss durchgehend lauffähig bleiben (Default; Shell ohne DB).
- Migrationen review-pflichtig (ADR 0005); `pnpm db:check` (Drift-Gate) grün halten, keine
  Handedits an `drizzle/meta`. Löschungen nur über `src/lib/db/repositories/deletion.ts`.
- `audit_log`/`generation_provenance` enthalten NIE Schülernamen.

---

## Phase 0 — Baseline
`pnpm install`; Dienste prüfen (`docker compose`: Postgres/Qdrant/Ollama/MinIO/Redis).
Baseline-Gates grün ziehen: `pnpm typecheck && pnpm lint && pnpm test && pnpm db:check`,
damit spätere Regressionen eindeutig zuordenbar sind.

## Phase 1 — LLM-Provider-Abstraktion (neu, isoliert)
Neues Modul `src/lib/llm/`, Vertrag aus `INTEGRATION_BOUNDARIES.md` §1:
- `provider.ts` — `LLMProvider { call; callStructured<T>; estimateTokens }` + `CallContext`;
  `JSONSchema` minimal als `Record<string,unknown>` (keine neue Dependency).
- `ollama-chat.ts` — `OllamaChatProvider`, POST `${OLLAMA_BASE_URL}/api/chat`
  (`stream:false`, `format` für structured), **Fetch-Stil exakt wie `OllamaEmbedder`**
  in `src/lib/infra/ollama.ts` (kein SDK). Neue Env `OLLAMA_CHAT_MODEL` (z.B. `qwen2.5:14b`).
- `cloud.ts` — `CloudProvider`: OpenAI-kompatibel real (`/v1/chat/completions`, Bearer-Key,
  `response_format` json_schema); Anthropic dokumentiert/feature-geflaggt (`@anthropic-ai/sdk`,
  Modell-ID `claude-opus-4-8`). Keine Secrets ins Repo, nur Env lesen.
- `fake.ts` — deterministischer `FakeLLMProvider` (analog `FakeEmbedder`).
- `index.ts` — `createLLMProvider()` spiegelt `createEmbedder`-Muster aus `src/lib/infra/index.ts`.
  **Wichtig:** Cloud wird NIE direkt zurückgegeben, sondern in Phase 2 vom Gate umhüllt.

Risiko: Ollama-JSON-Mode für structured Output unzuverlässig → fail-closed parsen; bei
Parse-Fehler Statement als `UNSUPPORTED_DRAFT` behandeln, nie erfinden.

## Phase 2 — PII-Gate + CloudReleaseGrant (fail-closed)
Referenz: `docs/security/REDACTION_AND_GUARD_SPEC.md` (existiert; Regex-Kategorien + `guardAssertion`).
- `src/lib/llm/redaction.ts` — classify+redact → `{redactedText, redactionApplied}`.
- `src/lib/llm/guard.ts` — `guardAssertion(text): boolean` nach Spec; Fail = Abbruch.
- `src/lib/llm/gate.ts` — `withGate(provider, {grantReader})`: vor JEDEM Call
  classify→redact→approval-check (lokal=ok+audit; **cloud=aktiver Grant PFLICHT**)→`guardAssertion`
  (PII-Treffer ⇒ `GateBlockedError` + `audit_log` severity=critical)→provider.call.
  Bei `CLOUD_LLM_ENABLED=false` ODER kein gültiger Grant ⇒ Cloud hart blocken.
- Neu `src/lib/db/schema/grants.ts` — Tabelle `cloud_release_grant` (id, schoolId FK, provider,
  scopeSubjects[], scopeGradeBands[], legalBasis, validFrom/Until, issuer*, createdAt);
  in `schema/index.ts` exportieren. Repo `src/lib/db/repositories/grants.pg.ts`:
  `getActiveGrant(schoolId, provider, subject, gradeBand)` mit Zeit-/Zweckbindung.
- Migration via `pnpm db:generate` (ADR-0005-Review, `db:check` danach grün). Commit erst auf Userwunsch.

## Phase 3 — Generierungs-Services
Neu `src/lib/generation/{planning.ts,worksheet.ts,prompt.ts,grounding.ts}` und
`src/lib/rag/source-ref-reader.pg.ts` (`PgSourceRefReader.getById` → `SourceRefMeta`; existiert noch nicht).
1. Retrieval: `retrieve({embedder:createEmbedder(), store:createVectorStore(), sourceRefReader:new PgSourceRefReader()}, query, {subject, minTrust:"OFFICIAL_GUIDANCE", k})`
   (minTrust erfüllt AC „nur OFFICIAL_BINDING+OFFICIAL_GUIDANCE").
2. `prompt.ts`: groundeter Prompt mit Systemanweisung Quellenpflicht + nummerierten Zitaten.
   Bei 0 Citations: Fail-Safe-Hinweis (kein erfundener Lehrplan-Code).
3. `provider.callStructured` mit Schema `{statements:[{text, citationRefs:int[]}], …}`.
4. `grounding.ts`: Statement = GROUNDED nur wenn `citationRefs` nicht-leer **und** referenzierte
   `Citation.confidence==="GROUNDED"`; sonst UNSUPPORTED_DRAFT.
5. Persistenz in DB-Transaktion: Planung → `teachingUnit`(strandId, s. R-strand)+`lesson`(phasePlan jsonb);
   Arbeitsblatt → `worksheet`+`task`(Basis/Erweiterung/Förder als difficulty)+`worksheetSourceRef`/`taskSourceRef`+optional `expectationHorizon`.
   Immer `generation_provenance` (provider/model/promptHash/redactionApplied/sourceRefs/confidenceState)
   + `audit_log` (eventType, actorId, subject — keine Schülernamen).
6. Religion: Konfessions-Scope Pflicht; „übergreifend" ⇒ aktive Warnung im Rückgabeobjekt (für UI).
   Ethik nie mit Religion gemischt (durch `uiConfessionToDbContexts` garantiert).

**Risiko R-strand:** `teachingUnit.strandId` ist NOT NULL (FK restrict). Generierung braucht einen
existierenden `curriculumStrand` (Phase 6 seedet ihn). Fehlt er → fail-closed blocken, **kein** Dummy-Strang.
**Risiko R-offline:** `retrieve()`/embedder können werfen → im Service abfangen,
Meldung „Quellenbibliothek momentan nicht verfügbar", kein Crash.

## Phase 4 — Server Actions + Pg-Repositories + UI-Wiring
- Neu `src/lib/db/repositories/{planning.pg.ts,worksheet.pg.ts}`; neue async
  `PlanningWriteRepository`/`WorksheetWriteRepository` (bestehende sync-Mock-Methoden für die Shell
  unangetastet lassen). Factory-Toggle analog `src/lib/db/repositories/factory.ts`.
- Server Actions `src/app/planung/actions.ts`, `src/app/arbeitsblaetter/actions.ts` (`"use server"`):
  Session via `auth.api.getSession({headers})` + `getCurrentTeacher(userId)` (`src/lib/auth/index.ts`),
  Input validieren (Religion ⇒ Konfessions-Scope Pflicht), Service aufrufen, Ergebnis (Citations +
  GROUNDED/UNSUPPORTED_DRAFT + cross-denomination-Warnung) zurückgeben, `revalidatePath`.
- Pages verdrahten: `planning-form.tsx` an `<form action={...}>` binden (Inputs mit `name`),
  `StructureProposal`/`CurriculumFitCard` aus Action-Ergebnis statt Mock; `builder-panel.tsx`
  (bereits client) an Worksheet-Action binden, `WorksheetPreview` aus Ergebnis, Konfessions-Scope-Select.
- Export-Button: `ExportableWorksheet` aus worksheet+tasks+citations bauen (`sources` aus
  `RankedCitation→SourceCitation`), `exportArtifact(ws,"docx"|"pdf")` (`src/lib/export/`), Bytes als Download.

## Phase 5 — Auth-UI + Session-Gating
- Better-Auth Next-Handler `src/app/api/auth/[...all]/route.ts` (`toNextJsHandler(auth)`).
- `src/app/login/page.tsx` (+ client form via `createAuthClient`), Logout-Action.
- Gating geschützter Routen (`/planung`,`/arbeitsblaetter`,`/quelle`,`/dashboard`) ohne Session → `/login`
  (Layout-Guard via `auth.api.getSession` oder `src/middleware.ts`).
- Hardcoded Jana-Zwarg-Mock-User in `app-sidebar.tsx`/`context-switcher.tsx` durch echten Session-User
  + `getCurrentTeacher` ersetzen. Seed-Skript `scripts/seed-user.ts` (echter `user`+`school`+`teacherProfile`,
  Passwort-Hashing über Better-Auth-API).

## Phase 6 — Reale LSA-Lehrpläne als OFFICIAL_BINDING ingestieren
Referenz: ADR 0003, `scripts/seed-sources.ts`, `data/source-registry.seed.yaml`.
1. **Human-Governance-Schritt (nicht voll automatisierbar):** offizielle LSA-Lehrpläne
   (Bildungsserver Sachsen-Anhalt / LISA) für Deutsch + Religion ev./kath. + Ethik, Klassen 5–10 (SEK_I)
   identifizieren; URL, Herausgeber, Version/Datum, **Lizenz/Nutzungsrecht** dokumentieren.
   Netz-Caveat: ausgehendes HTTPS nur über den Agent-Proxy (CA-Bundle `/root/.ccr/ca-bundle.crt`);
   `fetch(source.uri)` im Ingest läuft darüber.
2. Quellen in `data/source-registry.seed.yaml`; `scripts/seed-sources.ts` legt sie als DISCOVERED an.
   **BLOCKER beheben:** Seed-Skript mappt RELIGION_EV/RELIGION_KA aktuell auf `subject=null`/`confessionContext=null`.
   Real: `subjectAlignment=RELIGION` + korrektes `confessionContext` (EVANGELISCH/KATHOLISCH) setzen,
   sonst greift der Konfessionsfilter nicht und der `source_ref`-Check-Constraint kann werfen.
3. **Lifecycle automatisierbar:** pro Quelle `register({licenseInfo,licenseVerified:true})` →
   `approve({approvalMetadata})` → `ingestSource(deps,id)` (setzt INGESTED selbst; **kein** `ingestMark()`).
   `licenseVerified:true` ist eine menschliche Governance-Entscheidung (im Runbook dokumentieren).
4. Neu `scripts/seed-strands.ts`: je Fach/Konfession/SEK_I ein `curriculumStrand` (status ACTIVE) — erfüllt R-strand;
   optional Nodes pro gradeBand.
5. Neu `scripts/ingest-curriculum.ts` (Runbook im Header: automatisierbar vs. menschlicher Schritt).
   R-scan: Scan-PDFs → OCR-Engine injizieren (`deps.ocr`, `src/lib/rag/ocr/`), sonst `ExtractionFailedError`.
   R-lizenz: unklare Lizenz ⇒ Quelle bleibt REGISTERED, NIE approven (fail-closed).

## Phase 7 — Tests + Gates (Vitest/Testcontainers)
- `src/lib/llm/__tests__/provider.test.ts` — Fake deterministisch; Ollama gegen gemockten fetch.
- `src/lib/llm/__tests__/gate.test.ts` — **fail-closed:** PII→`GateBlockedError`+audit; Cloud ohne Grant→block;
  lokal/PUBLIC→pass + `redactionApplied=false`.
- `src/lib/generation/__tests__/grounding.test.ts` — GROUNDED vs UNSUPPORTED_DRAFT; 0 Citations→Fail-Safe.
- `…/planning.test.ts` + `worksheet.test.ts` — Happy-Path mit Fakes → persistierte Artefakte+provenance+audit;
  Religion ohne Konfessions-Scope → blockt.
- Server-Action Happy-Path (Testcontainers-PG); `REPOSITORY_BACKEND=mock` bleibt grün.
- Gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm format:check && pnpm db:check && pnpm build`.

## Phase 8 — End-to-End-Verifikation (manuell)
1. `docker compose up -d`; `ollama pull` Chat- + Embedding-Modell.
2. `pnpm db:migrate` (inkl. neuer grant-Migration); `pnpm db:seed` + `scripts/seed-strands.ts` + `scripts/seed-user.ts`.
3. `scripts/ingest-curriculum.ts` für ≥1 OFFICIAL_BINDING Deutsch-Quelle; Qdrant-Punkte + `rag_chunk` +
   `lifecycleStatus=INGESTED` prüfen.
4. `pnpm dev` → Login als Jana → `/planung`: Fach/Klasse/Thema → Struktur generieren → Lesson mit
   sichtbaren Zitaten + UNSUPPORTED_DRAFT-Markierung; Export DOCX.
5. `/arbeitsblaetter`: Religion ev. → Konfessions-Scope Pflicht greift; Basis/Erweiterung/Förder generieren;
   Quellen-Footer; Export DOCX+PDF.
6. Negativpfade: Cloud aktivieren ohne Grant → Block-Meldung; RAG-Dienst stoppen → freundliche Meldung statt Crash.

---

## Sequenzierung
1 → 2 (Gate umhüllt Provider) → 3 → 4. Phase 5 (Auth) blockt produktive Action-Nutzung, kann nach 4
erfolgen (für Tests Session mocken). Phase 6 (Strang-Seed + Ingestion) ist Voraussetzung für reale
Generierung (R-strand) und E2E, kann aber parallel zu 1–5 vorbereitet werden; Phase-7-Tests laufen mit Fakes.

## Kritische Dateien
- `src/lib/rag/retrieve.ts`, `src/lib/rag/citation.ts`, `src/lib/rag/ingest.ts`
- `src/lib/db/repositories/sources.pg.ts`, `factory.ts`, `mapping.ts`
- `src/lib/db/schema/artifacts.ts`, `provenance.ts`, `index.ts`
- `src/lib/infra/index.ts`, `src/lib/infra/ollama.ts`
- `src/lib/auth/auth.ts`, `src/lib/auth/index.ts`, `src/lib/export/`
- `src/components/planner/planning-form.tsx`, `src/components/worksheet/builder-panel.tsx`

## Offene Governance-Punkte für den Nutzer (vor/ während Phase 6)
- Auswahl der konkreten amtlichen Lehrplan-Quellen + Lizenz-/Nutzungsrechtsfreigabe (`licenseVerified`)
  ist eine menschliche Entscheidung — der Plan automatisiert nur register→approve→ingest danach.
- Cloud-LLM bleibt im Slice standardmäßig AUS; `CloudReleaseGrant` wird implementiert und scharf
  getestet, aber produktiv erst mit dokumentierter Rechtsgrundlage/AVV/DSFA aktiviert.