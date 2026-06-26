export const meta = {
  name: 'phase1-llm-provider',
  description: 'Build src/lib/llm provider abstraction (Ollama chat + cloud + fake + factory), then adversarially verify against contracts',
  phases: [{ title: 'Build' }, { title: 'Verify' }],
}

const CONTRACT = `
VERIFIED FACTS (do not re-derive, but you MAY read files to confirm):
- Mirror the EXACT fetch idiom of OllamaEmbedder in src/lib/infra/ollama.ts: POST to \`\${baseUrl}/api/chat\`, headers {'Content-Type':'application/json'}, check response.ok and throw on !ok, no SDK. Env OLLAMA_BASE_URL (default 'http://localhost:11434').
- createEmbedder/createVectorStore factory pattern lives in src/lib/infra/index.ts — mirror it for createLLMProvider.
- The exact LLMProvider contract (call, callStructured<T>, estimateTokens, CallContext) is specified in docs/architecture/INTEGRATION_BOUNDARIES.md section 1 — READ IT and match names/shape exactly.
- RankedCitation.confidence is GROUNDED|UNSUPPORTED_DRAFT (src/lib/rag/citation.ts) — the LLM layer must never invent grounding; on structured-parse failure, fail closed.
`

phase('Build')
const buildSummary = await agent(
  `You are implementing Phase 1 of plan_neu.md (already on feature branch m2/vertical-slice-planung-arbeitsblaetter). Create the NEW module src/lib/llm/ — an isolated LLM provider abstraction. Do NOT touch RAG/DB/auth/UI files.

${CONTRACT}

Create these files:

1. src/lib/llm/provider.ts
   - export interface LLMProvider { call(prompt: string, ctx?: CallContext): Promise<string>; callStructured<T>(prompt: string, schema: JSONSchema, ctx?: CallContext): Promise<T>; estimateTokens(text: string): number }
   - export type JSONSchema = Record<string, unknown>   // minimal, NO new dependency
   - export type/interface CallContext — match INTEGRATION_BOUNDARIES.md §1 exactly (subject/scope/dataClass/provider intent etc. as documented there). If the doc is ambiguous, keep it a small documented type.
   - Export a class StructuredParseError extends Error for fail-closed structured parsing.

2. src/lib/llm/ollama-chat.ts
   - export class OllamaChatProvider implements LLMProvider
   - call(): POST \`\${baseUrl}/api/chat\` body { model, messages:[{role:'user',content:prompt}], stream:false }, parse (await res.json()).message.content as string. Mirror OllamaEmbedder error handling (throw on !res.ok).
   - callStructured<T>(): same endpoint, additionally pass \`format: schema\` (Ollama JSON-schema structured output). Parse message.content with JSON.parse inside try/catch; on ANY parse failure throw StructuredParseError (FAIL-CLOSED, never fabricate). 
   - estimateTokens(): cheap heuristic (e.g. Math.ceil(text.length/4)).
   - Env: OLLAMA_BASE_URL (default http://localhost:11434), new OLLAMA_CHAT_MODEL (default 'qwen2.5:14b'). Constructor(baseUrl?, model?).

3. src/lib/llm/cloud.ts
   - export class CloudProvider implements LLMProvider, constructed with a provider kind ('openai-compat'|'anthropic') + config from env.
   - OpenAI-compatible path = REAL via fetch: POST \`\${OPENAI_BASE_URL}/v1/chat/completions\`, Authorization: Bearer \${OPENAI_API_KEY}, body {model, messages}; for callStructured use response_format json_schema. Parse choices[0].message.content; fail-closed parse like Ollama.
   - Anthropic path = feature-flagged, documented, REST via fetch to the Anthropic Messages API (model id 'claude-opus-4-8'), behind CLOUD_LLM_ENABLED + provider==='anthropic'. DO NOT add @anthropic-ai/sdk dependency — use fetch. If you are unsure of the Anthropic request shape, keep it minimal and clearly TODO-documented; this path is OFF by default in this slice.
   - Read ALL secrets from env only (OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_CHAT_MODEL, ANTHROPIC_API_KEY). NEVER hardcode keys.

4. src/lib/llm/fake.ts
   - export class FakeLLMProvider implements LLMProvider — deterministic, analogous to FakeEmbedder. call() returns a deterministic string from the prompt. callStructured<T>() returns a DETERMINISTIC object that is valid against a typical generation schema {statements:[{text,citationRefs:number[]}]} — derive statements deterministically from the prompt so tests can assert. estimateTokens heuristic.

5. src/lib/llm/index.ts
   - export function createLLMProvider(opts?: { fake?: boolean }): LLMProvider — mirror createEmbedder in src/lib/infra/index.ts. Returns FakeLLMProvider when fake, else OllamaChatProvider (LOCAL DEFAULT). 
   - IMPORTANT: createLLMProvider MUST NOT return a CloudProvider directly (cloud is wrapped by the Phase 2 gate). Export the CloudProvider class and a helper to construct it (e.g. createCloudProvider(kind)) for the gate to wrap, but the default factory stays local-first.
   - Re-export the public types.

Also: add the NEW env vars (OLLAMA_CHAT_MODEL, CLOUD_LLM_ENABLED=false, OPENAI_API_KEY=, OPENAI_BASE_URL=, OPENAI_CHAT_MODEL=, ANTHROPIC_API_KEY=) to .env.example with empty/placeholder values and short comments. NEVER put real secrets.

Constraints: TypeScript strict, no new npm dependencies, match existing code style (look at neighboring files). After writing, run \`pnpm typecheck\` and \`pnpm lint\` and fix anything you introduced (pre-existing 4 ocr lint warnings are fine to leave). 

Return: a concise list of files created, the exact CallContext shape you settled on, the new env vars, and any deviation from the spec with reason.`,
  { label: 'build-llm', phase: 'Build', model: 'sonnet' }
)

phase('Verify')
const VERDICT = {
  type: 'object', additionalProperties: false,
  required: ['compiles', 'failClosedOk', 'cloudGatedOk', 'contractMatch', 'blocking', 'notes'],
  properties: {
    compiles: { type: 'boolean', description: 'pnpm typecheck passes' },
    failClosedOk: { type: 'boolean', description: 'structured parse failures throw, never fabricate' },
    cloudGatedOk: { type: 'boolean', description: 'createLLMProvider never returns CloudProvider directly; no hardcoded secrets' },
    contractMatch: { type: 'boolean', description: 'LLMProvider/CallContext match INTEGRATION_BOUNDARIES §1 and fetch idiom matches OllamaEmbedder' },
    blocking: { type: 'array', items: { type: 'string' }, description: 'must-fix issues (empty if none)' },
    notes: { type: 'string' },
  },
}
const verdict = await agent(
  `Adversarially review the NEW src/lib/llm/ module just created on this branch. Be skeptical. Read every file in src/lib/llm/, plus src/lib/infra/ollama.ts, src/lib/infra/index.ts and docs/architecture/INTEGRATION_BOUNDARIES.md §1 to check fidelity.

Check and report:
1. Run \`pnpm typecheck\` — does it pass cleanly?
2. FAIL-CLOSED: does callStructured throw (StructuredParseError) on malformed JSON in BOTH OllamaChatProvider and CloudProvider? Does it ever fabricate/return a default object on parse failure? (must NOT)
3. CLOUD GATING: does createLLMProvider EVER return a CloudProvider directly? (must NOT — cloud is wrapped by Phase 2 gate). Are there any hardcoded API keys/secrets? (must be NONE — env only)
4. CONTRACT: do LLMProvider method names + CallContext match INTEGRATION_BOUNDARIES §1? Does the Ollama fetch idiom (endpoint /api/chat, headers, !res.ok throw, no SDK) match OllamaEmbedder?
5. Any new npm dependency added? (must be NONE)
Return the structured verdict; put concrete must-fix items in 'blocking'.`,
  { label: 'verify-llm', phase: 'Verify', model: 'sonnet', schema: VERDICT }
)

return { buildSummary, verdict }
