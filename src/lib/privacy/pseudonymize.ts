/**
 * Pseudonymisierung (REDACTION_AND_GUARD_SPEC.md §1)
 *
 * Algorithmus: pseudonym_id = BASE64_URL_SAFE(HMAC_SHA256(school_secret, student_id))
 *
 * Invarianten:
 * - Mapping-Tabelle bleibt AUSSCHLIESSLICH lokal — verlässt das System nie.
 * - Re-Identifikation (reidentify) nur über das lokale PseudonymRepository möglich.
 * - Klarnamen dürfen NIE in einem Provider-Payload erscheinen.
 *
 * Alle Abhängigkeiten sind injiziert (PseudonymRepository, school_secret) —
 * kein direkter DB-Zugriff, kein globaler State → vollständig testbar mit Fakes.
 */

import { createHmac } from "crypto";

// ─── PseudonymRepository (injiziertes Interface) ──────────────────────────────

/**
 * Persistenz-Interface für Pseudonym-Mappings.
 * Produktiv-Implementierung schreibt in pseudonym_mappings (Postgres, lokal).
 * Tests nutzen FakePseudonymRepository (in-memory).
 *
 * SICHERHEITSHINWEIS: Diese Tabelle verlässt NIEMALS das System.
 */
export interface PseudonymRepository {
  /** Speichert ein neues Mapping (idempotent bei gleichem studentRef+schoolId). */
  upsert(params: {
    pseudonymId: string;
    studentRef: string;
    schoolId: string;
  }): Promise<void>;

  /**
   * Gibt den studentRef (echte interne ID) für ein Pseudonym zurück.
   * Gibt null zurück, wenn das Pseudonym nicht bekannt ist.
   *
   * NUR lokal aufzurufen — nie den Rückgabewert an externe Services übergeben.
   */
  findByPseudonymId(pseudonymId: string): Promise<{ studentRef: string; schoolId: string } | null>;
}

// ─── FakePseudonymRepository (Tests) ─────────────────────────────────────────

export class FakePseudonymRepository implements PseudonymRepository {
  private readonly store = new Map<string, { studentRef: string; schoolId: string }>();

  async upsert(params: { pseudonymId: string; studentRef: string; schoolId: string }): Promise<void> {
    this.store.set(params.pseudonymId, {
      studentRef: params.studentRef,
      schoolId: params.schoolId,
    });
  }

  async findByPseudonymId(
    pseudonymId: string,
  ): Promise<{ studentRef: string; schoolId: string } | null> {
    return this.store.get(pseudonymId) ?? null;
  }
}

// ─── PseudonymService ─────────────────────────────────────────────────────────

export interface PseudonymizeDeps {
  /** Injiziertes Repository — lokal-only, kein Cloud-Zugriff */
  repo: PseudonymRepository;
  /**
   * Schulspezifisches Geheimnis (aus Vaultwarden / Env).
   * Wird NICHT geloggt, NICHT an Provider übergeben.
   */
  schoolSecret: string;
  /** Schul-ID für das Mapping */
  schoolId: string;
}

/**
 * Ergebnis einer Pseudonymisierungs-Operation.
 * Enthält die Zuordnung von internen Schüler-IDs zu stabilen Pseudonymen.
 */
export interface PseudonymMap {
  /** studentRef → pseudonymId */
  mapping: Map<string, string>;
}

/**
 * Erzeugt ein stabiles Pseudonym für eine interne Schüler-ID.
 *
 * pseudonym_id = BASE64_URL_SAFE(HMAC_SHA256(school_secret, student_id))
 *
 * Speichert das Mapping im lokalen Repository (upsert, idempotent).
 *
 * @param deps       Injizierte Abhängigkeiten (repo, schoolSecret, schoolId)
 * @param studentRef Interne Schüler-ID (KEIN Klarname)
 * @returns          Stabiles Pseudonym (URL-sicheres Base64)
 */
export async function pseudonymize(
  deps: PseudonymizeDeps,
  studentRef: string,
): Promise<string> {
  const pseudonymId = computePseudonymId(deps.schoolSecret, studentRef);

  await deps.repo.upsert({
    pseudonymId,
    studentRef,
    schoolId: deps.schoolId,
  });

  return pseudonymId;
}

/**
 * Ersetzt alle Vorkommen von studentRef-Werten in einem Text durch ihre Pseudonyme.
 *
 * Der Text darf KEINE Klarnamen enthalten — studentRefs sind interne IDs.
 * Diese Funktion ersetzt interne Referenzen, nicht Klarnamen (dafür: redact.ts).
 *
 * @param deps        Injizierte Abhängigkeiten
 * @param text        Eingabetext mit internen Schüler-IDs
 * @param studentRefs Zu ersetzende interne IDs
 * @returns           Text mit Pseudonymen + Mapping für Re-Identifikation
 */
export async function pseudonymizeText(
  deps: PseudonymizeDeps,
  text: string,
  studentRefs: string[],
): Promise<{ pseudonymizedText: string; pseudonymMap: PseudonymMap }> {
  const mapping = new Map<string, string>();

  for (const ref of studentRefs) {
    const pseudonymId = await pseudonymize(deps, ref);
    mapping.set(ref, pseudonymId);
  }

  let pseudonymizedText = text;
  for (const [ref, pseudonymId] of mapping) {
    // Alle Vorkommen der internen ID ersetzen (global)
    pseudonymizedText = pseudonymizedText.replaceAll(ref, pseudonymId);
  }

  return { pseudonymizedText, pseudonymMap: { mapping } };
}

/**
 * Re-Identifikation: Ersetzt Pseudonyme im Text durch interne Schüler-IDs.
 *
 * SICHERHEITSHINWEIS:
 * - Darf NUR auf dem lokalen Pfad aufgerufen werden.
 * - Die Mapping-Tabelle (repo) verlässt das System NIE.
 * - Klarnamen werden hier NICHT wiederhergestellt — nur interne IDs.
 *
 * @param repo        Lokales PseudonymRepository (injiziert)
 * @param text        Text mit Pseudonymen (z.B. LLM-Antwort)
 * @param pseudonymIds Zu re-identifizierende Pseudonyme
 * @returns           Text mit wiederhergestellten internen IDs
 */
export async function reidentify(
  repo: PseudonymRepository,
  text: string,
  pseudonymIds: string[],
): Promise<string> {
  let result = text;

  for (const pseudonymId of pseudonymIds) {
    const entry = await repo.findByPseudonymId(pseudonymId);
    if (entry) {
      result = result.replaceAll(pseudonymId, entry.studentRef);
    }
  }

  return result;
}

// ─── Interner Algorithmus ─────────────────────────────────────────────────────

/**
 * Berechnet das stabile Pseudonym (HMAC-SHA256, Base64-URL-safe).
 * Deterministisch: gleiche (secret, studentRef) → gleicher Output.
 * Rein synchron, keine I/O.
 *
 * @internal Nur für pseudonymize() und Tests.
 */
export function computePseudonymId(schoolSecret: string, studentRef: string): string {
  const hmac = createHmac("sha256", schoolSecret);
  hmac.update(studentRef);
  // Base64-URL-safe: + → -, / → _, Padding entfernen
  return hmac.digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
