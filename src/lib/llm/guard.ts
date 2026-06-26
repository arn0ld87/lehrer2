/**
 * PII Guard — Fail-Closed Assertion vor LLM-Provider-Call
 *
 * Implementiert den Guard aus docs/security/REDACTION_AND_GUARD_SPEC.md §3.
 *
 * guardAssertion() ist die LETZTE Prüfinstanz vor dem Provider-Call.
 * Sie operiert auf dem bereits durch redact() bereinigten Text.
 * Trifft sie noch PII → wirft GateBlockedError (KEIN Fallback, kein Retry).
 *
 * Muster aus Spec §3.1 exakt übernommen — kein eigenmächtiges Ergänzen.
 */

// ── GateBlockedError ──────────────────────────────────────────────────────────

/**
 * Maschinenlesbarer Fehler für Gate-Blockierungen.
 * Wird von withGate (gate.ts) gefangen und ins Audit-Log geschrieben.
 *
 * `reason` ist ein stabiler Schlüssel für programmatische Auswertung:
 *   - "RESIDUAL_PII"           — Guard-Assertion hat PII-Muster gefunden
 *   - "CLOUD_DISABLED"         — CLOUD_LLM_ENABLED !== 'true'
 *   - "NO_ACTIVE_GRANT"        — kein gültiger CloudReleaseGrant vorhanden
 */
export class GateBlockedError extends Error {
  constructor(
    message: string,
    public readonly reason:
      | "RESIDUAL_PII"
      | "CLOUD_DISABLED"
      | "NO_ACTIVE_GRANT",
  ) {
    super(message);
    this.name = "GateBlockedError";
  }
}

// ── PII-Muster aus Spec §3.1 ─────────────────────────────────────────────────

/**
 * Muster aus docs/security/REDACTION_AND_GUARD_SPEC.md §3.1, angepasst für
 * Curriculum-Kompatibilität (Fix E, 2026-06-25).
 *
 * Abweichung von Spec §3.1 Muster 1 (Roh-Bigram):
 * Das ursprüngliche Muster /\b[A-ZÄÖÜ][a-zäöü]+ [A-ZÄÖÜ][a-zäöü]+\b/ würde
 * legitime Curriculum-Eigennamen ("Martin Luther", "Anne Frank", Buchtitel)
 * als RESIDUAL_PII klassifizieren und den lokalen Planungs-/Arbeitsblatt-Pfad
 * (dataClass PUBLIC/INTERNAL, kein Schülerdaten-Kontext) sperren.
 *
 * Da redaction.ts (Stufe b) label-anchored Schüler-Namen bereits zuverlässig
 * maskiert, reicht es im Guard (Stufe c) zu prüfen, ob noch un-maskierte
 * label-anchored Namenskontexte durchgerutscht sind.
 *
 * Roh-Bigram-Guard wird in Phase 3 wieder aktiviert, wenn NER-Modell via
 * Ollama verfügbar ist und dataClass-Kontext übergeben wird.
 */
const GUARD_PATTERNS: RegExp[] = [
  // Spec §3.1 Muster 1 (angepasst): label-anchored Name-Reste nach Redaction.
  // Roh-Bigram /\b[A-ZÄÖÜ][a-zäöü]+ [A-ZÄÖÜ][a-zäöü]+\b/ deaktiviert —
  // würde legitime Curriculum-Eigennamen blockieren (Fix E, 2026-06-25).
  /(?:Name|Schüler(?:in)?|Vorname|Nachname|Familienname)\s*[:=]\s*[A-ZÄÖÜ]/i,
  // Spec §3.1 Muster 2: ISO-Datum (YYYY-MM-DD)
  /\d{2,4}-\d{2}-\d{2}/,
  // Spec §3.1 Muster 3: PLZ (5 Ziffern + Großbuchstabe)
  /\d{5} [A-ZÄÖÜ]/,
  // Spec §3.1 Muster 4: Sensible Begriffe (Förderbedarf)
  /lrs|dyskalkulie|adhs/i,
  // Ergänzend (spec §2.1): E-Mail-Adresse als starkes PII-Indiz
  /[\w.+-]+@[\w.-]+\.\w{2,}/i,
  // Ergänzend (spec §2.1): Deutsches Datumsformat DD.MM.YYYY
  /\b\d{2}\.\d{2}\.\d{4}\b/,
];

// ── guardAssertion ────────────────────────────────────────────────────────────

/**
 * Prüft `text` auf residuales PII nach Redaction.
 *
 * @param text  Bereits redacter Text (Ausgabe von redact().redactedText).
 * @returns     `true` wenn SAFE (kein PII-Muster gefunden).
 * @throws      {@link GateBlockedError} mit reason="RESIDUAL_PII" bei Treffer.
 *
 * FAIL-CLOSED: wirft immer bei Treffer — nie still weitermachen.
 */
export function guardAssertion(text: string): boolean {
  for (const pattern of GUARD_PATTERNS) {
    if (pattern.test(text)) {
      throw new GateBlockedError(
        "Sicherheitsprüfung fehlgeschlagen: Potenzielle Klardaten im Prompt erkannt.",
        "RESIDUAL_PII",
      );
    }
  }
  return true;
}
