export const meta = {
  name: 'recon-vertical-slice',
  description: 'Verify exact contracts of existing RAG/DB/auth/export/UI before implementing plan_neu.md phases',
  phases: [{ title: 'Recon', detail: 'cheap parallel readers extract exact signatures' }],
}

phase('Recon')

const DIGEST = {
  type: 'object',
  additionalProperties: false,
  required: ['area', 'contracts', 'gotchas'],
  properties: {
    area: { type: 'string' },
    contracts: {
      type: 'array',
      description: 'Exact signatures/types/exports an implementer must build against',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['file', 'name', 'signature', 'notes'],
        properties: {
          file: { type: 'string' },
          name: { type: 'string', description: 'export / type / function name' },
          signature: { type: 'string', description: 'verbatim TS signature or type shape, trimmed' },
          notes: { type: 'string' },
        },
      },
    },
    gotchas: {
      type: 'array',
      description: 'Constraints, fail-closed behaviors, NOT-NULL FKs, things that throw, mismatches vs plan_neu.md',
      items: { type: 'string' },
    },
  },
}

const readers = [
  {
    label: 'rag-contracts',
    prompt: `Read these files in full and extract EXACT contracts:
- src/lib/rag/retrieve.ts (the retrieve() signature: deps shape, query, opts {subject,confession,minTrust,k}; return type)
- src/lib/rag/citation.ts (RankedCitation, Citation, SourceCitation types; deriveConfidence; GROUNDED|UNSUPPORTED_DRAFT enum values)
- src/lib/rag/ingest.ts (ingestSource() signature + deps; CONFIRM it sets lifecycle to INGESTED itself and that calling ingestMark afterward throws)
- src/lib/rag/extract.ts (supported content types; ExtractionFailedError; OCR injection point deps.ocr)
Report verbatim signatures. Note any mismatch with these plan claims: retrieve(deps:{embedder,store,sourceRefReader},query,opts), RankedCitation.confidence is GROUNDED|UNSUPPORTED_DRAFT.`,
    area: 'rag-contracts',
  },
  {
    label: 'infra-provider-pattern',
    prompt: `Read src/lib/infra/ollama.ts, src/lib/infra/index.ts, src/lib/infra/qdrant.ts in full.
Extract: the OllamaEmbedder class (exact fetch call style: URL build from OLLAMA_BASE_URL, headers, body, error handling, no-SDK pattern); FakeEmbedder shape; createEmbedder() and createVectorStore() factory pattern in index.ts (env switches, return interfaces). I will mirror this exact style for a new OllamaChatProvider + createLLMProvider(). Report the fetch idiom verbatim and the env var names used.`,
    area: 'infra-provider-pattern',
  },
  {
    label: 'db-artifacts-provenance',
    prompt: `Read src/lib/db/schema/artifacts.ts, src/lib/db/schema/provenance.ts, src/lib/db/schema/index.ts, src/lib/db/enums.ts, src/lib/db/columns.ts in full.
Extract exact table+column definitions for: teachingUnit (CONFIRM strandId is NOT NULL FK and the referenced table/onDelete), lesson (phasePlan jsonb?), worksheet, task (difficulty enum values - Basis/Erweiterung/Foerder?), worksheetSourceRef, taskSourceRef, expectationHorizon, generation_provenance (all columns: provider/model/promptHash/redactionApplied/sourceRefs/confidenceState), audit_log (columns; CONFIRM no student-name column). List how schema/index.ts re-exports so I know where to add a new grants table.`,
    area: 'db-artifacts-provenance',
  },
  {
    label: 'db-repos-lifecycle',
    prompt: `Read src/lib/db/repositories/sources.pg.ts, src/lib/db/repositories/mapping.ts, src/lib/db/repositories/factory.ts, src/lib/db/repositories/deletion.ts in full.
Extract: source lifecycle methods (create/register/approve/ingestMark) exact signatures + the state machine they enforce (what throws when). The mapping.ts functions: uiConfessionToDbContexts, subject mapping, anything mapping UI->DB confession/subject (verbatim signatures + enum values). factory.ts pattern (REPOSITORY_BACKEND switch). deletion.ts named methods. Note the seed-sources RELIGION blocker if visible.`,
    area: 'db-repos-lifecycle',
  },
  {
    label: 'auth-tenant',
    prompt: `Read src/lib/auth/auth.ts, src/lib/auth/index.ts, src/lib/db/schema/auth.ts, src/lib/db/schema/tenant.ts in full.
Extract: the better-auth instance export (name, how configured, single-tenant per ADR 0007), auth.api.getSession usage shape, getCurrentTeacher() signature + return type, teacherProfile/user/school table columns. I need this for Server Actions (session via auth.api.getSession({headers}) + getCurrentTeacher(userId)) and a seed-user script. Report verbatim.`,
    area: 'auth-tenant',
  },
  {
    label: 'export-ui-contracts',
    prompt: `Read src/lib/export/index.ts, src/lib/export/types.ts, src/lib/repositories.ts, src/lib/types.ts in full.
Extract: exportArtifact() signature; ExportableWorksheet, SourceCitation and related export types (verbatim). From repositories.ts: the UI repository interfaces relevant to planning + worksheets (PlanningRepository/WorksheetRepository or equivalents) and their method signatures (sync mock today). From types.ts: domain types StructureProposal, CurriculumFit, Worksheet, Task, Lesson, TeachingUnit as used by UI. I will add async Pg write-repos + map RankedCitation->SourceCitation. Report verbatim shapes.`,
    area: 'export-ui-contracts',
  },
  {
    label: 'ui-components',
    prompt: `Find and read the planner + worksheet UI components and their mock data source:
- src/components/planner/planning-form.tsx (and sibling StructureProposal / CurriculumFitCard components in src/components/planner/)
- src/components/worksheet/builder-panel.tsx (and WorksheetPreview in src/components/worksheet/)
- src/lib/mock/repositories.ts and src/lib/mock/factories.ts (which mock data the pages currently render)
Report: is each a client or server component ("use client"?), what props/inputs they take, which form inputs exist and whether they have name= attributes, where mock data is injected, and exactly what I must change to bind <form action={serverAction}> and render results (citations + GROUNDED/UNSUPPORTED_DRAFT + cross-denomination warning) instead of mock. Keep it concrete with file:line where possible.`,
    area: 'ui-components',
  },
  {
    label: 'specs-and-blocker',
    prompt: `Read in full:
- docs/security/REDACTION_AND_GUARD_SPEC.md (extract: PII regex categories, redact() contract, guardAssertion(text):boolean contract, fail-closed behavior)
- docs/architecture/INTEGRATION_BOUNDARIES.md section 1 (extract: the LLMProvider interface contract verbatim: call, callStructured<T>, estimateTokens, CallContext)
- scripts/seed-sources.ts and data/source-registry.seed.yaml (extract: the RELIGION_EV/RELIGION_KA -> subject=null/confessionContext=null blocker the plan wants fixed; show the exact mapping code)
Report verbatim contracts and the exact blocker location.`,
    area: 'specs-and-blocker',
  },
]

const results = await parallel(
  readers.map((r) => () =>
    agent(r.prompt, { label: r.label, phase: 'Recon', model: 'haiku', schema: DIGEST })
  )
)

return results.filter(Boolean)
