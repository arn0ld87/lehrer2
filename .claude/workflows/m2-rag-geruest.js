export const meta = {
  name: 'm2-rag-geruest',
  description: 'M2 Schritt 1: Quellen-RAG-Geruest — Datenmodell, Infra-Clients, Repos, Ingestion, UI, Seed, Doku, Tests, Gates, Review',
  phases: [
    { title: 'Deps' },
    { title: 'A-Schema', model: 'sonnet' },
    { title: 'B-Infra' },
    { title: 'C-Repos', model: 'sonnet' },
    { title: 'D-Ingest', model: 'sonnet' },
    { title: 'E-UI' },
    { title: 'F-Seed' },
    { title: 'G-Docs' },
    { title: 'H-Tests' },
    { title: 'I-Gates', model: 'sonnet' },
    { title: 'Review', model: 'sonnet' },
  ],
}

const ROOT = '/Volumes/T7/Projekte/jana_lehrerin'

const COMMON = `
Projekt: "Unterrichtsassistenz LSA". Arbeitsverzeichnis: ${ROOT}.
Git-Branch ist bereits ausgecheckt: m2/rag-geruest — NIEMALS Branch wechseln/erstellen, NIEMALS auf main arbeiten.
Paketmanager ist AUSSCHLIESSLICH pnpm (nie npm/yarn). TypeScript strict.
Die Umgebung committet Datei-Edits selbstständig (Auto-Commit-Hook) — du musst NICHT selbst 'git commit' ausführen; konzentriere dich auf korrekte Datei-Inhalte + deine Verifikation.

CRG-Hook-Workaround: Falls ein nativer Read/Edit von einem Hook geblockt wird mit Hinweis auf "AGENTS.md § 3 / code-review-graph", rufe EINMAL mcp__code-review-graph__list_graph_stats_tool (repo_root: "${ROOT}") und versuche es erneut. Aktiviere das proaktiv, wenn du bestehende Dateien editierst.

Verifizierte Fakten (nicht neu herleiten):
- src/lib/db/enums.ts: subjectEnum=[DEUTSCH,RELIGION,ETHIK]; confessionContextEnum=[EVANGELISCH,KATHOLISCH,KONFESSIONSSENSIBEL_UEBERGREIFEND,RELIGIONSKUNDLICH,NICHT_ANWENDBAR]; sourceTrustEnum("source_trust")=[OFFICIAL_BINDING,OFFICIAL_GUIDANCE,OPEN_CURATED,USER_APPROVED,UNVERIFIED].
- src/lib/db/columns.ts exportiert artifactTimestamps = { dataClass(default INTERNAL), createdAt, updatedAt, deletedAt, version(default 1) }.
- src/lib/db/schema/artifacts.ts: export const sourceRef = pgTable("source_ref", { id uuid pk, contentHash text NOT NULL unique, sourceType source_trust NOT NULL, title text, uri text, confidence, ownerTeacherId text nullable -> user.id, ...artifactTimestamps }). Join-Tabellen worksheetSourceRef/taskSourceRef referenzieren sourceRef.id (UNVERAENDERT lassen).
- Konfessions-Invariante (DATA_MODEL.md, erzwungen am curriculum_strand): RELIGION => {EVANGELISCH,KATHOLISCH,KONFESSIONSSENSIBEL_UEBERGREIFEND}; ETHIK => {RELIGIONSKUNDLICH,NICHT_ANWENDBAR}; DEUTSCH => NICHT_ANWENDBAR. (Achtung: RELIGION enthaelt NICHT RELIGIONSKUNDLICH.)
- Migrationen liegen in drizzle/ (bisher nur 0000_sharp_eddie_brock.sql + meta/). drizzle.config.ts -> Schema src/lib/db/schema/index.ts.
- Tests: Vitest + @testcontainers/postgresql. src/lib/db/__tests__/global-setup.ts startet postgres:16 + migrate ./drizzle. vitest.config.ts: fileParallelism:false, pool:"forks", testTimeout 60000, geteilte Test-DB -> JEDE Testdatei MUSS datei-eindeutige user-id/email verwenden.

Bindende Grundsaetze: Quellenpflicht, local-first (NUR Ollama-Embedding, KEIN Cloud-Pfad), Datensparsamkeit, fail-closed Trust-Gate (UNVERIFIED nie produktiv). Konfessionstrennung per DB-CHECK.

Deine Rueckgabe (final message) IST der Datenwert — gib das geforderte JSON-Objekt zurueck, keine Prosa fuer Menschen.
`

const RESULT = {
  type: 'object',
  additionalProperties: false,
  required: ['phase', 'success', 'summary', 'filesTouched', 'verification', 'blockers'],
  properties: {
    phase: { type: 'string' },
    success: { type: 'boolean', description: 'true NUR wenn die phaseneigene Verifikation bestanden wurde' },
    summary: { type: 'string', description: 'was umgesetzt wurde, knapp' },
    filesTouched: { type: 'array', items: { type: 'string' } },
    verification: { type: 'string', description: 'exakt ausgefuehrte Befehle + Pass/Fail-Ergebnis' },
    blockers: { type: 'array', items: { type: 'string' }, description: 'leere Liste wenn keine' },
    notes: { type: 'string' },
  },
}

const VERDICT = {
  type: 'object',
  additionalProperties: false,
  required: ['dimension', 'pass', 'findings', 'summary'],
  properties: {
    dimension: { type: 'string' },
    pass: { type: 'boolean' },
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'detail', 'location'],
        properties: {
          severity: { type: 'string', enum: ['blocker', 'high', 'medium', 'low'] },
          detail: { type: 'string' },
          location: { type: 'string' },
        },
      },
    },
  },
}

// ---------- Phase 0: Deps (hartes Prerequisite) ----------
phase('Deps')
const deps = await agent(
  `${COMMON}
PHASE 0 — Dependencies installieren. Fuehre exakt aus (eine Bash-Session, langer Timeout):
  cd ${ROOT} && pnpm add @aws-sdk/client-s3 pdf-parse && pnpm add -D tsx @types/pdf-parse
js-yaml ist bereits devDependency (nicht erneut installieren). Pruefe danach, dass die 4 Pakete in package.json stehen und pnpm-lock.yaml aktualisiert wurde. Aendere KEINE anderen Datei.
success=true nur wenn beide pnpm-add-Befehle exit 0 lieferten.`,
  { label: 'deps:install', phase: 'Deps', model: 'haiku', effort: 'low', schema: RESULT },
)
if (!deps || !deps.success) {
  log('Phase 0 (Deps) fehlgeschlagen — Pipeline abgebrochen, Foundation fehlt.')
  return { aborted: 'Deps', deps }
}

// ---------- Phase A: Datenmodell (hartes Prerequisite, governance-kritisch) ----------
phase('A-Schema')
const a = await agent(
  `${COMMON}
PHASE A — Datenmodell. Lies zuerst: src/lib/db/enums.ts, src/lib/db/columns.ts, src/lib/db/schema/artifacts.ts, src/lib/db/schema/curriculum.ts, src/lib/db/schema/index.ts.

1) src/lib/db/enums.ts: neuen Enum ergaenzen:
   export const sourceLifecycleEnum = pgEnum("source_lifecycle", ["DISCOVERED","UNDER_REVIEW","REGISTERED","APPROVED","INGESTED","VERSIONED","EVALUATED","REVOKED"]);

2) src/lib/db/schema/artifacts.ts — die bestehende sourceRef-Tabelle IN-PLACE erweitern (Join-Tabellen unveraendert lassen):
   - Neue Spalten: authorOrganization text; publishedDate timestamp({withTimezone:true}); licenseInfo text; licenseVerified boolean NOT NULL default false; validFrom timestamp({withTimezone:true}); validTo timestamp({withTimezone:true}); subjectAlignment subjectEnum (nullable); confessionContext confessionContextEnum (nullable); lifecycleStatus sourceLifecycleEnum NOT NULL default "DISCOVERED"; approvalMetadata jsonb; retrievedAt timestamp({withTimezone:true}); sourceVersion integer NOT NULL default 1.
   - contentHash LOCKERN: von .notNull().unique() auf NULLABLE ohne inline-unique; stattdessen partieller Unique-Index im 2. pgTable-Arg: uniqueIndex("source_ref_content_hash_uniq").on(t.contentHash).where(sql\`\${t.contentHash} IS NOT NULL\`).
   - sourceType: default "UNVERIFIED" ergaenzen (bleibt NOT NULL).
   - Neuer CHECK "source_confession_subject_valid": LIES den bestehenden check("confession_subject_valid", sql\`...\`) in curriculum.ts und spiegle seine Struktur EXAKT fuer source_ref, ABER nur wirksam wenn subject_alignment IS NOT NULL (da nullable). Logik: subject_alignment IS NULL OR (RELIGION => confession_context IN ('EVANGELISCH','KATHOLISCH','KONFESSIONSSENSIBEL_UEBERGREIFEND')) AND (ETHIK => confession_context IN ('RELIGIONSKUNDLICH','NICHT_ANWENDBAR')) AND (DEUTSCH => confession_context = 'NICHT_ANWENDBAR'). RELIGION enthaelt NICHT RELIGIONSKUNDLICH.
   - Noetige Imports ergaenzen (boolean, jsonb, integer, uniqueIndex, check, sql, sourceLifecycleEnum, subjectEnum, confessionContextEnum).

3) Neue Datei src/lib/db/schema/rag.ts — Tabelle ragChunk = pgTable("rag_chunk", {...}):
   id uuid pk defaultRandom; sourceRefId uuid NOT NULL references(()=>sourceRef.id,{onDelete:"restrict"}); chunkText text NOT NULL; pageOrSection text NOT NULL; sourceVersion integer NOT NULL default 1; contentHash text NOT NULL; embeddingRef uuid (nullable); trustLevel sourceTrustEnum NOT NULL; subject subjectEnum (nullable); confessionContext confessionContextEnum (nullable); license text; retrievedAt timestamp({withTimezone:true}); ...artifactTimestamps.
   2. Arg: unique("rag_chunk_source_hash_version_uniq").on(t.sourceRefId,t.contentHash,t.sourceVersion); check("rag_chunk_text_min_len", sql\`char_length(\${t.chunkText}) >= 50\`). Importiere sourceRef aus "./artifacts", Enums aus "../enums", artifactTimestamps aus "../columns".

4) src/lib/db/schema/index.ts: 'export * from "./rag";' ergaenzen.

5) Migration generieren: cd ${ROOT} && pnpm db:generate. Danach die NEUE drizzle/*.sql-Datei oeffnen und pruefen: enthaelt nur CREATE TABLE / ALTER TABLE ... ADD COLUMN / ADD CONSTRAINT / CREATE [UNIQUE] INDEX / ALTER COLUMN ... DROP NOT NULL / DROP CONSTRAINT / CREATE TYPE — KEINE 'DELETE'- oder 'UPDATE'-DML-Statements. (DDL DROP CONSTRAINT/DROP NOT NULL ist erlaubt.)

6) Verifikation: cd ${ROOT} && pnpm db:check && pnpm typecheck. Beide muessen gruen sein.

In notes: den Dateinamen der neuen Migration + bestaetigen dass kein DELETE/UPDATE drin ist. success=true nur wenn db:check UND typecheck gruen.`,
  { label: 'A:schema+migration', phase: 'A-Schema', model: 'sonnet', effort: 'high', schema: RESULT },
)
if (!a || !a.success) {
  log('Phase A (Schema/Migration) fehlgeschlagen — Pipeline abgebrochen, alle DB-Phasen haengen daran.')
  return { aborted: 'A-Schema', deps, a }
}

// ---------- Phase B: Infra-Clients ----------
phase('B-Infra')
const b = await agent(
  `${COMMON}
PHASE B — Infra-Clients. Lies zuerst .env.example (per grep auf QDRANT, OLLAMA, S3 — vorhandene Vars NICHT duplizieren).

1) src/lib/infra/ollama.ts:
   export interface Embedder { embed(texts: string[]): Promise<number[][]>; }
   export class OllamaEmbedder implements Embedder — POST \`\${process.env.OLLAMA_BASE_URL}/api/embeddings\` (Modell aus OLLAMA_EMBEDDING_MODEL, default "qwen3-embedding:4b"), via fetch, pro Text ein Request oder Batch je nach Ollama-API; nutzt NUR lokale URL, KEIN Cloud-Provider.
   export class FakeEmbedder implements Embedder — deterministisch: dim aus Number(process.env.OLLAMA_EMBEDDING_DIM ?? 2560); pro Text ein Vektor laenge dim, Werte deterministisch aus einem einfachen Hash des Textes (z.B. char-codes), L2-stabil. Keine Zufallszahlen.

2) src/lib/infra/qdrant.ts:
   export interface VectorPoint { id: string; vector: number[]; payload: Record<string, unknown>; }
   export interface SearchFilter { trustLevelNot?: string; subject?: string; confessionContextIn?: string[]; }
   export interface VectorStore { ensureCollection(): Promise<void>; upsertPoints(points: VectorPoint[]): Promise<void>; search(vector: number[], filter: SearchFilter, limit?: number): Promise<Array<{id:string; score:number; payload:Record<string,unknown>}>>; deleteByFilter(filter: SearchFilter): Promise<void>; }
   export class QdrantStore implements VectorStore — REST via fetch gegen process.env.QDRANT_URL (default http://localhost:6333), Collection aus QDRANT_COLLECTION (default "ua_lsa_chunks"), Vektorgroesse aus OLLAMA_EMBEDDING_DIM (default 2560), distance "Cosine". ensureCollection legt Collection an (PUT) falls nicht existent und erstellt Payload-Indizes fuer trust_level, subject, confession_context. search uebersetzt SearchFilter -> Qdrant filter (must/must_not). deleteByFilter loescht Punkte per Filter.
   export class FakeVectorStore implements VectorStore — in-memory Array von Points; ensureCollection no-op; upsert speichert; search filtert deterministisch nach payload (trust_level !== trustLevelNot, subject-Gleichheit, confession_context in confessionContextIn) und gibt nach Reihenfolge zurueck (score = 1); deleteByFilter entfernt passende. Fuer Tests.

3) src/lib/infra/minio.ts:
   @aws-sdk/client-s3: export interface BlobStore { putObject(key:string, body:Uint8Array, contentType?:string): Promise<void>; getObject(key:string): Promise<Uint8Array>; }
   export class S3BlobStore implements BlobStore — S3Client mit endpoint process.env.S3_ENDPOINT, forcePathStyle:true, region "us-east-1", credentials aus MINIO_ROOT_USER/MINIO_ROOT_PASSWORD; Bucket aus S3_BUCKET (default "ua-lsa-dev"). Key-Konvention dokumentieren: sources/<sourceRefId>/<contentHash>.

4) .env.example: NUR fehlende Vars ergaenzen (pruefe vorher per grep): OLLAMA_EMBEDDING_MODEL=qwen3-embedding:4b, OLLAMA_EMBEDDING_DIM=2560, QDRANT_COLLECTION=ua_lsa_chunks. Falls QDRANT_URL/OLLAMA_BASE_URL fehlen, auch ergaenzen (QDRANT_URL=http://localhost:6333, OLLAMA_BASE_URL=http://localhost:11434).

Verifikation: cd ${ROOT} && pnpm typecheck. success=true nur wenn typecheck gruen.`,
  { label: 'B:infra-clients', phase: 'B-Infra', model: 'haiku', effort: 'medium', schema: RESULT },
)

// ---------- Phase C: Repository-Layer (Trust-Gate, governance-kritisch) ----------
phase('C-Repos')
const c = await agent(
  `${COMMON}
PHASE C — Repository-Layer mit fail-closed Trust-Gate + Lebenszyklus. Lies zuerst: src/lib/repositories.ts, src/lib/db/repositories/factory.ts, src/lib/db/repositories/sources.pg.ts, src/lib/db/repositories/deletion.ts, src/lib/db/repositories/mapping.ts, src/lib/db/client.ts, src/lib/types.ts, src/lib/db/schema/artifacts.ts (erweiterte sourceRef).

1) src/lib/repositories.ts: NEUES Interface SourceRepository extends SourceEntriesReader hinzufuegen (bestehende sync SourcesRepository + SourceEntriesReader NICHT aendern):
   list(): Promise<SourceEntry[]>; get(id:string): Promise<SourceEntry|null>; create(input): Promise<string>; register(id, meta): Promise<void>; approve(id, meta): Promise<void>; revoke(id): Promise<void>; ingestMark(id): Promise<void>;
   Typen fuer input/meta knapp definieren (title, uri, sourceType, subjectAlignment?, confessionContext?, licenseInfo?, licenseVerified?, approvalMetadata?).

2) src/lib/db/repositories/sources.pg.ts: PgSourcesRepository erweitern/ergaenzen, sodass es SourceRepository implementiert.
   - FAIL-CLOSED Trust-Gate in approve(id,meta): laedt aktuellen Stand; wirft Error wenn nicht (lifecycleStatus === "REGISTERED" UND licenseVerified === true UND sourceType !== "UNVERIFIED"); sonst setzt lifecycleStatus = "APPROVED".
   - register(): nur aus DISCOVERED/UNDER_REVIEW -> REGISTERED. ingestMark(): nur aus APPROVED -> INGESTED. revoke(): aus jedem Status -> REVOKED.
   - Jede Transition ist eine benannte Methode mit Status-Vorbedingung (kein ad-hoc UPDATE auf beliebige Spalten). create() -> Status DISCOVERED.
   - entries() so anpassen, dass es reale Spalten liest: subjectAlignment/confessionContext (via mapping.ts dbSubjectToUi falls subjectAlignment gesetzt, sonst neutraler Default mit Kommentar), licenseInfo, lifecycleStatus. WHERE deletedAt IS NULL.

3) src/lib/db/repositories/deletion.ts: revokeSourceRefWithAudit(db: Db, id: string, actorId: string) ergaenzen — Transaktion: UPDATE sourceRef SET lifecycleStatus="REVOKED" (via drizzle update auf Einzelzeile, benannte Methode) + insert audit_log (eventType "revoke_source_ref"). Spiegle das Muster von softDeleteWorksheetWithAudit. (Hinweis: dieses ad-hoc-Verbot betrifft ROHE SQL-Migrationen; in TS-Repository-Methoden ist drizzle .update() die vorgeschriebene benannte Methode.)

4) src/lib/db/repositories/factory.ts: getSourceRepository(): SourceRepository ergaenzen — REPOSITORY_BACKEND==="db" -> new PgSourcesRepository(); sonst eine Mock-Impl mit In-Memory-Lifecycle-Map (Map<id, entry>) die dieselben Gate-Regeln durchsetzt. Bestehendes getSourceEntriesReader() NICHT entfernen.

Verifikation: cd ${ROOT} && pnpm typecheck && pnpm lint. success=true nur wenn beide gruen. In notes: bestaetige in EINEM Satz, dass approve() bei licenseVerified=false ODER sourceType=UNVERIFIED wirft.`,
  { label: 'C:repos+trust-gate', phase: 'C-Repos', model: 'sonnet', effort: 'high', schema: RESULT },
)

// ---------- Phase D: Ingestion-Pipeline (governance-kritisch) ----------
phase('D-Ingest')
const d = await agent(
  `${COMMON}
PHASE D — Ingestion-Pipeline. Lies zuerst: src/lib/db/schema/rag.ts, src/lib/infra/{qdrant,minio,ollama}.ts, src/lib/db/repositories/sources.pg.ts, src/lib/db/schema/artifacts.ts, src/lib/db/client.ts.

1) src/lib/rag/extract.ts:
   export class ExtractionFailedError extends Error {}
   export async function extractContent(uri: string, buf: Uint8Array, mime: string): Promise<string> — text/plain: Buffer->utf8. text/html: einfacher Tag-Strip (Regex, KEINE schwere Dep) zu Text. application/pdf: via 'pdf-parse'; wenn der extrahierte Text leer/whitespace ist (Scan-PDF), wirf ExtractionFailedError("PDF lieferte keinen Text — vermutlich Scan; OCR-Worker (M2.4) noetig; Maintainer-Issue anlegen"). Niemals still einen leeren String zurueckgeben.

2) src/lib/rag/chunk.ts:
   export interface Chunk { text: string; pageOrSection: string; }
   export function chunkText(text: string, opts?: {size?:number; overlap?:number}): Chunk[] — char-basiert, size default 1000, overlap default 200, deterministisch; pageOrSection als "chunk:<index>" oder Seitenmarkierung falls vorhanden. Chunks < 50 Zeichen am Ende anhaengen statt eigenstaendig (rag_chunk verlangt >=50), oder dokumentiere Verhalten.

3) src/lib/rag/qdrant.ts (High-Level ueber VectorStore):
   export async function ensureCollection(store: VectorStore): Promise<void>;
   export async function upsertSourceChunks(store: VectorStore, sourceId: string, points: VectorPoint[]): Promise<void>;
   export async function deleteBySource(store: VectorStore, sourceId: string): Promise<void> — nutzt store.deleteByFilter mit payload-Match auf source_id.

4) src/lib/rag/ingest.ts:
   export interface IngestDeps { db: Db; store: VectorStore; blob: BlobStore; embedder: Embedder; }
   export async function ingestSource(deps: IngestDeps, sourceRefId: string): Promise<{chunkCount:number}>:
   (1) GATE fail-closed: Source laden; werfe Error wenn nicht (lifecycleStatus==="APPROVED" UND licenseVerified===true UND sourceType!=="UNVERIFIED"). KEIN Fallback.
   (2) Bytes laden: aus blob (Key sources/<id>/<hash>) oder via fetch(uri).
   (3) contentHash = sha256(raw) (node:crypto), in sourceRef persistieren.
   (4) extractContent -> Text.
   (5) chunkText -> Chunks.
   (6) embedder.embed(chunkTexts) -> Vektoren.
   (7) Qdrant: ensureCollection + upsertSourceChunks; Payload je Punkt: { source_id, trust_level, subject, confession_context, page_or_section, source_version, license, retrieved_at, content_hash }. Point-id = uuid (node:crypto randomUUID) = embeddingRef.
   (8) rag_chunk-Records in EINER DB-Transaktion einfuegen (embeddingRef=pointId, trustLevel denormalisiert aus Source, subject/confessionContext aus Source).
   (9) lifecycleStatus = "INGESTED".
   KOMPENSATION: faellt der PG-Teil nach Qdrant-Upsert fehl, im catch deleteBySource(store, sourceRefId) aufrufen und Fehler weiterwerfen. Qdrant-Upsert ausserhalb der PG-Transaktion.

Verifikation: cd ${ROOT} && pnpm typecheck && pnpm lint. success=true nur wenn beide gruen. In notes: bestaetige in EINEM Satz, dass ingestSource bei nicht-APPROVED ODER UNVERIFIED wirft, BEVOR irgendein Qdrant-Punkt oder rag_chunk entsteht.`,
  { label: 'D:ingestion', phase: 'D-Ingest', model: 'sonnet', effort: 'high', schema: RESULT },
)

// ---------- Phase E: UI ----------
phase('E-UI')
const e = await agent(
  `${COMMON}
PHASE E — UI (nur Lesen, kein Freigabe-Workflow). Lies zuerst: src/app/quelle/page.tsx, src/lib/types.ts, src/components/sources/source-table.tsx, src/lib/db/repositories/factory.ts, src/lib/mock/index.ts (Export mockSourcesRepository), src/components/ui (StatusChip).

1) src/lib/types.ts: SourceEntry um optionales Feld lifecycleStatus erweitern (string-Union passend zu sourceLifecycleEnum-Werten, oder string). SourceStatus/Status-Typ ggf. abstimmen — bestehende Felder NICHT brechen.
2) src/app/quelle/page.tsx: zu async Server-Component machen; entries via getSourceEntriesReader().entries() (await) aus der Factory laden statt direktem mockSourcesRepository.entries(). ragQuality() und governanceChecks() WEITER vom Mock beziehen (mit Kommentar: bis RAG-Layer/M2.2). Default-Backend bleibt mock — d.h. ohne REPOSITORY_BACKEND=db kommt weiter Mock-Daten ueber den Reader.
3) src/components/sources/source-table.tsx: lifecycleStatus (falls vorhanden) im StatusChip-Mapping anzeigen; bestehendes Verhalten bei fehlendem Feld unveraendert. Keine Freigabe-/Admin-UI.

Verifikation: cd ${ROOT} && pnpm typecheck && pnpm lint. success=true nur wenn beide gruen.`,
  { label: 'E:ui', phase: 'E-UI', model: 'haiku', effort: 'medium', schema: RESULT },
)

// ---------- Phase F: Seed ----------
phase('F-Seed')
const f = await agent(
  `${COMMON}
PHASE F — Seed-Import. Lies zuerst: data/source-registry.seed.yaml (Felder je Eintrag: id 'src-NNN', title, publisher, official_url, source_type, trust_level, subject, school_form, grade_range, version_or_date, license_or_terms, license_verified, retrieved_at, content_hash, status, notes), src/lib/db/schema/artifacts.ts (sourceRef), src/lib/db/client.ts, package.json.

1) scripts/seed-sources.ts (mit tsx ausfuehrbar): liest die YAML via js-yaml, mappt jeden Eintrag auf einen sourceRef-Insert:
   - lifecycleStatus = "DISCOVERED"; contentHash = null; licenseVerified = false (Seed-Werte sind alle candidate/false).
   - sourceType-Mapping: trust_level "official" + source_type in {framework,law,curriculum} -> "OFFICIAL_BINDING"; source_type "guidance" -> "OFFICIAL_GUIDANCE"; sonst -> "UNVERIFIED".
   - subjectAlignment-Mapping: NUR wenn subject in {DEUTSCH,RELIGION,ETHIK} -> dieser Wert; alles andere (z.B. DATENSCHUTZ) -> null. confessionContext bleibt null (Seed traegt keine Konfession).
   - title=title; uri=official_url; authorOrganization=publisher; licenseInfo=license_or_terms; approvalMetadata = { sourceSeedId: id, schoolForm: school_form, gradeRange: grade_range, sourceType: source_type, versionOrDate: version_or_date, status: status }.
   - IDEMPOTENT: vor Insert pruefen, ob bereits ein sourceRef mit approvalMetadata->>'sourceSeedId' = id existiert; wenn ja, ueberspringen (oder Felder aktualisieren). Kein Duplikat bei zweitem Lauf.
   - Nutzt den db-Client; loggt Anzahl inserted/skipped; schliesst die Verbindung am Ende.
2) package.json: script "db:seed": "tsx scripts/seed-sources.ts" ergaenzen.

Verifikation: cd ${ROOT} && pnpm typecheck. success=true nur wenn gruen. (Kein DB-Lauf hier — das macht Phase H/I.) In notes: bestaetige die Idempotenz-Strategie (Dedup-Key sourceSeedId).`,
  { label: 'F:seed', phase: 'F-Seed', model: 'haiku', effort: 'medium', schema: RESULT },
)

// ---------- Phase G: Docs & ADR (unabhaengig) ----------
phase('G-Docs')
const g = await agent(
  `${COMMON}
PHASE G — Doku & ADR. Lies zuerst ein bestehendes ADR (docs/adr/0008-*.md) fuer das Format und docs/rag/INGESTION_POLICY.md (Abschnitt "5. Embedding und Ingestierung in Qdrant").

1) docs/adr/0010-rag-ingestion-qdrant.md (Format wie bestehende ADRs, Status "Akzeptiert", Datum 2026-06-22):
   - Context: M2 Schritt 1 Geruest braucht eine Vektorraum-Strategie.
   - Decision: EINE Qdrant-Collection "ua_lsa_chunks" mit harten Payload-Filtern (trust_level, subject, confession_context) statt separater Collections pro Fach/Konfession. Local-first Embedding via Ollama (qwen3-embedding:4b), kein Cloud-Pfad. Textextraktion fuer Schritt 1: text/plain/html + pdf-parse; OCR (Scan-PDFs) ausgenommen -> M2.4.
   - Consequences: Konfessionstrennung wird serverseitig durch Pflicht-Payload-Filter erzwungen (kein Cross-Strang-Retrieval); Scan-PDFs scheitern fail-laut bis OCR-Worker; Re-Embedding bei Modellwechsel noetig (Dim-Abhaengigkeit).
2) docs/rag/INGESTION_POLICY.md und docs/architecture/RAG_ARCHITECTURE.md: am passenden Abschnitt einen kurzen Satz ergaenzen, dass fuer Schritt 1 EINE Collection + Payload-Filter gilt (Verweis: ADR 0010).
3) CLAUDE.md und AGENTS.md: die Projektstatus-Zeile aktualisieren auf "M2 Schritt 1 (Quellen-RAG-Geruest) umgesetzt (Branch m2/rag-geruest)" — knapp, ohne den restlichen Text zu zerstoeren.

Verifikation: cd ${ROOT} && pnpm verify:docs && pnpm format:check. success=true nur wenn beide gruen (ggf. pnpm format laufen lassen, damit format:check gruen wird).`,
  { label: 'G:docs+adr', phase: 'G-Docs', model: 'haiku', effort: 'medium', schema: RESULT },
)

// ---------- Phase H: Tests (paralleler Fan-out, unabhaengige Dateien) ----------
phase('H-Tests')
const TESTS = [
  {
    file: 'src/lib/db/__tests__/source-lifecycle.test.ts',
    model: 'sonnet',
    brief: `Testet PgSourcesRepository-Lebenszyklus + Trust-Gate + Konfessions-CHECK gegen die echte Test-DB (Testcontainers, global-setup laeuft automatisch). Lies src/lib/db/repositories/sources.pg.ts, factory.ts, src/lib/db/schema/artifacts.ts und das Muster in src/lib/db/__tests__/curriculum-constraints.test.ts (Verbindungsaufbau, file-unique user-id/email). Faelle: (a) DISCOVERED->REGISTERED->APPROVE schlaegt fehl ohne licenseVerified; (b) mit licenseVerified=true + sourceType!=UNVERIFIED -> APPROVED ok; (c) UNVERIFIED kann nie APPROVED werden (wirft); (d) DB-CHECK: INSERT source_ref mit subjectAlignment=RELIGION + confessionContext=NICHT_ANWENDBAR wird abgelehnt; mit confessionContext=EVANGELISCH akzeptiert; (e) subjectAlignment=DEUTSCH + confessionContext=KATHOLISCH abgelehnt. Nutze REPOSITORY_BACKEND=db Pfad bzw. direkten db-Insert. file-unique ids.`,
  },
  {
    file: 'src/lib/db/__tests__/rag-chunk.test.ts',
    model: 'haiku',
    brief: `Testet rag_chunk gegen die Test-DB. Lies src/lib/db/schema/rag.ts und das Muster in src/lib/db/__tests__/curriculum-constraints.test.ts. Faelle: Insert eines gueltigen rag_chunk (benoetigt zuerst einen sourceRef-Insert, file-unique user/owner); Unique-Verletzung bei gleichem (sourceRefId,contentHash,sourceVersion) wirft; chunkText < 50 Zeichen wird vom CHECK abgelehnt. file-unique ids.`,
  },
  {
    file: 'src/lib/rag/__tests__/ingest.test.ts',
    model: 'sonnet',
    brief: `Testet ingestSource mit FakeEmbedder + FakeVectorStore + echter Test-DB. Lies src/lib/rag/ingest.ts, src/lib/infra/{ollama,qdrant,minio}.ts, src/lib/db/repositories/sources.pg.ts. NEGATIV: eine Quelle in Status REGISTERED (nicht APPROVED) bzw. sourceType UNVERIFIED -> ingestSource wirft; danach assert: FakeVectorStore hat 0 Punkte UND 0 rag_chunk-Rows. POSITIV: eine APPROVED-Quelle (licenseVerified=true, sourceType=OFFICIAL_BINDING) mit synthetischem Text (>150 Zeichen, plain) -> ingestSource erfolgreich; assert: FakeVectorStore-Punkte > 0 mit payload.trust_level==='OFFICIAL_BINDING'; rag_chunk-Rows > 0; sourceRef.lifecycleStatus==='INGESTED'. Fuer blob/uri: BlobStore-Fake oder direkten Text-Pfad nutzen. file-unique ids.`,
  },
  {
    file: 'src/lib/rag/__tests__/chunk.test.ts',
    model: 'haiku',
    brief: `Reine Unit-Tests fuer chunkText (kein DB/Docker). Lies src/lib/rag/chunk.ts. Pruefe: deterministische Chunk-Anzahl bei bekanntem Input; Overlap stimmt; jeder Chunk (ausser evtl. letzter Merge) hat pageOrSection; leerer Input -> leeres Array.`,
  },
  {
    file: 'src/lib/infra/__tests__/qdrant.test.ts',
    model: 'haiku',
    brief: `Unit-Tests fuer FakeVectorStore-Filterlogik (kein Docker). Lies src/lib/infra/qdrant.ts. Pruefe: upsert + search mit Filter trustLevelNot="UNVERIFIED" gibt nur Punkte mit payload.trust_level!=="UNVERIFIED" zurueck; confessionContextIn-Filter wirkt; deleteByFilter entfernt passende. (Echter QdrantStore-Contract-Test nur wenn process.env.QDRANT_TEST==="1" — sonst describe.skip.)`,
  },
  {
    file: 'scripts/__tests__/seed-sources.test.ts',
    model: 'haiku',
    brief: `Testet Idempotenz des Seeds gegen die Test-DB. Lies scripts/seed-sources.ts. Falls die Seed-Logik in einer importierbaren Funktion liegt, importiere sie; sonst exportiere eine runSeed(db)-Funktion aus dem Skript (kleine Refaktorierung erlaubt: Skript-Main ruft runSeed). Pruefe: runSeed zweimal nacheinander -> Anzahl source_ref-Rows mit gesetztem sourceSeedId bleibt nach 2. Lauf gleich (keine Dupes). file-unique falls user noetig.`,
  },
]
const h = await parallel(
  TESTS.map((t) => () =>
    agent(
      `${COMMON}
PHASE H — Testdatei schreiben: ${t.file}. Implementierung ist bereits fertig + committet; schreibe NUR diese eine neue Testdatei, fuehre KEINE Tests aus (das macht Phase I global, geteilte DB vertraegt keine parallelen Laeufe). Lies die genannten Quelldateien, um die echten Signaturen zu treffen — keine erfundenen APIs. Assertions muessen die bindenden Garantien ECHT pruefen (nicht abschwaechen, damit es gruen wird).
Aufgabe: ${t.brief}`,
      { label: `H:${t.file.split('/').pop()}`, phase: 'H-Tests', model: t.model, effort: 'medium', schema: RESULT },
    ),
  ),
)

// ---------- Phase I: Gates ----------
phase('I-Gates')
const i = await agent(
  `${COMMON}
PHASE I — Volle Verifikations-Gates. Fuehre der Reihe nach aus (cd ${ROOT}), jeweils Ergebnis festhalten, langer Timeout fuer build/test:
  pnpm db:check
  pnpm lint
  pnpm format:check
  pnpm typecheck
  pnpm build
  node scripts/check-schema-drift.mjs
  pnpm verify:docs
  pnpm test   (benoetigt Docker fuer Postgres-Testcontainer; Timeout grosszuegig ~600s)
Wenn pnpm test scheitert oder Docker nicht verfuegbar ist: NICHT verschleiern — exakt berichten welche Suiten/Faelle rot sind (oder dass Docker fehlt) und die letzten relevanten Fehlerzeilen in notes aufnehmen. Wenn ein schnell behebbarer Fehler auftritt (Lint-Autofix, fehlender Import, Format), behebe ihn und laufe das betroffene Gate erneut — aber schwaeche KEINE Test-Assertion ab und kommentiere keinen Test aus.
verification: tabellarisch je Gate PASS/FAIL. success=true NUR wenn db:check, lint, format:check, typecheck, build, check-schema-drift, verify:docs ALLE gruen sind UND pnpm test entweder gruen ist oder ausschliesslich wegen fehlendem Docker nicht lief (dann blockers="docker nicht verfuegbar fuer pnpm test"). Jeder echte Testfehler => success=false.`,
  { label: 'I:gates', phase: 'I-Gates', model: 'sonnet', effort: 'high', schema: RESULT },
)

// ---------- Review: adversariale Verifikation der bindenden Garantien ----------
phase('Review')
const REVIEWS = [
  {
    dim: 'trust-gate-fail-closed',
    prompt: `Pruefe ADVERSARIAL: Ist das Trust-Gate wirklich fail-closed? Lies src/lib/db/repositories/sources.pg.ts (approve/ingestMark) und src/lib/rag/ingest.ts (Gate). Suche nach Wegen, eine UNVERIFIED- oder nicht-APPROVED- oder licenseVerified=false-Quelle doch zu ingesten/approven (fehlende Statuspruefung, Reihenfolge, Default-Werte, Race). Lies auch den zugehoerigen Test src/lib/rag/__tests__/ingest.test.ts und source-lifecycle.test.ts — pruefen die Tests das echt oder sind sie aufgeweicht? pass=true nur wenn fail-closed lueckenlos UND von Tests echt abgesichert.`,
  },
  {
    dim: 'konfessions-check',
    prompt: `Pruefe ADVERSARIAL den Konfessions-CHECK. Lies src/lib/db/schema/artifacts.ts (source_confession_subject_valid) und vergleiche mit curriculum.ts (confession_subject_valid) und der Invariante (RELIGION OHNE RELIGIONSKUNDLICH; ETHIK={RELIGIONSKUNDLICH,NICHT_ANWENDBAR}; DEUTSCH=NICHT_ANWENDBAR). Stimmt die SQL exakt? Greift der NULL-Guard (subject_alignment IS NULL erlaubt)? Pruefe die generierte Migration drizzle/*.sql, dass der CHECK auch wirklich erzeugt wurde. pass=true nur bei exakter Konsistenz.`,
  },
  {
    dim: 'migration-add-only',
    prompt: `Pruefe die NEUE Migration in drizzle/ (die juengste *.sql, nicht 0000): Enthaelt sie ausschliesslich CREATE TYPE/TABLE/INDEX, ALTER TABLE ADD COLUMN/ADD CONSTRAINT, ALTER COLUMN DROP NOT NULL, DROP CONSTRAINT? Gibt es irgendein DML DELETE oder UPDATE (das CI flaggen wuerde, ADR 0005)? Laeuft node scripts/check-schema-drift.mjs / pnpm db:check sauber? Liste jede Zeile mit DELETE/UPDATE als blocker. pass=true nur wenn keine DML-DELETE/UPDATE.`,
  },
  {
    dim: 'ingest-transaktion-kompensation',
    prompt: `Pruefe ADVERSARIAL die Ingestion-Atomaritaet. Lies src/lib/rag/ingest.ts: Ist der rag_chunk-Insert in einer DB-Transaktion? Wird bei PG-Fehler nach erfolgtem Qdrant-Upsert wirklich deleteBySource (Kompensation) aufgerufen, sodass keine verwaisten Qdrant-Punkte bleiben? Wird contentHash via sha256 gesetzt? Wird lifecycleStatus erst nach Erfolg auf INGESTED gesetzt? Nenne jede Inkonsistenz. pass=true nur wenn Transaktion + Kompensation korrekt.`,
  },
]
const reviews = await parallel(
  REVIEWS.map((r) => () =>
    agent(
      `${COMMON}
ROLLE: adversarialer Reviewer. Du aenderst NICHTS, du pruefst nur und meldest Befunde. Standardannahme: skeptisch. ${r.prompt}`,
      { label: `review:${r.dim}`, phase: 'Review', model: 'sonnet', effort: 'high', schema: VERDICT },
    ),
  ),
)

return {
  branch: 'm2/rag-geruest',
  phases: { deps, a, b, c, d, e, f, g, tests: h, gates: i },
  reviews,
}
