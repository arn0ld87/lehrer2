export const meta = {
  name: 'm2-llm-provider-privacy',
  description: 'Phase 2: LLM-Provider-Abstraktion + Privacy-Pipeline (Pseudonymisierung/Redaction/fail-closed Guard) + CloudReleaseGrant (ADR 0002, #22)',
  phases: [
    { title: 'BuildA', detail: 'Provider + Policy-Gate + CloudReleaseGrant-Schema + Migration (Sonnet)' },
    { title: 'BuildB', detail: 'Pseudonymize + Redact + Guard + Flow-Orchestrator + Tests (Sonnet)' },
    { title: 'Review', detail: '4 Haiku-Skeptiker: PII-Leak, Cloud-ohne-Grant, Re-ID-nur-lokal, Redaction/Guard' },
  ],
}

const REPO = '/Volumes/T7/Projekte/jana_lehrerin'

const BUILD_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['filesWritten', 'summary', 'typecheck', 'lintNew', 'testsNew', 'dbCheck', 'notes'],
  properties: {
    filesWritten: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string', description: 'Was implementiert wurde, öffentliche API-Signaturen' },
    typecheck: { type: 'string', enum: ['pass', 'fail', 'skipped'], description: 'pnpm typecheck — pass wenn keine NEUEN Fehler in den eigenen Dateien' },
    lintNew: { type: 'string', enum: ['pass', 'fail', 'skipped'] },
    testsNew: { type: 'string', enum: ['pass', 'fail', 'skipped'], description: 'Vitest auf den neuen Testdateien (Docker-frei, ohne globalSetup)' },
    dbCheck: { type: 'string', enum: ['pass', 'fail', 'skipped'], description: 'pnpm db:generate + pnpm db:check' },
    notes: { type: 'string', description: 'Design-Entscheidungen, Abweichungen, offene Punkte, pre-existing Fehler' },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['invariant', 'holds', 'evidence', 'issues'],
  properties: {
    invariant: { type: 'string' },
    holds: { type: 'boolean', description: 'true nur, wenn der Code die Invariante nachweislich garantiert' },
    evidence: { type: 'string', description: 'datei:zeile + Codezitat' },
    issues: { type: 'string', description: 'Gefundene Umgehungen/Lücken; leer wenn keine' },
  },
}

const COMMON = `Repo: ${REPO} (Next.js/TypeScript strict, pnpm). Branch: feat/llm-provider-privacy (gestapelt auf Phase 1 — src/lib/rag/retrieve.ts und citation.ts existieren bereits). NICHT committen, NICHT pushen, KEINE unrelated Dateien anfassen.

VERBINDLICHE VERTRÄGE — VOLLSTÄNDIG LESEN, nicht raten:
- docs/security/REDACTION_AND_GUARD_SPEC.md (§1 Pseudonymisierung inkl. Algorithmus+Mapping-Tabelle, §2 Redaction-Regeln Kategorien/Muster/Ablauf, §3 fail-closed Guard Prüflogik+Konsequenzen, §4 CloudReleaseGrant Datenmodell+Validierungs-Invarianten).
- docs/adr/0002-provider-agnostic-llm-layer.md (§46 Entscheidung, §66 LLMProvider Interface, §92 Redaction-Engine, §109 CloudReleaseGrant).
- docs/architecture/RAG_ARCHITECTURE.md (LLM-Request-Fluss).
- docs/security/DATA_PROTECTION.md (Confidence-Zustände + Guardrails).

BESTAND ZUM WIEDERVERWENDEN (lesen, nicht neu erfinden):
- src/lib/db/enums.ts — dataClassEnum (data_class), confidenceLevelEnum (HIGH/MEDIUM/LOW).
- src/lib/db/schema/provenance.ts — generationProvenance (artifactType, artifactId, provider, model, promptHash, redactionApplied, sourceRefs[], confidenceState jsonb, ownerTeacherId), auditLog.
- src/lib/db/schema/corrections.ts — studentSubmission (pseudonymId, contentRef, ocrTextRef), correctionDraft (aiSuggestion FeedbackStatement[], provenance, status, history).
- src/lib/db/schema/index.ts — hier neue Tabellen registrieren.
- src/lib/infra/ollama.ts — Muster für lokalen Client + Fake (Interface + FakeXxx). Spiegle dieses Muster.
- src/lib/rag/retrieve.ts — retrieve(deps, query, opts) aus Phase 1 (für RAG-Kontext im Flow).

NICHT VERHANDELBARE INVARIANTEN (fail-closed):
1. Der Guard läuft VOR JEDEM Provider-Call. Erkennt er PII → Abbruch (throw), Provider wird NICHT aufgerufen.
2. Ein Cloud-Provider wird NIE ohne gültigen (nicht abgelaufenen, scope-passenden) CloudReleaseGrant aufgerufen — sonst fail-closed reject.
3. Re-Identifikation NUR auf dem lokalen Pfad; die Pseudonym-Mapping-Tabelle verlässt nie das System / geht nie an einen Provider.
4. Default-Provider ist lokal (Ollama). Keine echten Schülernamen je im Provider-Payload.
5. Migrationen: nur CREATE (keine ad-hoc DELETE/UPDATE in drizzle/*.sql).`

const BUILD_A_PROMPT = `${COMMON}

DEINE TEILAUFGABE A — Provider-Abstraktion, Policy-Gate, CloudReleaseGrant-Persistenz:

1) src/lib/llm/provider.ts:
   - Interface LLMProvider exakt nach ADR 0002 §66 (mind. generate(); falls die ADR stream()/Token-Schätzung definiert, übernimm sie). Request/Result-Typen mit Feldern, die der Flow braucht (prompt, system?, contextChunks?, modelHint?) → { text, model, ... }.
   - OllamaProvider implements LLMProvider (local-only; ${'${OLLAMA_BASE_URL}'}/api/generate; Modell aus Env). FakeLlmProvider (deterministisch, echo-/regelbasiert) für Tests.
2) src/lib/db/schema/privacy.ts:
   - Tabelle cloudReleaseGrant EXAKT nach REDACTION_AND_GUARD_SPEC.md §4.1 (Felder, Rechtsgrundlage, AVV, DSFA, Provider/Region, Gültigkeit/Expiry, Scope, schoolId). 
   - Tabelle pseudonymMapping nach §1.2 (lokal-only: pseudonymId ↔ echte Referenz, schoolId, createdAt). Markiere im Datei-Kommentar klar: NIEMALS an Provider/Cloud.
   - Neue Enums (z.B. providerKind/cloudRegion) falls nötig in src/lib/db/enums.ts ergänzen.
   - In src/lib/db/schema/index.ts registrieren.
3) src/lib/llm/policy.ts:
   - ProviderPolicyGate: wählt Provider nach dataClass. Default lokal. Cloud nur bei gültigem CloudReleaseGrant (Validierungs-Invarianten aus §4.2: nicht abgelaufen, Scope/Provider/Region passend, vorhanden). Sonst throw (fail-closed). Grant-Lookup über injiziertes Interface (Fake für Tests), kein direkter DB-Import.
4) Migration: pnpm db:generate ausführen → die generierte drizzle/*.sql (CREATE-only) muss entstehen. Danach pnpm db:check (kein DB-Zugriff). KEINE DELETE/UPDATE.

VERIFY (fix bis grün): pnpm typecheck (pre-existing Fehler in bullmq/ocr/testcontainers ignorieren — per grep prüfen, dass deine Dateien fehlerfrei sind), pnpm lint, pnpm db:generate, pnpm db:check. testsNew=skipped (Tests kommen in Teil B).
Gib das Schema-Objekt zurück.`

const BUILD_B_PROMPT = `${COMMON}

Teil A ist bereits umgesetzt (lies die neuen Dateien: src/lib/llm/provider.ts, src/lib/llm/policy.ts, src/lib/db/schema/privacy.ts). 

DEINE TEILAUFGABE B — Privacy-Pipeline, Guard, Flow-Orchestrator, Tests:

1) src/lib/privacy/pseudonymize.ts: Pseudonymisierung nach §1 (Algorithmus + stabile Pseudonyme; Mapping über injiziertes Interface, lokal-only). Funktionen pseudonymize(text/struktur) und reidentify(...) — reidentify NUR lokal.
2) src/lib/privacy/redact.ts: Redaction nach §2 (alle Kategorien/Muster: Namen, E-Mail, Telefon, Adresse, Geburtsdaten, etc.). redact(text) → { redactedText, foundPii }.
3) src/lib/privacy/guard.ts: fail-closed assertNoPii(payload) nach §3 — wirft bei erkannter PII (mehrere Muster), gibt sonst still zurück. Konsequenzen nach §3.2.
4) src/lib/llm/flow.ts: Orchestrator nach RAG_ARCHITECTURE LLM-Fluss:
   Intent/Scope → ProviderPolicyGate → pseudonymize+redact → retrieve() (RAG-Kontext, Pflichtfilter aus Phase 1) → guard.assertNoPii(finaler Provider-Payload) → provider.generate → reidentify (nur lokal) → generationProvenance-Record bauen (redactionApplied=true) → Confidence/Zitation.
   Alle Abhängigkeiten injiziert (provider, policyGate, redactor, pseudonymizer, guard, retrieveFn, provenanceWriter) — testbar mit Fakes, kein Docker.
5) Tests (Docker-frei, in src/lib/**/__tests__/, gegen Fakes):
   - guard.test.ts: PII-Muster aus §2 → assertNoPii wirft; sauberer Text → kein Wurf.
   - policy.test.ts: SENSITIVE_STUDENT ohne Grant → Cloud reject + lokal erlaubt; abgelaufener/scope-fremder Grant → reject; PUBLIC → lokal default.
   - redact/pseudonymize round-trip: redactedText ohne PII; reidentify stellt nur lokal wieder her.
   - flow.test.ts: Wenn der Payload (nach Redaction) noch PII trägt, wird der Fake-Provider NIE aufgerufen (Guard greift davor). Default-Pfad = lokal.

VERIFY (fix bis grün): pnpm typecheck (pre-existing Fehler ignorieren, eigene Dateien fehlerfrei), pnpm lint, und die neuen Tests Docker-frei ausführen. Da vitest.config.ts ein Postgres-globalSetup hat (Docker nicht verfügbar): lege eine Wegwerf-Config unter /private/tmp/claude-501/-Volumes-T7-Projekte-jana-lehrerin/714cfa07-d99b-4185-b611-0ea046402dae/scratchpad/ an (resolve.alias '@'→${REPO}/src, KEIN globalSetup, include = deine neuen Testdateien) und führe pnpm exec vitest run --config <scratchpath> aus. NICHT pnpm test (braucht Docker).
Gib das Schema-Objekt zurück (filesWritten kumulativ deiner Dateien, testsNew=pass/fail).`

phase('BuildA')
const buildA = await agent(BUILD_A_PROMPT, { label: 'build:provider+policy+grant', phase: 'BuildA', model: 'sonnet', schema: BUILD_SCHEMA })

phase('BuildB')
const buildB = await agent(BUILD_B_PROMPT, { label: 'build:privacy+guard+flow', phase: 'BuildB', model: 'sonnet', schema: BUILD_SCHEMA })

const lenses = [
  { key: 'pii-leak', inv: 'Der fail-closed Guard läuft VOR jedem Provider-Call; erkennt er PII (Namen/E-Mail/Telefon/Adresse/Geburtsdatum etc.), bricht der Flow ab und der Provider wird NICHT aufgerufen. Es gibt keinen Codepfad, auf dem unredaktierte PII den Provider-Payload erreicht.' },
  { key: 'cloud-grant', inv: 'Ein Cloud-Provider wird NIE ohne gültigen CloudReleaseGrant aufgerufen: abgelaufene, scope-/region-/provider-fremde oder fehlende Grants führen zu fail-closed reject. Default-Provider ist lokal (Ollama).' },
  { key: 'reid-local', inv: 'Re-Identifikation und die Pseudonym-Mapping-Tabelle bleiben rein lokal; das Mapping wird nie Teil eines Provider-Payloads oder Cloud-Calls. Pseudonyme statt Klarnamen verlassen das System.' },
  { key: 'redact-guard', inv: 'Redaction deckt alle PII-Kategorien aus REDACTION_AND_GUARD_SPEC.md §2 ab; der Guard §3 ist nicht abschwächbar/umgehbar; Migrationen enthalten nur CREATE (kein DELETE/UPDATE).' },
]

phase('Review')
const reviews = await parallel(
  lenses.map((l) => () =>
    agent(
      `Adversarialer Review im Repo ${REPO}, Branch feat/llm-provider-privacy. Lies die tatsächlich geschriebenen Dateien unter src/lib/llm/, src/lib/privacy/, src/lib/db/schema/privacy.ts, die zugehörigen Tests, sowie zum Abgleich docs/security/REDACTION_AND_GUARD_SPEC.md und docs/adr/0002-provider-agnostic-llm-layer.md und drizzle/*.sql (neueste Migration).\n\nPRÜFE STRENG diese eine Invariante und versuche sie zu WIDERLEGEN (default holds=false bei Unsicherheit):\n"${l.inv}"\n\nSuche aktiv nach Umgehungen: Provider-Calls vor/ohne Guard, Cloud-Pfade ohne Grant-Prüfung, Mapping/Klarnamen im Payload, fehlende PII-Kategorien, abschwächbare Asserts, DELETE/UPDATE in Migrationen. evidence als datei:zeile + Codezitat. holds=true nur bei nachweislicher Garantie.`,
      { label: 'review:' + l.key, phase: 'Review', model: 'haiku', schema: VERDICT_SCHEMA },
    ),
  ),
)

return { buildA, buildB, reviews }
