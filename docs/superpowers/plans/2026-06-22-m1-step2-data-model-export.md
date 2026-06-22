# M1 Step 2 — Datenmodell + Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die persistente Datenschicht (PostgreSQL + Drizzle) für die Unterrichtsartefakte samt Curriculum-Topologie, Auth/Mandant, Provenienz/Audit und das DOCX/PDF-Export-Subsystem aufbauen — als reale Backings für die bereits existierenden UI-Repository-Verträge.

**Architecture:** Modularer Monolith (Next.js App Router). Neue Schicht `src/lib/db` (Drizzle-Schema + SQL-Migrationen + Postgres-Client), `src/lib/auth` (Better Auth, ADR 0007), `src/lib/export` (Format-Abstraktion `exportArtifact`, ADR 0008). Konfessionstrennung wird auf DB-Ebene per CHECK-Constraint am `curriculum_strand` erzwungen; Artefakte erben Konfession über `strand_id`. Bestehende `src/lib/repositories.ts`-Interfaces bekommen Postgres-Implementierungen hinter einer Factory (mock ↔ db per ENV); die UI bleibt unverändert.

**Tech Stack:** Drizzle ORM + `drizzle-kit`, `postgres` (postgres-js), Better Auth (+ Drizzle-Adapter), `docx`, `pdfkit`, Vitest (+ `@testcontainers/postgresql` für CI-DB-Tests). PostgreSQL 16 (compose.yaml).

## Global Constraints

- **Paketmanager: `pnpm`** — niemals npm/yarn. Neue Deps via `pnpm add` / `pnpm add -D`.
- **TypeScript strict** — keine `any`, keine non-null-Assertions ohne Begründung; Drizzle-Inferenz nutzen.
- **Keine echten Schülerdaten/Secrets** committen. `.env` bleibt gitignored; nur `.env.example` pflegen.
- **`SENSITIVE_STUDENT` ist NICHT Teil dieses Plans** — `student_submission`, `correction_draft`, `pseudonym_mappings` gehören zu M3. Hier nur `PUBLIC`/`INTERNAL` Artefakte.
- **Konfessionstrennung ist nicht verhandelbar** — DB-CHECK am `curriculum_strand`, kein Cross-Strang-Retrieval. Religion ev./kath./konfessionssensibel-übergreifend strikt getrennt; Ethik eigenes `subject`.
- **Menschliche Letztentscheidung** — keine Bewertungs-Auto-Übernahme; in M1 nicht berührt (CorrectionDraft = M3), aber Invariante im Hinterkopf behalten.
- **Local-first** — kein Cloud-LLM; Export ist rein lokal/serverseitig, nur MIT-Abhängigkeiten (`docx`, `pdfkit`).
- **ADR-Treue** — Drizzle (0005), Better Auth single-tenant org-ready (0007, akzeptiert), docx+pdfkit hinter Format-Abstraktion (0008, akzeptiert), Curriculum-Modell (0006).
- **Vor jedem Commit:** `git diff --check`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm build` — zusätzlich neu: `pnpm test`.
- **Migrations-Reviewpflicht (ADR 0005):** jede `.sql`-Migration im PR reviewen; `DELETE`/`UPDATE` werden im CI markiert. Löschungen nur über benannte Repository-Methoden.

---

## Kanonische Enum-Werte (verbatim aus DATA_MODEL.md)

- `Subject`: `DEUTSCH`, `RELIGION`, `ETHIK`
- `ConfessionContext`: `EVANGELISCH`, `KATHOLISCH`, `KONFESSIONSSENSIBEL_UEBERGREIFEND`, `RELIGIONSKUNDLICH`, `NICHT_ANWENDBAR`
- `SchoolForm`: `GESAMTSCHULE`, `GEMEINSCHAFTSSCHULE`
- `EducationTrack`: `HAUPTSCHULBILDUNGSGANG`, `REALSCHULBILDUNGSGANG`, `GYMNASIALER_BILDUNGSGANG`
- `SchoolStage`: `SEK_I`, `SEK_II`
- `GradeBand` (MVP nur Sek I): `KS5`, `KS6`, `KS7`, `KS8`, `KS9`, `KS10` — Sek-II-Kurshalbjahre (`Q1_HJ1` …) erst, wenn Sek II in Scope kommt (ADR 0006: MVP nur Sek I), per späterer Migration.
- `DataClass`: `PUBLIC`, `INTERNAL`, `PERSONAL_TEACHER`, `SENSITIVE_STUDENT`
- `SourceTrust`: `OFFICIAL_BINDING`, `OFFICIAL_GUIDANCE`, `OPEN_CURATED`, `USER_APPROVED`, `UNVERIFIED`
- `TaskType`: `MULTIPLE_CHOICE`, `SHORT_ANSWER`, `ESSAY`, `STRUCTURED_REASONING`, `MEDIA_ANALYSIS`
- `Difficulty`: `EASY`, `MEDIUM`, `HARD`

**Konfessions-Invariante (DB-CHECK am `curriculum_strand`):**
- `RELIGION` ⟹ confession ∈ {`EVANGELISCH`,`KATHOLISCH`,`KONFESSIONSSENSIBEL_UEBERGREIFEND`}
- `ETHIK` ⟹ confession ∈ {`RELIGIONSKUNDLICH`,`NICHT_ANWENDBAR`}
- `DEUTSCH` ⟹ confession = `NICHT_ANWENDBAR`

---

## File Structure

```
drizzle.config.ts                 # drizzle-kit Konfiguration (Migrationen → ./drizzle)
vitest.config.ts                  # Vitest, Node-Env, globalSetup für Test-DB
drizzle/                          # generierte SQL-Migrationen (reviewpflichtig)
src/lib/db/
  client.ts                       # postgres-js + drizzle() Singleton, liest DATABASE_URL
  enums.ts                        # alle pgEnum-Definitionen (eine Quelle)
  columns.ts                      # gemeinsame Artefakt-Spalten (ownerTeacherId, dataClass, timestamps, version, deletedAt)
  schema/
    index.ts                      # re-export aller Tabellen (drizzle-kit Eingang)
    auth.ts                       # Better-Auth-Tabellen (user, session, account, verification) — via CLI generiert
    tenant.ts                     # school (Mandant), teacher_profile
    curriculum.ts                 # curriculum_strand (+ CHECKs), curriculum_node (+ Baum-Invariante)
    artifacts.ts                  # teaching_unit, lesson, worksheet, task, expectation_horizon, rubric, rubric_criterion, source_ref, join-Tabellen
    provenance.ts                 # generation_provenance, audit_log
  repositories/
    factory.ts                    # mock ↔ db Auswahl per ENV (REPOSITORY_BACKEND)
    planning.pg.ts                # PlanningRepository (Postgres)
    sources.pg.ts                 # SourcesRepository (Postgres)
    mapping.ts                    # Persistenz-Modell ↔ UI-Subject-Union Mapping
  __tests__/
    curriculum-constraints.test.ts
    artifacts-softdelete.test.ts
    provenance.test.ts
    mapping.test.ts
src/lib/auth/
  auth.ts                         # Better-Auth-Serverinstanz (Drizzle-Adapter, single-tenant)
  index.ts                        # Auth-Abstraktion (getCurrentTeacher, requireRole) — kapselt Better Auth
src/lib/export/
  index.ts                        # exportArtifact(artifact, format) Format-Abstraktion
  types.ts                        # ExportFormat, ExportableWorksheet, ExportResult, SourceCitation
  docx-renderer.ts                # docx-Renderer
  pdf-renderer.ts                 # pdfkit-Renderer
  footer.ts                       # Quellen-/Lizenz-Footer (license + derivation_source + SourceRefs)
  __tests__/
    export.test.ts
scripts/
  check-schema-drift.mjs          # CI: Schema vs. Migrationen (drizzle-kit check)
```

**Bestehende Struktur (CRG-bestätigt):** Es gibt bisher nur UI-/Mock-Communities; `src/lib/types.ts`, `src/lib/repositories.ts`, `src/lib/mock/*` bleiben bestehen. Die UI greift weiter über die Interfaces zu — diese Tasks fügen nur Implementierungen + Schema additiv hinzu.

---

### Task 0: Tooling-Fundament (Deps, Drizzle/Vitest-Config, ENV, ADR-Status)

**Files:**
- Modify: `package.json` (Deps + Scripts)
- Create: `drizzle.config.ts`
- Create: `vitest.config.ts`
- Create: `src/lib/db/client.ts`
- Modify: `.env.example` (DATABASE_URL, REPOSITORY_BACKEND, BETTER_AUTH_SECRET)
- Modify: `docs/adr/0007-auth-solution.md` (Status → Akzeptiert)
- Modify: `docs/adr/0008-document-export-stack.md` (Status → Akzeptiert)

**Interfaces:**
- Produces: `db` (Drizzle-Client) aus `src/lib/db/client.ts`; npm-Script `pnpm test`, `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:check`.

- [ ] **Step 1: Dependencies installieren**

```bash
pnpm add drizzle-orm postgres better-auth docx pdfkit
pnpm add -D drizzle-kit vitest @testcontainers/postgresql @types/pdfkit dotenv
```

- [ ] **Step 2: package.json-Scripts ergänzen**

In `package.json` unter `"scripts"` einfügen (vorhandene Skripte nicht entfernen):

```json
"test": "vitest run",
"test:watch": "vitest",
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:check": "drizzle-kit check"
```

- [ ] **Step 3: drizzle.config.ts anlegen**

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://ua_lsa:change-me-locally@localhost:5432/ua_lsa",
  },
  strict: true,
  verbose: true,
});
```

- [ ] **Step 4: src/lib/db/client.ts anlegen**

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://ua_lsa:change-me-locally@localhost:5432/ua_lsa";

// Eine Verbindung pro Prozess; max niedrig halten (self-hosted Schulnetz).
const queryClient = postgres(connectionString, { max: 10 });

export const db = drizzle(queryClient, { schema });
export type Db = typeof db;
```

- [ ] **Step 5: vitest.config.ts anlegen**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
    globalSetup: "./src/lib/db/__tests__/global-setup.ts",
    testTimeout: 60_000, // Testcontainers-Start
    fileParallelism: false, // gemeinsame Test-DB
  },
});
```

- [ ] **Step 6: .env.example ergänzen** (nur Variablennamen, keine echten Secrets)

```
# --- Datenbank (Drizzle) ---
DATABASE_URL=postgres://ua_lsa:change-me-locally@localhost:5432/ua_lsa
# Repository-Backend: "mock" (Default, UI-Shell) oder "db"
REPOSITORY_BACKEND=mock
# --- Auth (Better Auth, ADR 0007) ---
BETTER_AUTH_SECRET=change-me-locally
BETTER_AUTH_URL=http://localhost:3000
```

- [ ] **Step 7: ADR 0007 & 0008 auf Akzeptiert heben**

In `docs/adr/0007-auth-solution.md` und `docs/adr/0008-document-export-stack.md` den Status-Block ersetzen:

```markdown
## Status

**Akzeptiert, 2026-06-22** — vom Maintainer im Review angenommen.
0007: Better Auth, single-tenant MVP (org-ready vorbereitet, Mandantentrennung später, Zitadel als Migrationspfad).
0008: docx (DOCX) + pdfkit (PDF) hinter Format-Abstraktion; nur MIT-Abhängigkeiten.
```

- [ ] **Step 8: Verifizieren**

Run: `pnpm install && pnpm typecheck`
Expected: PASS (Client kompiliert; Schema-Import noch leer — Task 1 füllt ihn).

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml drizzle.config.ts vitest.config.ts src/lib/db/client.ts .env.example docs/adr/0007-auth-solution.md docs/adr/0008-document-export-stack.md
git commit -m "chore(m1): drizzle+vitest+auth/export deps, ADR 0007/0008 akzeptiert"
```

---

### Task 1: Enums + gemeinsame Spalten + Schema-Index

**Files:**
- Create: `src/lib/db/enums.ts`
- Create: `src/lib/db/columns.ts`
- Create: `src/lib/db/schema/index.ts`

**Interfaces:**
- Produces: alle `pgEnum`-Objekte; `artifactColumns` (Spalten-Spread); `schema/index.ts` re-exportiert alles.

- [ ] **Step 1: src/lib/db/enums.ts**

```ts
import { pgEnum } from "drizzle-orm/pg-core";

export const subjectEnum = pgEnum("subject", ["DEUTSCH", "RELIGION", "ETHIK"]);
export const confessionContextEnum = pgEnum("confession_context", [
  "EVANGELISCH",
  "KATHOLISCH",
  "KONFESSIONSSENSIBEL_UEBERGREIFEND",
  "RELIGIONSKUNDLICH",
  "NICHT_ANWENDBAR",
]);
export const schoolFormEnum = pgEnum("school_form", ["GESAMTSCHULE", "GEMEINSCHAFTSSCHULE"]);
export const educationTrackEnum = pgEnum("education_track", [
  "HAUPTSCHULBILDUNGSGANG",
  "REALSCHULBILDUNGSGANG",
  "GYMNASIALER_BILDUNGSGANG",
]);
export const schoolStageEnum = pgEnum("school_stage", ["SEK_I", "SEK_II"]);
export const gradeBandEnum = pgEnum("grade_band", ["KS5", "KS6", "KS7", "KS8", "KS9", "KS10"]);
export const dataClassEnum = pgEnum("data_class", [
  "PUBLIC",
  "INTERNAL",
  "PERSONAL_TEACHER",
  "SENSITIVE_STUDENT",
]);
export const sourceTrustEnum = pgEnum("source_trust", [
  "OFFICIAL_BINDING",
  "OFFICIAL_GUIDANCE",
  "OPEN_CURATED",
  "USER_APPROVED",
  "UNVERIFIED",
]);
export const curriculumStatusEnum = pgEnum("curriculum_status", ["DRAFT", "ACTIVE", "RETIRED"]);
export const teachingUnitStatusEnum = pgEnum("teaching_unit_status", ["DRAFT", "ACTIVE", "ARCHIVED"]);
export const taskTypeEnum = pgEnum("task_type", [
  "MULTIPLE_CHOICE",
  "SHORT_ANSWER",
  "ESSAY",
  "STRUCTURED_REASONING",
  "MEDIA_ANALYSIS",
]);
export const difficultyEnum = pgEnum("difficulty", ["EASY", "MEDIUM", "HARD"]);
export const rubricScopeEnum = pgEnum("rubric_scope", ["UNIT", "TASK"]);
export const rubricScaleEnum = pgEnum("rubric_scale_type", ["ANALYTIC", "HOLISTIC"]);
export const generationArtifactTypeEnum = pgEnum("generation_artifact_type", [
  "TEACHING_UNIT",
  "LESSON",
  "WORKSHEET",
  "TASK",
  "EXPECTATION_HORIZON",
  "RUBRIC",
  "CORRECTION_DRAFT",
  "STUDENT_FEEDBACK",
]);
export const auditSeverityEnum = pgEnum("audit_severity", ["info", "warning", "error", "critical"]);
```

- [ ] **Step 2: src/lib/db/columns.ts (gemeinsame Artefakt-Spalten)**

```ts
import { integer, timestamp } from "drizzle-orm/pg-core";
import { dataClassEnum } from "./enums";

/**
 * Konventionelle Felder aller Unterrichtsartefakte (DATA_MODEL.md §Unterrichtsartefakte):
 * Soft-Delete + Optimistic-Lock-Version + Audit-Timestamps.
 * `ownerTeacherId` wird je Tabelle gesetzt (FK → user.id, Task 2).
 */
export const artifactTimestamps = {
  dataClass: dataClassEnum("data_class").notNull().default("INTERNAL"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
};
```

- [ ] **Step 3: src/lib/db/schema/index.ts (zunächst Re-Export der Auth/Tenant-Platzhalter folgt in späteren Tasks)**

```ts
export * from "./auth";
export * from "./tenant";
export * from "./curriculum";
export * from "./artifacts";
export * from "./provenance";
```

> Hinweis: `index.ts` referenziert Dateien aus Tasks 2–5. Lege beim Bearbeiten dieses Tasks leere Stub-Dateien (`export {};`) für `auth.ts`, `tenant.ts`, `curriculum.ts`, `artifacts.ts`, `provenance.ts` an, damit `pnpm typecheck` grün bleibt; die folgenden Tasks füllen sie.

- [ ] **Step 4: Verifizieren** — Run: `pnpm typecheck` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/enums.ts src/lib/db/columns.ts src/lib/db/schema/
git commit -m "feat(m1): pg-enums + gemeinsame Artefakt-Spalten + Schema-Index"
```

---

### Task 2: Auth + Mandant (Better Auth, school, teacher_profile)

**Files:**
- Create: `src/lib/db/schema/auth.ts` (via Better-Auth-CLI generiert)
- Create: `src/lib/db/schema/tenant.ts`
- Create: `src/lib/auth/auth.ts`
- Create: `src/lib/auth/index.ts`

**Interfaces:**
- Produces: `user` (Better-Auth-Tabelle, `id` text PK), `school`, `teacherProfile`; `auth` (Server), `getCurrentTeacher()`, `requireRole(role)`.

- [ ] **Step 1: Better-Auth-Serverinstanz (src/lib/auth/auth.ts)**

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db/client";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  // Single-tenant MVP: keine Organization-Plugins aktiv, aber Schema org-ready (school/teacher_profile).
});

export type Session = typeof auth.$Infer.Session;
```

- [ ] **Step 2: Auth-Schema generieren**

Run: `pnpm dlx @better-auth/cli generate --output src/lib/db/schema/auth.ts`
Expected: Datei mit `user`, `session`, `account`, `verification` (Drizzle-pg-Tabellen). `user.id` ist `text` PK.

- [ ] **Step 3: src/lib/db/schema/tenant.ts**

```ts
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

/** Schule = Mandant. MVP single-tenant, aber als Tabelle vorhanden (org-ready, ADR 0007). */
export const school = pgTable("school", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Verknüpft Better-Auth-User mit Schule + Rolle. */
export const teacherProfile = pgTable("teacher_profile", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => school.id, { onDelete: "restrict" }),
  role: text("role", { enum: ["LEHRKRAFT", "ADMIN"] }).notNull().default("LEHRKRAFT"),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 4: Auth-Abstraktion (src/lib/auth/index.ts)** — kapselt Better Auth, damit ein späterer Zitadel-Wechsel lokal bleibt.

```ts
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { teacherProfile } from "@/lib/db/schema/tenant";

export interface CurrentTeacher {
  userId: string;
  schoolId: string;
  role: "LEHRKRAFT" | "ADMIN";
  displayName: string;
}

/** Lädt das Teacher-Profil zu einem authentifizierten User. Null, wenn keins existiert. */
export async function getCurrentTeacher(userId: string): Promise<CurrentTeacher | null> {
  const [row] = await db
    .select()
    .from(teacherProfile)
    .where(eq(teacherProfile.userId, userId))
    .limit(1);
  if (!row) return null;
  return { userId: row.userId, schoolId: row.schoolId, role: row.role, displayName: row.displayName };
}

export function requireRole(teacher: CurrentTeacher, role: CurrentTeacher["role"]): void {
  if (teacher.role !== role && teacher.role !== "ADMIN") {
    throw new Error(`Rolle ${role} erforderlich`);
  }
}
```

- [ ] **Step 5: Migration generieren + verifizieren**

Run: `pnpm db:generate` (erzeugt `drizzle/0000_*.sql` mit user/session/account/verification/school/teacher_profile)
Run: `pnpm typecheck` → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/ src/lib/db/schema/auth.ts src/lib/db/schema/tenant.ts drizzle/
git commit -m "feat(m1): Better Auth (single-tenant) + school/teacher_profile + Auth-Abstraktion"
```

---

### Task 3: Curriculum-Schema (Strang + Knoten, Konfessions-CHECK, Baum-Invariante)

**Files:**
- Create: `src/lib/db/schema/curriculum.ts`
- Create: `src/lib/db/__tests__/global-setup.ts`
- Create: `src/lib/db/__tests__/curriculum-constraints.test.ts`

**Interfaces:**
- Consumes: Enums (Task 1).
- Produces: `curriculumStrand`, `curriculumNode`.

- [ ] **Step 1: src/lib/db/schema/curriculum.ts**

```ts
import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import {
  confessionContextEnum,
  curriculumStatusEnum,
  educationTrackEnum,
  gradeBandEnum,
  schoolFormEnum,
  schoolStageEnum,
  subjectEnum,
} from "../enums";

export const curriculumStrand = pgTable(
  "curriculum_strand",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subject: subjectEnum("subject").notNull(),
    confessionContext: confessionContextEnum("confession_context").notNull(),
    schoolForm: schoolFormEnum("school_form"),
    educationTrack: educationTrackEnum("education_track"),
    schoolStage: schoolStageEnum("school_stage").notNull(),
    frameworkAuthority: text("framework_authority").notNull(),
    validFrom: date("valid_from").notNull(),
    validTo: date("valid_to"),
    version: text("version").notNull(), // SemVer des Lehrplans
    supersedesId: uuid("supersedes_id"),
    status: curriculumStatusEnum("status").notNull().default("DRAFT"),
  },
  (t) => [
    // Konfessions-Invariante (DATA_MODEL.md): subject ⟹ erlaubte confessionContexts
    check(
      "confession_subject_valid",
      sql`(
        (${t.subject} = 'RELIGION' AND ${t.confessionContext} IN ('EVANGELISCH','KATHOLISCH','KONFESSIONSSENSIBEL_UEBERGREIFEND'))
        OR (${t.subject} = 'ETHIK' AND ${t.confessionContext} IN ('RELIGIONSKUNDLICH','NICHT_ANWENDBAR'))
        OR (${t.subject} = 'DEUTSCH' AND ${t.confessionContext} = 'NICHT_ANWENDBAR')
      )`,
    ),
    // Schulform/Bildungsgang nur bei Sek I
    check(
      "form_track_only_sek_i",
      sql`(${t.schoolStage} = 'SEK_I') OR (${t.schoolForm} IS NULL AND ${t.educationTrack} IS NULL)`,
    ),
    // Bildungsgang setzt Schulform voraus
    check(
      "track_requires_form",
      sql`${t.educationTrack} IS NULL OR ${t.schoolForm} IS NOT NULL`,
    ),
    foreignKey({ columns: [t.supersedesId], foreignColumns: [t.id], name: "strand_supersedes_fk" }),
    unique("strand_id_unique").on(t.id),
  ],
);

export const curriculumNode = pgTable(
  "curriculum_node",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    strandId: uuid("strand_id")
      .notNull()
      .references(() => curriculumStrand.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    gradeBand: gradeBandEnum("grade_band"),
    code: text("code").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    competenceArea: text("competence_area"),
  },
  (t) => [
    // Code eindeutig pro Strang
    unique("node_code_per_strand").on(t.strandId, t.code),
    // Für Composite-FK: (id, strand_id) eindeutig
    unique("node_id_strand").on(t.id, t.strandId),
    // Baum-Invariante: parent muss im SELBEN Strang liegen (Composite-FK statt Trigger)
    foreignKey({
      columns: [t.parentId, t.strandId],
      foreignColumns: [t.id, t.strandId],
      name: "node_parent_same_strand_fk",
    }).onDelete("cascade"),
  ],
);
```

- [ ] **Step 2: Test-DB-Setup (src/lib/db/__tests__/global-setup.ts)** — startet Postgres via Testcontainers und migriert.

```ts
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

let container: StartedPostgreSqlContainer;

export async function setup() {
  container = await new PostgreSqlContainer("postgres:16").start();
  const url = container.getConnectionUri();
  process.env.DATABASE_URL = url;
  const client = postgres(url, { max: 1 });
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  await client.end();
}

export async function teardown() {
  await container?.stop();
}
```

- [ ] **Step 3: Failing test (curriculum-constraints.test.ts)**

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { curriculumStrand } from "@/lib/db/schema/curriculum";

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client);

afterAll(async () => {
  await client.end();
});

describe("Konfessions-CHECK am curriculum_strand", () => {
  it("lehnt 'katholischen Deutschunterricht' ab", async () => {
    await expect(
      db.insert(curriculumStrand).values({
        subject: "DEUTSCH",
        confessionContext: "KATHOLISCH",
        schoolStage: "SEK_I",
        frameworkAuthority: "Test",
        validFrom: "2024-08-01",
        version: "1.0.0",
      }),
    ).rejects.toThrow();
  });

  it("akzeptiert evangelische Religion", async () => {
    const [row] = await db
      .insert(curriculumStrand)
      .values({
        subject: "RELIGION",
        confessionContext: "EVANGELISCH",
        schoolStage: "SEK_I",
        schoolForm: "GESAMTSCHULE",
        educationTrack: "GYMNASIALER_BILDUNGSGANG",
        frameworkAuthority: "Kultusministerium LSA",
        validFrom: "2019-08-01",
        version: "1.0.0",
      })
      .returning();
    expect(row.subject).toBe("RELIGION");
  });

  it("lehnt Schulform bei Sek II ab", async () => {
    await expect(
      db.insert(curriculumStrand).values({
        subject: "DEUTSCH",
        confessionContext: "NICHT_ANWENDBAR",
        schoolStage: "SEK_II",
        schoolForm: "GESAMTSCHULE",
        frameworkAuthority: "Test",
        validFrom: "2024-08-01",
        version: "1.0.0",
      }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 4: Migration generieren** — Run: `pnpm db:generate` → erzeugt Migration mit den CHECK-Constraints.

- [ ] **Step 5: Tests laufen lassen** — Run: `pnpm test src/lib/db/__tests__/curriculum-constraints.test.ts`
Expected: 3 passed (Testcontainers startet, Migration läuft, CHECKs greifen).

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/schema/curriculum.ts src/lib/db/__tests__/ drizzle/
git commit -m "feat(m1): curriculum_strand/node mit Konfessions-CHECK + Baum-Invariante (+Tests)"
```

---

### Task 4: Artefakt-Schema (Unit, Lesson, Worksheet, Task, ExpectationHorizon, Rubric, RubricCriterion, SourceRef + Joins)

**Files:**
- Create: `src/lib/db/schema/artifacts.ts`
- Create: `src/lib/db/__tests__/artifacts-softdelete.test.ts`

**Interfaces:**
- Consumes: `artifactTimestamps` (Task 1), `curriculumStrand`/`curriculumNode` (Task 3), `user` (Task 2).
- Produces: `teachingUnit`, `lesson`, `worksheet`, `task`, `expectationHorizon`, `rubric`, `rubricCriterion`, `sourceRef`, `worksheetSourceRef`, `lessonCurriculumNode`.

- [ ] **Step 1: src/lib/db/schema/artifacts.ts**

```ts
import {
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { artifactTimestamps } from "../columns";
import { difficultyEnum, gradeBandEnum, rubricScaleEnum, rubricScopeEnum, taskTypeEnum, teachingUnitStatusEnum } from "../enums";
import { curriculumNode, curriculumStrand } from "./curriculum";
import { user } from "./auth";

const ownerTeacherId = () =>
  text("owner_teacher_id")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" });

export const teachingUnit = pgTable("teaching_unit", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  strandId: uuid("strand_id").notNull().references(() => curriculumStrand.id, { onDelete: "restrict" }),
  gradeBand: gradeBandEnum("grade_band"),
  goals: text("goals"),
  sequenceOrder: integer("sequence_order"),
  status: teachingUnitStatusEnum("status").notNull().default("DRAFT"),
  ownerTeacherId: ownerTeacherId(),
  ...artifactTimestamps,
});

export const lesson = pgTable("lesson", {
  id: uuid("id").primaryKey().defaultRandom(),
  unitId: uuid("unit_id").notNull().references(() => teachingUnit.id, { onDelete: "cascade" }),
  objectives: text("objectives"),
  phasePlan: jsonb("phase_plan"),
  ownerTeacherId: ownerTeacherId(),
  ...artifactTimestamps,
});

export const worksheet = pgTable("worksheet", {
  id: uuid("id").primaryKey().defaultRandom(),
  unitId: uuid("unit_id").notNull().references(() => teachingUnit.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  instructions: text("instructions"),
  layoutRef: text("layout_ref"),
  license: text("license"),
  derivationSource: text("derivation_source"),
  ownerTeacherId: ownerTeacherId(),
  ...artifactTimestamps,
});

export const task = pgTable("task", {
  id: uuid("id").primaryKey().defaultRandom(),
  worksheetId: uuid("worksheet_id").notNull().references(() => worksheet.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  taskType: taskTypeEnum("task_type").notNull(),
  difficulty: difficultyEnum("difficulty").notNull(),
  expectedCompetenceNodeId: uuid("expected_competence_node_id").references(() => curriculumNode.id, { onDelete: "set null" }),
  points: integer("points"),
  ownerTeacherId: ownerTeacherId(),
  ...artifactTimestamps,
});

export const expectationHorizon = pgTable("expectation_horizon", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().unique().references(() => task.id, { onDelete: "cascade" }),
  modelSolution: text("model_solution"),
  acceptanceCriteria: jsonb("acceptance_criteria"),
  partialCreditRules: jsonb("partial_credit_rules"),
  ownerTeacherId: ownerTeacherId(),
  ...artifactTimestamps,
});

export const rubric = pgTable("rubric", {
  id: uuid("id").primaryKey().defaultRandom(),
  scope: rubricScopeEnum("scope").notNull(),
  targetId: uuid("target_id").notNull(), // polymorph (UNIT→teaching_unit, TASK→task); FK app-seitig geprüft
  scaleType: rubricScaleEnum("scale_type").notNull(),
  totalPoints: integer("total_points"),
  ownerTeacherId: ownerTeacherId(),
  ...artifactTimestamps,
});

export const rubricCriterion = pgTable("rubric_criterion", {
  id: uuid("id").primaryKey().defaultRandom(),
  rubricId: uuid("rubric_id").notNull().references(() => rubric.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  weight: doublePrecision("weight").notNull(),
  levelDescriptors: jsonb("level_descriptors").notNull(),
  ownerTeacherId: ownerTeacherId(),
  ...artifactTimestamps,
});

import { sourceTrustEnum } from "../enums";

export const sourceRef = pgTable("source_ref", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentHash: text("content_hash").notNull(),
  sourceType: sourceTrustEnum("source_type").notNull(),
  title: text("title").notNull(),
  uri: text("uri"),
  confidence: doublePrecision("confidence"),
  ownerTeacherId: text("owner_teacher_id").references(() => user.id, { onDelete: "set null" }),
  ...artifactTimestamps,
});

// n:m Worksheet ↔ SourceRef
export const worksheetSourceRef = pgTable(
  "worksheet_source_ref",
  {
    worksheetId: uuid("worksheet_id").notNull().references(() => worksheet.id, { onDelete: "cascade" }),
    sourceRefId: uuid("source_ref_id").notNull().references(() => sourceRef.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.worksheetId, t.sourceRefId] })],
);

// n:m Lesson ↔ CurriculumNode (Kompetenzzuordnung)
export const lessonCurriculumNode = pgTable(
  "lesson_curriculum_node",
  {
    lessonId: uuid("lesson_id").notNull().references(() => lesson.id, { onDelete: "cascade" }),
    nodeId: uuid("node_id").notNull().references(() => curriculumNode.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.lessonId, t.nodeId] })],
);
```

- [ ] **Step 2: Failing test (artifacts-softdelete.test.ts)** — Soft-Delete + Version-Default + UNVERIFIED-Quelle erlaubt im Schema (Governance greift in der App, nicht im Schema).

```ts
import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { isNull } from "drizzle-orm";
import { user } from "@/lib/db/schema/auth";
import { curriculumStrand } from "@/lib/db/schema/curriculum";
import { teachingUnit, worksheet } from "@/lib/db/schema/artifacts";

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client);
afterAll(async () => { await client.end(); });

async function seedTeacherAndStrand() {
  const [u] = await db.insert(user).values({ id: "t-1", name: "Test", email: "t@example.org", emailVerified: true }).returning();
  const [s] = await db.insert(curriculumStrand).values({
    subject: "DEUTSCH", confessionContext: "NICHT_ANWENDBAR", schoolStage: "SEK_I",
    frameworkAuthority: "LSA", validFrom: "2020-08-01", version: "1.0.0",
  }).returning();
  return { teacherId: u.id, strandId: s.id };
}

describe("Artefakt-Konventionen", () => {
  it("setzt version=1 und deleted_at=null by default", async () => {
    const { teacherId, strandId } = await seedTeacherAndStrand();
    const [unit] = await db.insert(teachingUnit).values({
      title: "Sequenz A", strandId, ownerTeacherId: teacherId,
    }).returning();
    expect(unit.version).toBe(1);
    expect(unit.deletedAt).toBeNull();

    const [ws] = await db.insert(worksheet).values({
      unitId: unit.id, title: "AB 1", license: "CC-BY-SA-4.0", ownerTeacherId: teacherId,
    }).returning();

    // Soft-Delete: deleted_at setzen, Zeile bleibt erhalten (Audit)
    await db.update(worksheet).set({ deletedAt: new Date() });
    const active = await db.select().from(worksheet).where(isNull(worksheet.deletedAt));
    expect(active.length).toBe(0);
    const all = await db.select().from(worksheet);
    expect(all.length).toBe(1);
    expect(ws.license).toBe("CC-BY-SA-4.0");
  });
});
```

- [ ] **Step 3: Migration generieren** — Run: `pnpm db:generate`.

- [ ] **Step 4: Tests** — Run: `pnpm test src/lib/db/__tests__/artifacts-softdelete.test.ts` → Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/schema/artifacts.ts src/lib/db/__tests__/artifacts-softdelete.test.ts drizzle/
git commit -m "feat(m1): Artefakt-Schema (Unit→Lesson/Worksheet→Task→Horizon, Rubric, SourceRef, Joins) +Tests"
```

---

### Task 5: Provenienz + Audit-Log + benannte Lösch-Methoden (ADR 0005)

**Files:**
- Create: `src/lib/db/schema/provenance.ts`
- Create: `src/lib/db/repositories/deletion.ts`
- Create: `src/lib/db/__tests__/provenance.test.ts`

**Interfaces:**
- Produces: `generationProvenance`, `auditLog`; `softDeleteWorksheetWithAudit(db, id, actorId)`.

- [ ] **Step 1: src/lib/db/schema/provenance.ts**

```ts
import { boolean, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { artifactTimestamps } from "../columns";
import { auditSeverityEnum, generationArtifactTypeEnum } from "../enums";

export const generationProvenance = pgTable("generation_provenance", {
  id: uuid("id").primaryKey().defaultRandom(),
  artifactType: generationArtifactTypeEnum("artifact_type").notNull(),
  artifactId: uuid("artifact_id").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  promptHash: text("prompt_hash").notNull(),
  redactionApplied: boolean("redaction_applied").notNull(),
  sourceRefs: uuid("source_refs").array(),
  confidenceState: jsonb("confidence_state"),
  ownerTeacherId: text("owner_teacher_id").notNull(),
  ...artifactTimestamps,
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  eventType: text("event_type").notNull(),
  actorId: text("actor_id"),
  schoolId: uuid("school_id"),
  subject: text("subject"),
  details: jsonb("details"),
  severity: auditSeverityEnum("severity").notNull().default("info"),
});
```

- [ ] **Step 2: Benannte Lösch-Methode (src/lib/db/repositories/deletion.ts)** — ADR 0005: keine Ad-hoc-Deletes; Löschung + Audit atomar.

```ts
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { worksheet } from "@/lib/db/schema/artifacts";
import { auditLog } from "@/lib/db/schema/provenance";

/** Soft-Delete eines Worksheets mit Audit-Eintrag in einer Transaktion. */
export async function softDeleteWorksheetWithAudit(db: Db, worksheetId: string, actorId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(worksheet).set({ deletedAt: new Date() }).where(eq(worksheet.id, worksheetId));
    await tx.insert(auditLog).values({
      eventType: "soft_delete_worksheet",
      actorId,
      subject: "worksheet_deletion",
      details: { worksheetId },
      severity: "info",
    });
  });
}
```

- [ ] **Step 3: Failing test (provenance.test.ts)**

```ts
import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import { auditLog } from "@/lib/db/schema/provenance";
import { worksheet } from "@/lib/db/schema/artifacts";
import { softDeleteWorksheetWithAudit } from "@/lib/db/repositories/deletion";
// seedTeacherAndStrand + Unit/Worksheet wie in Task 4

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client) as unknown as import("@/lib/db/client").Db;
afterAll(async () => { await (client as ReturnType<typeof postgres>).end(); });

describe("Löschung schreibt Audit-Log", () => {
  it("soft-delete erzeugt audit_log-Eintrag", async () => {
    // Arrange: Worksheet seeden (siehe Task-4-Helfer) → wsId, teacherId
    const wsId = "<seed via Task-4-Helfer>"; // im Test echten Seed verwenden
    await softDeleteWorksheetWithAudit(db, wsId, "t-1");
    const logs = await db.select().from(auditLog).where(eq(auditLog.eventType, "soft_delete_worksheet"));
    expect(logs.length).toBeGreaterThan(0);
    const [ws] = await db.select().from(worksheet).where(eq(worksheet.id, wsId));
    expect(ws?.deletedAt).not.toBeNull();
  });
});
```

> Hinweis für den Implementierer: Den `wsId`-Seed aus dem Task-4-Helfer (`seedTeacherAndStrand` + Unit + Worksheet insert) in den Test kopieren — die Tabellen sind dieselben.

- [ ] **Step 4: Migration + Tests** — Run: `pnpm db:generate && pnpm test src/lib/db/__tests__/provenance.test.ts` → Expected: passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/schema/provenance.ts src/lib/db/repositories/deletion.ts src/lib/db/__tests__/provenance.test.ts drizzle/
git commit -m "feat(m1): generation_provenance + audit_log + benannte Lösch-Methode (ADR 0005) +Tests"
```

---

### Task 6: Repository-Implementierungen + Persistenz↔UI-Mapping + Factory

**Files:**
- Create: `src/lib/db/repositories/mapping.ts`
- Create: `src/lib/db/repositories/sources.pg.ts`
- Create: `src/lib/db/repositories/factory.ts`
- Create: `src/lib/db/__tests__/mapping.test.ts`

**Interfaces:**
- Consumes: `SourcesRepository`, `SourceEntry`, `SourceTrust`, `Subject` (UI) aus `src/lib/{repositories,types}.ts`; `sourceRef` (Task 4).
- Produces: `dbSubjectToUi(subject, confession)`, `uiSubjectToDb(uiSubject)`, `PgSourcesRepository`, `getSourcesRepository()`.

**Begründung (Kern-Designentscheidung):** Das Persistenzmodell trennt `subject` (DEUTSCH/RELIGION/ETHIK) + `confessionContext`. Die UI-Union `Subject = "deutsch" | "evangelische-religion" | "katholische-religion" | "ethik"` konflatiert beides. Das Mapping ist die einzige Übersetzungsstelle — keine UI-Annahme darf ins Schema lecken.

- [ ] **Step 1: src/lib/db/repositories/mapping.ts**

```ts
import type { Subject as UiSubject } from "@/lib/types";

type DbSubject = "DEUTSCH" | "RELIGION" | "ETHIK";
type DbConfession =
  | "EVANGELISCH" | "KATHOLISCH" | "KONFESSIONSSENSIBEL_UEBERGREIFEND"
  | "RELIGIONSKUNDLICH" | "NICHT_ANWENDBAR";

/** Persistenz (subject+confession) → UI-Union. KONFESSIONSSENSIBEL bleibt evangelisch-nah dargestellt; explizit dokumentiert. */
export function dbSubjectToUi(subject: DbSubject, confession: DbConfession): UiSubject {
  if (subject === "DEUTSCH") return "deutsch";
  if (subject === "ETHIK") return "ethik";
  // RELIGION
  if (confession === "KATHOLISCH") return "katholische-religion";
  return "evangelische-religion"; // EVANGELISCH + KONFESSIONSSENSIBEL_UEBERGREIFEND (UI kennt keinen dritten Strang)
}

/** UI-Union → Persistenz (subject+confession). */
export function uiSubjectToDb(ui: UiSubject): { subject: DbSubject; confession: DbConfession } {
  switch (ui) {
    case "deutsch": return { subject: "DEUTSCH", confession: "NICHT_ANWENDBAR" };
    case "ethik": return { subject: "ETHIK", confession: "RELIGIONSKUNDLICH" };
    case "evangelische-religion": return { subject: "RELIGION", confession: "EVANGELISCH" };
    case "katholische-religion": return { subject: "RELIGION", confession: "KATHOLISCH" };
  }
}
```

- [ ] **Step 2: Failing test (mapping.test.ts)**

```ts
import { describe, expect, it } from "vitest";
import { dbSubjectToUi, uiSubjectToDb } from "@/lib/db/repositories/mapping";

describe("Persistenz↔UI-Subject-Mapping", () => {
  it("mappt katholische Religion bidirektional", () => {
    expect(dbSubjectToUi("RELIGION", "KATHOLISCH")).toBe("katholische-religion");
    expect(uiSubjectToDb("katholische-religion")).toEqual({ subject: "RELIGION", confession: "KATHOLISCH" });
  });
  it("hält Deutsch konfessionsfrei", () => {
    expect(uiSubjectToDb("deutsch")).toEqual({ subject: "DEUTSCH", confession: "NICHT_ANWENDBAR" });
  });
  it("stellt konfessionssensibel-übergreifend als evangelisch-nah dar (UI kennt keinen dritten Strang)", () => {
    expect(dbSubjectToUi("RELIGION", "KONFESSIONSSENSIBEL_UEBERGREIFEND")).toBe("evangelische-religion");
  });
});
```

- [ ] **Step 3: PgSourcesRepository (sources.pg.ts)** — implementiert das bestehende Interface gegen die DB; UNVERIFIED bleibt sichtbar (Governance verdeckt nichts).

```ts
import { isNull } from "drizzle-orm";
import type { SourcesRepository, SourceEntry } from "@/lib/repositories";
import { db } from "@/lib/db/client";
import { sourceRef } from "@/lib/db/schema/artifacts";

const trustToUi: Record<string, SourceEntry["trust"]> = {
  OFFICIAL_BINDING: "OFFICIAL_BINDING",
  OFFICIAL_GUIDANCE: "OFFICIAL_GUIDANCE",
  OPEN_CURATED: "OPEN_CURATED",
  USER_APPROVED: "USER_APPROVED",
  UNVERIFIED: "UNVERIFIED",
};

export class PgSourcesRepository implements Pick<SourcesRepository, "entries"> {
  async entriesAsync(): Promise<SourceEntry[]> {
    const rows = await db.select().from(sourceRef).where(isNull(sourceRef.deletedAt));
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      origin: r.uri ?? "—",
      subject: "deutsch", // join über Artefakt/Strang in Folgeiteration; hier neutraler Default
      gradeRange: "—",
      trust: trustToUi[r.sourceType],
      version: "—",
      license: "—",
      status: "active",
    }));
  }
}
```

> Hinweis: Das bestehende `SourcesRepository.entries()` ist synchron (Mock). Für DB-Zugriff wird ein async-Pfad gebraucht. **Designentscheidung dieses Tasks:** ein paralleles async-Interface `SourcesRepositoryAsync` einführen (in `src/lib/repositories.ts` ergänzen) und die Server-Components darauf umstellen; die Mock-Variante bekommt einen async-Wrapper. Die UI-Komponenten (Client) bleiben über Server-Boundary stabil. Diese Interface-Erweiterung ist Teil von Step 3 — `repositories.ts` entsprechend ergänzen, ohne die bestehenden sync-Signaturen für den Mock zu brechen.

- [ ] **Step 4: Factory (factory.ts)**

```ts
import { mockSourcesRepository } from "@/lib/mock";
import { PgSourcesRepository } from "./sources.pg";

export function getSourcesRepository() {
  return process.env.REPOSITORY_BACKEND === "db"
    ? new PgSourcesRepository()
    : mockSourcesRepository;
}
```

> Hinweis: Exportname `mockSourcesRepository` an die tatsächliche Export-Struktur in `src/lib/mock/index.ts` anpassen (dort steht die Mock-Implementierung).

- [ ] **Step 5: Tests** — Run: `pnpm test src/lib/db/__tests__/mapping.test.ts` → Expected: 3 passed. (Mapping-Tests brauchen keine DB.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/repositories/ src/lib/repositories.ts src/lib/db/__tests__/mapping.test.ts
git commit -m "feat(m1): Postgres-Repositories + Persistenz↔UI-Mapping + Backend-Factory +Tests"
```

---

### Task 7: Export-Subsystem (docx + pdfkit hinter `exportArtifact`, Quellen-/Lizenz-Footer)

**Files:**
- Create: `src/lib/export/types.ts`
- Create: `src/lib/export/footer.ts`
- Create: `src/lib/export/docx-renderer.ts`
- Create: `src/lib/export/pdf-renderer.ts`
- Create: `src/lib/export/index.ts`
- Create: `src/lib/export/__tests__/export.test.ts`

**Interfaces:**
- Produces: `exportArtifact(worksheet, format): Promise<ExportResult>`, `buildFooter(worksheet): string`.

- [ ] **Step 1: src/lib/export/types.ts**

```ts
export type ExportFormat = "docx" | "pdf";

export interface SourceCitation {
  title: string;
  locator?: string; // Seite/§ (CITATION_STANDARD)
  license?: string;
}

export interface ExportableTask {
  prompt: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
}

export interface ExportableWorksheet {
  title: string;
  instructions?: string;
  tasks: ExportableTask[];
  license?: string;
  derivationSource?: string;
  sources: SourceCitation[];
}

export interface ExportResult {
  format: ExportFormat;
  filename: string;
  bytes: Buffer;
}
```

- [ ] **Step 2: Footer (footer.ts)** — ADR 0008: license/derivation_source + Quellen unten auf Seite (ACCEPTANCE_CRITERIA: »Quellen«-Sektion).

```ts
import type { ExportableWorksheet } from "./types";

export function buildFooter(ws: ExportableWorksheet): string {
  const lines: string[] = ["Quellen:"];
  ws.sources.forEach((s, i) => {
    const loc = s.locator ? `, ${s.locator}` : "";
    const lic = s.license ? ` (${s.license})` : "";
    lines.push(`${i + 1}. ${s.title}${loc}${lic}`);
  });
  if (ws.derivationSource) lines.push(`Adaptiert von: ${ws.derivationSource}`);
  if (ws.license) lines.push(`Lizenz: ${ws.license}`);
  return lines.join("\n");
}
```

- [ ] **Step 3: docx-Renderer (docx-renderer.ts)**

```ts
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import type { ExportableWorksheet, ExportResult } from "./types";
import { buildFooter } from "./footer";

export async function renderDocx(ws: ExportableWorksheet): Promise<ExportResult> {
  const children: Paragraph[] = [
    new Paragraph({ text: ws.title, heading: HeadingLevel.HEADING_1 }),
  ];
  if (ws.instructions) children.push(new Paragraph({ text: ws.instructions }));
  ws.tasks.forEach((t, i) =>
    children.push(new Paragraph({ children: [new TextRun({ text: `${i + 1}. [${t.difficulty}] ${t.prompt}` })] })),
  );
  buildFooter(ws).split("\n").forEach((line) =>
    children.push(new Paragraph({ children: [new TextRun({ text: line, italics: true, size: 18 })] })),
  );
  const doc = new Document({ sections: [{ children }] });
  const bytes = await Packer.toBuffer(doc);
  return { format: "docx", filename: `${slug(ws.title)}.docx`, bytes };
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "arbeitsblatt";
}
```

- [ ] **Step 4: pdfkit-Renderer (pdf-renderer.ts)**

```ts
import PDFDocument from "pdfkit";
import type { ExportableWorksheet, ExportResult } from "./types";
import { buildFooter } from "./footer";

export function renderPdf(ws: ExportableWorksheet): Promise<ExportResult> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () =>
      resolve({ format: "pdf", filename: `${slug(ws.title)}.pdf`, bytes: Buffer.concat(chunks) }),
    );
    doc.on("error", reject);

    doc.fontSize(18).text(ws.title);
    if (ws.instructions) doc.moveDown(0.5).fontSize(11).text(ws.instructions);
    doc.moveDown();
    ws.tasks.forEach((t, i) => doc.fontSize(11).text(`${i + 1}. [${t.difficulty}] ${t.prompt}`));
    doc.moveDown();
    doc.fontSize(8).fillColor("#555").text(buildFooter(ws));
    doc.end();
  });
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "arbeitsblatt";
}
```

- [ ] **Step 5: Format-Abstraktion (index.ts)** — der austauschbare Dispatch (ADR 0008).

```ts
import type { ExportableWorksheet, ExportFormat, ExportResult } from "./types";
import { renderDocx } from "./docx-renderer";
import { renderPdf } from "./pdf-renderer";

export async function exportArtifact(ws: ExportableWorksheet, format: ExportFormat): Promise<ExportResult> {
  switch (format) {
    case "docx": return renderDocx(ws);
    case "pdf": return renderPdf(ws);
  }
}

export type { ExportableWorksheet, ExportFormat, ExportResult } from "./types";
```

- [ ] **Step 6: Failing test (export.test.ts)** — beide Formate erzeugen nicht-leere Bytes; Footer enthält Quelle + Lizenz.

```ts
import { describe, expect, it } from "vitest";
import { exportArtifact } from "@/lib/export";
import { buildFooter } from "@/lib/export/footer";
import type { ExportableWorksheet } from "@/lib/export/types";

const ws: ExportableWorksheet = {
  title: "Argumentation Klasse 8",
  instructions: "Bearbeite die Aufgaben.",
  tasks: [{ prompt: "Analysiere den Text.", difficulty: "MEDIUM" }],
  license: "CC-BY-SA-4.0",
  derivationSource: "Lehrplan Deutsch LSA",
  sources: [{ title: "Lehrplan Deutsch LSA Kl. 8", locator: "§3.2.1", license: "OFFICIAL_BINDING" }],
};

describe("Export-Footer", () => {
  it("listet Quelle, Lokator und Lizenz", () => {
    const f = buildFooter(ws);
    expect(f).toContain("Lehrplan Deutsch LSA Kl. 8");
    expect(f).toContain("§3.2.1");
    expect(f).toContain("Lizenz: CC-BY-SA-4.0");
  });
});

describe("exportArtifact", () => {
  it("erzeugt DOCX-Bytes", async () => {
    const r = await exportArtifact(ws, "docx");
    expect(r.format).toBe("docx");
    expect(r.bytes.length).toBeGreaterThan(0);
    expect(r.filename).toMatch(/\.docx$/);
  });
  it("erzeugt PDF-Bytes (Magic-Header %PDF)", async () => {
    const r = await exportArtifact(ws, "pdf");
    expect(r.bytes.subarray(0, 4).toString()).toBe("%PDF");
  });
});
```

- [ ] **Step 7: Tests** — Run: `pnpm test src/lib/export/__tests__/export.test.ts` → Expected: 4 passed. (Keine DB nötig.)

- [ ] **Step 8: Commit**

```bash
git add src/lib/export/
git commit -m "feat(m1): Export-Subsystem docx+pdfkit hinter exportArtifact + Quellen/Lizenz-Footer +Tests"
```

---

### Task 8: CI-Gates (Schema-Drift, Migration-Flag) + Doku-Update

**Files:**
- Create: `scripts/check-schema-drift.mjs`
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json` (`db:check` schon in Task 0; hier CI-Verdrahtung)
- Modify: `docs/architecture/DATA_MODEL.md` (Implementierungsstatus-Notiz), `PLAN.md` (M1-Fortschritt), `README.md` (Scripts)

**Interfaces:** keine Code-Interfaces; CI-Gate + Doku.

- [ ] **Step 1: scripts/check-schema-drift.mjs**

```js
import { execSync } from "node:child_process";

// drizzle-kit check: Schema (TS) gegen Migrationen — schlägt fehl bei Drift.
try {
  execSync("pnpm db:check", { stdio: "inherit" });
  console.log("Schema-Drift-Check: OK");
} catch {
  console.error("Schema weicht von Migrationen ab — `pnpm db:generate` ausführen und committen.");
  process.exit(1);
}
```

- [ ] **Step 2: CI ergänzen (.github/workflows/ci.yml)** — Job-Schritte nach Install/Lint:

```yaml
      - name: Tests
        run: pnpm test
      - name: Schema-Drift-Check
        run: node scripts/check-schema-drift.mjs
      - name: Migrations-Review-Flag (DELETE/UPDATE)
        run: |
          if git diff --name-only origin/main... | grep -q '^drizzle/.*\.sql$'; then
            if grep -RInE '\b(DELETE|UPDATE)\b' drizzle/*.sql; then
              echo "::warning::Migration enthält DELETE/UPDATE — manuelles Review erforderlich (ADR 0005)."
            fi
          fi
```

- [ ] **Step 3: Doku aktualisieren**
  - `DATA_MODEL.md`: Notiz, dass `SENSITIVE_STUDENT`-Entitäten (StudentSubmission/CorrectionDraft/pseudonym_mappings) erst in M3 implementiert werden; M1 implementiert PUBLIC/INTERNAL-Artefakte + Curriculum + Provenienz.
  - `PLAN.md`: M1-Fortschritt (Datenmodell + Export umgesetzt).
  - `README.md`: neue Scripts (`pnpm test`, `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:check`).

- [ ] **Step 4: Voll-Verifikation**

Run: `git diff --check && pnpm lint && pnpm format:check && pnpm typecheck && pnpm build && pnpm test`
Expected: alle grün.

- [ ] **Step 5: Commit**

```bash
git add scripts/check-schema-drift.mjs .github/workflows/ci.yml docs/architecture/DATA_MODEL.md PLAN.md README.md
git commit -m "ci(m1): Schema-Drift-Gate + Migration-Review-Flag + Doku-Update"
```

---

## Self-Review

**1. Spec-Abdeckung (PLAN.md §M1 „Datenmodell Artefakte … Export-Architektur"):**
- Datenmodell Artefakte → Tasks 3–5 (Curriculum, Artefakte, Provenienz). ✓
- Bewertungsraster/Erwartungshorizont → `rubric`/`rubric_criterion`/`expectation_horizon` (Task 4). ✓
- Export-Architektur → Task 7 (`exportArtifact`, docx+pdfkit, Footer). ✓
- Planungsassistent-/Arbeitsblattgenerator-**Logik** (LLM) → **bewusst NICHT in diesem Plan**: hängt am M2-RAG (Quellenpflicht). Hier nur Persistenz + Export der Artefakte. In Plan-Kopf als Scope-Grenze vermerkt.

**2. Platzhalter-Scan:** Zwei `<seed via …>`-Hinweise in Tasks 5/6 verweisen explizit auf den Task-4-Seed-Helfer (kein Logik-Platzhalter, sondern Wiederverwendung). Alle Schema-/Renderer-/Mapping-Schritte enthalten vollständigen Code.

**3. Typkonsistenz:** Enum-Werte identisch zu DATA_MODEL.md; Tabellennamen/Spalten konsistent über Tasks 3–7; `ExportableWorksheet`/`ExportResult` einheitlich in Renderer + Abstraktion + Tests; `ownerTeacherId` → `user.id` (Better Auth, text) durchgängig.

**Offene Folgepunkte (kein Blocker, in M2/M3):**
- `SourcesRepository` Sync→Async-Migration (Task 6) sauberer ausarbeiten, wenn echte Server-Components Daten ziehen.
- `source_ref`-Join zu Fach/Konfession für echte `subject`/`gradeRange`-Anzeige (Task 6 nutzt neutralen Default).
- Sek-II-`GradeBand`-Werte + Verschlüsselung `SENSITIVE_STUDENT` (M3), Pseudonym-Retention-Löschjob (ADR 0009).
