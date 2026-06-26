/**
 * golden-questions.ts — GoldenQuestion-Typ und Loader für die RAG-Evaluierungs-Suite
 *
 * GoldenQuestion beschreibt eine händisch kuratierte Frage mit bekannten Soll-Quellen.
 * Die YAML-Seed-Datei verwendet snake_case; parseGoldenQuestions mappt auf camelCase
 * und validiert Pflichtfelder und erlaubte Enum-Werte.
 *
 * Kein Dateisystem-/YAML-Import hier — der Caller lädt und parst das YAML,
 * übergibt das bereits geparste Objekt an parseGoldenQuestions().
 */

// ── Erlaubte Enum-Werte ──────────────────────────────────────────────────────

export const GOLDEN_DOMAINS = ["DEUTSCH", "RELIGION"] as const;
export type GoldenDomain = (typeof GOLDEN_DOMAINS)[number];

export const GOLDEN_CONFESSION_CONTEXTS = [
  "NICHT_ANWENDBAR",
  "evangelisch",
  "katholisch",
  "uebergreifend",
] as const;
export type GoldenConfessionContext = (typeof GOLDEN_CONFESSION_CONTEXTS)[number];

export const GOLDEN_STATUSES = [
  "active",
  "blocked-source-not-approved",
  "blocked-no-registered-source",
] as const;
export type GoldenStatus = (typeof GOLDEN_STATUSES)[number];

// ── GoldenQuestion ────────────────────────────────────────────────────────────

/**
 * Eine händisch kuratierte Evaluierungs-Frage mit bekannten Soll-Quellen.
 *
 * Feldnamen entsprechen camelCase; der YAML-Loader bildet snake_case-Felder ab.
 */
export interface GoldenQuestion {
  /** Eindeutige ID der Frage (z. B. "GQ-DE-001") */
  id: string;
  /** Fachdomäne */
  domain: GoldenDomain;
  /** Konfessioneller Kontext (lowercase, wie im YAML) */
  confessionContext: GoldenConfessionContext;
  /** Kompetenzbereich laut Lehrplan */
  competenceArea: string;
  /** Klassenstufen-Bereich (z. B. "5-6", "7-10", "11-12") */
  gradeRange: string;
  /** Die natürlichsprachliche Suchanfrage */
  query: string;
  /** IDs der Quellen, die in einer korrekten Antwort erscheinen sollen */
  expectedSourceIds: string[];
  /** Erwarteter Abschnitt / Seite in der Quelle */
  expectedSection: string;
  /** Begründung, warum diese Frage evaluiert wird */
  rationale: string;
  /**
   * Status:
   *   active                       — Frage ist aktiv evaluierbar
   *   blocked-source-not-approved  — Soll-Quelle registriert, aber noch nicht freigegeben (z. B. candidate / license_verified=false)
   *   blocked-no-registered-source — gar keine Quelle für diese Konfession/Fach im Register
   * Beide blocked-Varianten werden in der Evaluierung übersprungen (nur "active" zählt).
   */
  status: GoldenStatus;
}

// ── YAML-Rohformat (snake_case) ───────────────────────────────────────────────

interface RawGoldenQuestion {
  id: unknown;
  domain: unknown;
  confession_context: unknown;
  competence_area: unknown;
  grade_range: unknown;
  query: unknown;
  expected_source_ids: unknown;
  expected_section: unknown;
  rationale: unknown;
  status: unknown;
}

interface RawGoldenQuestionsFile {
  golden_questions: unknown[];
}

// ── Validierungs-Helfer ───────────────────────────────────────────────────────

function requireString(value: unknown, field: string, id: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(
      `parseGoldenQuestions: Pflichtfeld "${field}" fehlt oder ist kein nichtleerer String` +
        (id ? ` (Frage-ID: ${id})` : ""),
    );
  }
  return value;
}

function requireStringArray(value: unknown, field: string, id: string): string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    throw new Error(
      `parseGoldenQuestions: Pflichtfeld "${field}" muss ein Array von Strings sein (Frage-ID: ${id})`,
    );
  }
  return value as string[];
}

function requireEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
  id: string,
): T {
  if (!allowed.includes(value as T)) {
    throw new Error(
      `parseGoldenQuestions: Ungültiger Wert "${String(value)}" für "${field}". ` +
        `Erlaubt: ${allowed.join(", ")} (Frage-ID: ${id})`,
    );
  }
  return value as T;
}

// ── parseGoldenQuestions ──────────────────────────────────────────────────────

/**
 * Mappt und validiert ein bereits geparste Objekt der Form
 * `{ golden_questions: [...] }` (snake_case) in ein typsicheres GoldenQuestion[].
 *
 * Wirft einen aussagekräftigen Error, wenn:
 *   - `raw` nicht die erwartete Struktur hat
 *   - Pflichtfelder fehlen oder leer sind
 *   - domain, confessionContext oder status außerhalb der erlaubten Werte liegen
 *
 * @param raw - Bereits geparster YAML-Inhalt (typeof unknown)
 */
export function parseGoldenQuestions(raw: unknown): GoldenQuestion[] {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(
      'parseGoldenQuestions: Eingabe muss ein Objekt sein (erwartet { golden_questions: [...] })',
    );
  }

  const file = raw as Record<string, unknown>;
  if (!Array.isArray(file["golden_questions"])) {
    throw new Error(
      'parseGoldenQuestions: Toplevel-Schlüssel "golden_questions" fehlt oder ist kein Array',
    );
  }

  const rawFile = raw as RawGoldenQuestionsFile;

  return rawFile.golden_questions.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error(
        `parseGoldenQuestions: Eintrag ${index} ist kein Objekt`,
      );
    }

    const q = entry as RawGoldenQuestion;

    // id zuerst lesen, damit Fehlermeldungen die ID nennen können
    const id = requireString(q.id, "id", `[index ${index}]`);

    const domain = requireEnum(q.domain, "domain", GOLDEN_DOMAINS, id);
    const confessionContext = requireEnum(
      q.confession_context,
      "confession_context",
      GOLDEN_CONFESSION_CONTEXTS,
      id,
    );
    const competenceArea = requireString(q.competence_area, "competence_area", id);
    const gradeRange = requireString(q.grade_range, "grade_range", id);
    const query = requireString(q.query, "query", id);
    const expectedSourceIds = requireStringArray(q.expected_source_ids, "expected_source_ids", id);
    const expectedSection = requireString(q.expected_section, "expected_section", id);
    const rationale = requireString(q.rationale, "rationale", id);
    const status = requireEnum(q.status, "status", GOLDEN_STATUSES, id);

    return {
      id,
      domain,
      confessionContext,
      competenceArea,
      gradeRange,
      query,
      expectedSourceIds,
      expectedSection,
      rationale,
      status,
    } satisfies GoldenQuestion;
  });
}
