/**
 * LLM-Provider-Abstraktion — Schnittstellenvertrag
 *
 * Jeder LLM-Provider (Ollama, OpenAI-kompatibel, Anthropic, Fake)
 * implementiert dieses Interface. Die konkrete Implementierung wird
 * über die Factory `createLLMProvider` in index.ts gewählt.
 *
 * Datenschutz-Hinweis: Der Caller ist verantwortlich dafür, dass
 * `prompt` vor Aufruf dieser Methode korrekt redacted wurde
 * (PII-Guard-Assertion liegt ÜBER dieser Schicht, in Phase 2).
 *
 * Schnittstellenvertrag gemäß INTEGRATION_BOUNDARIES.md §1.
 */

/**
 * Minimales JSON-Schema-Typ-Alias — kein zusätzliches npm-Paket.
 * Zur Laufzeit werden JSON-Schema-Objekte an Provider-APIs übergeben.
 */
export type JSONSchema = Record<string, unknown>;

/**
 * Kontext pro LLM-Call: Tenant-Info, Grant-Scope, Optional-Parameter.
 * Exakt gemäß INTEGRATION_BOUNDARIES.md §1 Schnittstellenvertrag.
 *
 * BLOCKER-B (2026-06-25): destinationProvider wird NICHT mehr zur Bestimmung
 * des Sicherheitspfads verwendet. Der Pfad (local/cloud) ist in withGate
 * als providerKind AT WRAP TIME gebunden. destinationProvider bleibt für
 * Audit-Logging und Observability erhalten.
 */
export interface CallContext {
  /** Schul-ID (Tenant-Isolierung, Pflicht für Grant-Prüfung) */
  schoolId: string;
  /** Nutzer-ID der anfragenden Lehrkraft */
  userId: string;
  /**
   * Ziel-Provider dieses Calls — nur für Audit-Logging.
   * Sicherheitspfad-Entscheidung erfolgt via withGate(opts.providerKind),
   * NICHT durch dieses Feld.
   */
  destinationProvider: "ollama" | "openai" | "anthropic" | "custom";
  /** Fach-Scope für Grant-Abfrage (z. B. "DEUTSCH", "ETHIK") */
  subject?: string;
  /** Klassenstufen-Scope für Grant-Abfrage (z. B. "KS9", "KS10") */
  gradeBand?: string;
  /** Optionaler Timeout in Millisekunden */
  timeout?: number;
  /** Maximale Token-Anzahl für den Response */
  maxTokens?: number;
}

/**
 * LLM-Provider-Interface — alle Implementierungen müssen diesen Vertrag erfüllen.
 * Gemäß INTEGRATION_BOUNDARIES.md §1.
 */
export interface LLMProvider {
  /**
   * Einfacher LLM-Call: gibt Textantwort zurück.
   * @param prompt Fertig redacted, datenschutz-approved Text.
   * @param context Optionaler Tenant-/Provider-Kontext für Audit.
   */
  call(prompt: string, context?: CallContext): Promise<string>;

  /**
   * Strukturierter Output (JSON gemäß Schema).
   * Fail-closed: wirft StructuredParseError bei Parse-Fehler — nie erfinden.
   * @param prompt Fertig redacted Text.
   * @param schema JSON-Schema-Objekt, das der Response erfüllen muss.
   * @param context Optionaler Tenant-/Provider-Kontext.
   */
  callStructured<T>(prompt: string, schema: JSONSchema, context?: CallContext): Promise<T>;

  /**
   * Schätzung der Token-Anzahl für Budgeting (Heuristik, nicht exakt).
   * @param text Zu schätzender Text.
   */
  estimateTokens(text: string): number;
}

/**
 * Wird geworfen, wenn `callStructured` den Response nicht als valides JSON
 * parsen kann. FAIL-CLOSED: kein Fabricating, kein leeres Objekt zurückgeben.
 */
export class StructuredParseError extends Error {
  constructor(
    message: string,
    public readonly raw: string,
  ) {
    super(message);
    this.name = "StructuredParseError";
  }
}
