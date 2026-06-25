/**
 * LLM-Provider — zentrale Factory und Re-Exports
 *
 * BLOCKER-A (2026-06-25): CloudProvider und createCloudProvider sind NICHT
 * mehr öffentlich exportiert. App-Code kann CloudProvider nicht direkt
 * instanziieren — der einzige erlaubte Einstieg ist createGatedCloudProvider(),
 * das intern CloudProvider erzeugt UND sofort mit withGate umhüllt.
 *
 * Default: OllamaChatProvider (local-first, kein Cloud-Call).
 */

import { OllamaChatProvider } from "./ollama-chat";
import { FakeLLMProvider } from "./fake";
import { CloudProvider, type CloudProviderKind } from "./cloud";
import { withGate, type GrantReader, type AuditSink } from "./gate";
import type { LLMProvider } from "./provider";

// ── Public Re-Exports ─────────────────────────────────────────────────────────

export { type LLMProvider, type CallContext, type JSONSchema, StructuredParseError } from "./provider";
export { OllamaChatProvider } from "./ollama-chat";
// CloudProvider und createCloudProvider sind absichtlich NICHT exportiert —
// App-Code verwendet createGatedCloudProvider() (BLOCKER-A).
export { type CloudProviderKind } from "./cloud";
export { FakeLLMProvider, type FakeGenerationResult } from "./fake";
export { redact, type RedactionResult, type RedactionCategory } from "./redaction";
export { guardAssertion, GateBlockedError } from "./guard";
export { withGate, type GrantReader, type AuditSink, type WithGateOpts } from "./gate";

// ── Factory: lokale Provider ──────────────────────────────────────────────────

export interface CreateLLMProviderOpts {
  /**
   * true → gibt FakeLLMProvider zurück (deterministisch, kein Netzwerk).
   * Für Unit-Tests und lokale Entwicklung ohne laufendes Ollama.
   */
  fake?: boolean;
}

/**
 * Erzeugt einen lokalen LLM-Provider (Ollama oder Fake).
 *
 * CloudProvider wird NICHT zurückgegeben — dafür createGatedCloudProvider().
 * Für einen gate-gesicherten lokalen Provider withGate() mit providerKind:'local' verwenden.
 */
export function createLLMProvider(opts: CreateLLMProviderOpts = {}): LLMProvider {
  if (opts.fake) {
    return new FakeLLMProvider();
  }
  return new OllamaChatProvider();
}

// ── Factory: Cloud-Provider (immer gate-gesichert) ────────────────────────────

export interface CreateGatedCloudProviderOpts {
  /** 'openai' → openai-compat; 'anthropic' → Anthropic Messages API */
  name: "openai" | "anthropic";
  grantReader: GrantReader;
  audit: AuditSink;
}

/**
 * Erzeugt einen Cloud-LLM-Provider, der BEREITS von withGate umhüllt ist.
 *
 * BLOCKER-A: Dies ist der EINZIGE erlaubte Weg, einen CloudProvider zu erhalten.
 * CloudProvider ist modul-intern; createGatedCloudProvider() garantiert, dass
 * kein ungegater Cloud-Provider in App-Code gelangt.
 *
 * BLOCKER-B: providerKind ist fix auf 'cloud' gesetzt — der Gate-Sicherheitspfad
 * kann nicht durch per-call context überschrieben werden.
 */
export function createGatedCloudProvider(opts: CreateGatedCloudProviderOpts): LLMProvider {
  const { name, grantReader, audit } = opts;
  const kind: CloudProviderKind = name === "anthropic" ? "anthropic" : "openai-compat";
  const rawProvider = new CloudProvider({ kind });
  return withGate(rawProvider, {
    providerKind: "cloud",
    providerName: name,
    grantReader,
    audit,
  });
}
