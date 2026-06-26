/**
 * Privacy Gate — LLMProvider-Wrapper mit fail-closed PII-Gate
 *
 * Kapselt Redaction → Grant-Check → Guard-Assertion → Provider-Call in
 * dieser exakten, unveränderlichen Reihenfolge (INTEGRATION_BOUNDARIES.md §1,
 * REDACTION_AND_GUARD_SPEC.md §3, ADR 0002/0004).
 *
 * Design-Entscheidungen:
 * - GrantReader und AuditSink sind injectable Interfaces (kein direkter
 *   DB-Import) → vollständig unit-testbar ohne Docker/Postgres.
 * - AuditSink spiegelt das Pattern aus src/lib/db/repositories/deletion.ts:
 *   eventType, actorId, subject, severity, details (jsonb). Kein PII in details.
 * - Re-Identifikation (pseudonym_id → Klarname) ist NICHT hier implementiert —
 *   sie gehört zum lokalen Pfad nach dem Provider-Call (Phase 3, Caller).
 * - BLOCKER-B (2026-06-25): providerKind wird AT WRAP TIME gebunden, nicht
 *   per-call aus context.destinationProvider abgeleitet. context dient
 *   ausschließlich zur Grant-Scope-Abfrage und Audit-Metadaten.
 *
 * Verwendung:
 *   // Lokal (Ollama):
 *   const safeLocal = withGate(ollamaProvider, { providerKind: 'local', grantReader, audit });
 *   // Cloud (nur via createGatedCloudProvider in index.ts):
 *   const safeCloud = withGate(cloudProvider, { providerKind: 'cloud', providerName: 'openai', grantReader, audit });
 *   const result = await safeLocal.call(prompt, ctx);   // Gate aktiv
 */

import { type CallContext, type JSONSchema, type LLMProvider } from "./provider";
import { redact } from "./redaction";
import { GateBlockedError, guardAssertion } from "./guard";

// ── Injizierbare Interfaces ───────────────────────────────────────────────────

/**
 * Liest aktive CloudReleaseGrants aus der Persistenz.
 * Konkrete Implementierung in grants.pg.ts (PgGrantReader).
 */
export interface GrantReader {
  /**
   * Gibt den aktiven Grant zurück, wenn einer existiert der zum Kontext passt.
   * Gibt `null` zurück, wenn kein gültiger, zeitlich aktiver Grant vorhanden ist.
   *
   * Die Implementierung ist für Zeitgültigkeitsprüfung (validFrom/validUntil)
   * und Zweckbindung (subject, gradeBand) verantwortlich.
   */
  getActiveGrant(args: {
    schoolId: string;
    provider: string;
    subject?: string;
    gradeBand?: string;
  }): Promise<{ id: string } | null>;
}

/**
 * Schreibt Audit-Events. Spiegelt das Muster aus deletion.ts:
 * eventType, actorId, subject, severity, details.
 *
 * WICHTIG: details darf NIEMALS Schülernamen oder PII enthalten —
 * nur technische Metadaten (flags, IDs, Kategorien).
 */
export interface AuditSink {
  record(event: {
    eventType: string;
    actorId?: string;
    subject?: string;
    severity: "info" | "warning" | "critical";
    /** Technische Metadaten — kein PII, keine Klarnamen */
    detail?: string;
  }): Promise<void>;
}

// ── withGate Optionen ─────────────────────────────────────────────────────────

export interface WithGateOpts {
  /**
   * BLOCKER-B: Sicherheitspfad wird AT WRAP TIME festgelegt — nie per-call.
   * - 'local'  → Redaction + Guard, kein Grant-Check (Ollama, Fake)
   * - 'cloud'  → Redaction + CLOUD_LLM_ENABLED + Grant-Check + Guard (externe Provider)
   */
  providerKind: "local" | "cloud";
  /** Für Audit-Logging: Name des Cloud-Providers (z. B. 'openai', 'anthropic'). */
  providerName?: string;
  grantReader: GrantReader;
  audit: AuditSink;
}

// ── Gate-Logik (intern) ───────────────────────────────────────────────────────

/**
 * Führt Gate-Sequenz durch und gibt den redacten Prompt zurück.
 *
 * Reihenfolge (FAIL-CLOSED — jede Stufe kann abbrechen):
 *   a) Redaction (classify + mask PII)
 *   b) Sicherheitspfad-Check (bestimmt durch opts.providerKind, NICHT context):
 *      - 'local'  → immer erlaubt; Audit severity=info
 *      - 'cloud'  → CLOUD_LLM_ENABLED=true + aktiver Grant erforderlich;
 *                   fehlendes/undefined context → GateBlockedError (fail-closed)
 *   c) guardAssertion(redactedText) — wirft GateBlockedError bei residualem PII
 *   d) gibt redacten Prompt zurück → Caller führt Provider-Call aus
 *
 * TODO: region und avvStatus aus dem Grant-Datensatz in Phase 3 hier validieren
 * (Spalten existieren in grants.ts; Enforcement folgt nach DSFA-Review).
 */
async function runGate(
  prompt: string,
  context: CallContext | undefined,
  opts: WithGateOpts,
): Promise<string> {
  const { providerKind, providerName, grantReader, audit } = opts;

  // ── a) Redaction ─────────────────────────────────────────────────────────────
  const { redactedText, redactionApplied, categoriesHit } = redact(prompt);

  // ── b) Sicherheitspfad — gebunden an providerKind (NICHT context) ─────────────
  if (providerKind === "local") {
    // Lokaler Pfad (Ollama, Fake) — immer erlaubt; kein Grant-Check
    await audit.record({
      eventType: "llm_gate_local_call",
      actorId: context?.userId,
      subject: "llm_privacy_gate",
      severity: "info",
      detail: JSON.stringify({
        redactionApplied,
        categoriesHit,
        provider: providerName ?? "local",
      }),
    });
  } else {
    // Cloud-Pfad — CLOUD_LLM_ENABLED + aktiver Grant IMMER erforderlich.
    // Fehlendes context → fail-closed (nie still durchlassen).
    const cloudEnabled = process.env.CLOUD_LLM_ENABLED === "true";

    if (!cloudEnabled) {
      await audit.record({
        eventType: "llm_gate_cloud_blocked",
        actorId: context?.userId,
        subject: "llm_privacy_gate",
        severity: "critical",
        detail: JSON.stringify({ reason: "CLOUD_DISABLED", provider: providerName }),
      });
      throw new GateBlockedError(
        `CloudProvider(${providerName ?? "cloud"}) blockiert: CLOUD_LLM_ENABLED ist nicht 'true'. ` +
          "Aktivierung erfordert dokumentierten CloudReleaseGrant (ADR 0002).",
        "CLOUD_DISABLED",
      );
    }

    // context fehlt oder schoolId fehlt → fail-closed (kein Grant prüfbar)
    if (!context?.schoolId) {
      await audit.record({
        eventType: "llm_gate_cloud_blocked",
        actorId: context?.userId,
        subject: "llm_privacy_gate",
        severity: "critical",
        detail: JSON.stringify({
          reason: "NO_ACTIVE_GRANT",
          provider: providerName,
          schoolId: null,
          note: "context or schoolId missing — fail-closed",
        }),
      });
      throw new GateBlockedError(
        `CloudProvider(${providerName ?? "cloud"}) blockiert: Kein schoolId im Kontext. ` +
          "Cloud-Calls erfordern immer einen vollständigen Kontext mit schoolId (ADR 0002/0004).",
        "NO_ACTIVE_GRANT",
      );
    }

    const grant = await grantReader.getActiveGrant({
      schoolId: context.schoolId,
      provider: providerName ?? "cloud",
      subject: context.subject,
      gradeBand: context.gradeBand,
    });

    if (!grant) {
      await audit.record({
        eventType: "llm_gate_cloud_blocked",
        actorId: context.userId,
        subject: "llm_privacy_gate",
        severity: "critical",
        detail: JSON.stringify({
          reason: "NO_ACTIVE_GRANT",
          provider: providerName,
          schoolId: context.schoolId,
        }),
      });
      throw new GateBlockedError(
        `CloudProvider(${providerName ?? "cloud"}) blockiert: Kein aktiver CloudReleaseGrant für ` +
          `Schule ${context.schoolId}. ` +
          "Grant erforderlich gemäß ADR 0002/0004 (Rechtsgrundlage, AVV, DSFA).",
        "NO_ACTIVE_GRANT",
      );
    }

    // Grant vorhanden — Audit (kein PII)
    await audit.record({
      eventType: "llm_gate_cloud_call",
      actorId: context.userId,
      subject: "llm_privacy_gate",
      severity: "info",
      detail: JSON.stringify({
        redactionApplied,
        categoriesHit,
        provider: providerName,
        grantId: grant.id,
      }),
    });
  }

  // ── c) Guard-Assertion (nach Routing-Check, vor Provider-Call) ────────────────
  try {
    guardAssertion(redactedText);
  } catch (err) {
    if (err instanceof GateBlockedError) {
      await audit.record({
        eventType: "llm_gate_pii_guard_fail",
        actorId: context?.userId,
        subject: "llm_privacy_gate",
        severity: "critical",
        detail: JSON.stringify({
          reason: "RESIDUAL_PII",
          provider: providerName ?? providerKind,
          // Kein redactedText in detail — könnte noch Teile der PII enthalten
        }),
      });
    }
    throw err;
  }

  // ── d) Redacten Prompt zurückgeben ────────────────────────────────────────────
  return redactedText;
}

// ── withGate ──────────────────────────────────────────────────────────────────

/**
 * Umhüllt einen LLMProvider mit dem Privacy Gate.
 *
 * BLOCKER-B: providerKind wird bei Aufruf von withGate gebunden — NICHT
 * pro Call aus context abgeleitet. Der Cloud-Sicherheitspfad ist damit
 * unveränderlich für die Laufzeit des gewrappten Providers.
 *
 * Der zurückgegebene Provider ist ein Drop-In-Replacement für den übergebenen:
 * - `call` und `callStructured` durchlaufen die Gate-Sequenz.
 * - `estimateTokens` wird unverändert delegiert.
 *
 * @param provider  Zu wrappender Provider (Ollama, Cloud, Fake).
 * @param opts      Wrap-time-Optionen inkl. providerKind und injectable Deps.
 * @returns         Gate-gesicherter LLMProvider.
 */
export function withGate(
  provider: LLMProvider,
  opts: WithGateOpts,
): LLMProvider {
  return {
    async call(prompt: string, context?: CallContext): Promise<string> {
      const safePrompt = await runGate(prompt, context, opts);
      return provider.call(safePrompt, context);
    },

    async callStructured<T>(
      prompt: string,
      schema: JSONSchema,
      context?: CallContext,
    ): Promise<T> {
      const safePrompt = await runGate(prompt, context, opts);
      return provider.callStructured<T>(safePrompt, schema, context);
    },

    estimateTokens(text: string): number {
      return provider.estimateTokens(text);
    },
  };
}

// ── Re-Exporte für Convenience ────────────────────────────────────────────────

export { GateBlockedError } from "./guard";
