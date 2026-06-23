/**
 * LLM-Flow-Orchestrator (docs/architecture/RAG_ARCHITECTURE.md — LLM-Request-Fluss)
 *
 * Implementiert den vollständigen, fail-closed Datenschutz-Kern:
 *
 *   Intent/Scope
 *   → ProviderPolicyGate (Provider wählen nach dataClass + CloudReleaseGrant)
 *   → pseudonymizeText (interne Schüler-IDs → Pseudonyme)
 *   → redact (PII im Text maskieren)
 *   → retrieve (RAG-Kontext, Pflichtfilter Fach/Konfession/Trust — Phase 1)
 *   → Guard: assertNoPii(finaler Payload) ← FAIL-CLOSED, Provider NICHT aufgerufen bei Fund
 *   → provider.chat (ausgewählter Provider)
 *   → reidentify NUR wenn lokal (Pseudonyme → interne IDs in der Antwort)
 *   → generationProvenance-Record bauen (redactionApplied=true)
 *   → Confidence/Zitation zurückgeben
 *
 * Alle Abhängigkeiten sind injiziert — kein Docker, kein Netzwerk in Tests.
 *
 * Invarianten (REDACTION_AND_GUARD_SPEC.md, ADR 0002):
 *   1. Guard läuft VOR JEDEM Provider-Call. PII-Fund → throw, kein Call.
 *   2. Cloud-Call NIEMALS ohne gültigen CloudReleaseGrant.
 *   3. Re-Identifikation NUR auf lokalem Pfad.
 *   4. Default-Provider: lokal (Ollama). Klarnamen verlassen das System NIE.
 *   5. Migrationen: kein ad-hoc DELETE/UPDATE (irrelevant hier, informationshalber).
 */

import type { LLMProvider, ChatResponse, Message } from "./provider";
import type { ProviderPolicyGate, PolicyGateOptions } from "./policy";
import type { RetrieveDeps, RetrieveOpts } from "@/lib/rag/retrieve";
import { retrieve } from "@/lib/rag/retrieve";
import type { RankedCitation } from "@/lib/rag/citation";
import type { PseudonymizeDeps } from "@/lib/privacy/pseudonymize";
import { pseudonymizeText, reidentify } from "@/lib/privacy/pseudonymize";
import { redact } from "@/lib/privacy/redact";
import { assertNoPii, PiiGuardError } from "@/lib/privacy/guard";

// ─── ProvenanceWriter (injiziert, kein direkter DB-Import) ───────────────────

export interface ProvenanceRecord {
  artifactType: string;
  artifactId: string;
  provider: string;
  model: string;
  /** SHA-256-Hash des finalen Payloads (nicht der Payload selbst) */
  promptHash: string;
  redactionApplied: boolean;
  sourceRefs: string[];
  confidenceState: Record<string, unknown>;
  ownerTeacherId: string;
}

export interface ProvenanceWriter {
  write(record: ProvenanceRecord): Promise<void>;
}

/** Fake für Tests: sammelt alle geschriebenen Records */
export class FakeProvenanceWriter implements ProvenanceWriter {
  readonly records: ProvenanceRecord[] = [];

  async write(record: ProvenanceRecord): Promise<void> {
    this.records.push(record);
  }
}

// ─── AuditLogger (injiziert) ──────────────────────────────────────────────────

export interface AuditEvent {
  eventType: string;
  actorId?: string;
  schoolId?: string;
  subject?: string;
  details?: Record<string, unknown>;
  severity: "info" | "warning" | "error" | "critical";
}

export interface AuditLogger {
  log(event: AuditEvent): Promise<void>;
}

/** Fake für Tests */
export class FakeAuditLogger implements AuditLogger {
  readonly events: AuditEvent[] = [];

  async log(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }
}

// ─── FlowRequest ──────────────────────────────────────────────────────────────

export interface FlowRequest {
  /** Nachrichten des Gesprächs (user + ggf. system, history) */
  messages: Message[];
  /** System-Prompt (optional — wird wie alle Payload-Teile vom fail-closed Guard geprüft) */
  system?: string;
  /** Gewünschter Provider-ID (Hint; PolicyGate kann abweichen) */
  requestedProviderId?: string;
  /** Datenklasse der Eingabe — steuert Policy + Guard */
  dataClass: "PUBLIC" | "INTERNAL" | "PERSONAL_TEACHER" | "SENSITIVE_STUDENT";
  /** Benutzer-ID (Audit-Trail, Provenienz) */
  userId: string;
  userRole: "teacher" | "admin";
  /** Schul-ID (für CloudReleaseGrant-Lookup bei SENSITIVE_STUDENT) */
  schoolId?: string;
  /** Interne Schüler-IDs (werden zu Pseudonymen; KEINE Klarnamen) */
  studentRefs?: string[];
  /** Fach-Kontext für RAG-Filter + Grant-Scope */
  subject?: string;
  /** Klassenstufe für Grant-Scope */
  gradeBand?: string;
  /** RAG-Optionen (Fach, Konfession, minTrust, k) */
  retrieveOpts?: RetrieveOpts;
  /** Artefakt-Typ für Provenienz-Record */
  artifactType?: string;
  /** Artefakt-ID für Provenienz-Record */
  artifactId?: string;
  /** Optional: Modell-Hint für den Provider */
  modelHint?: string;
}

// ─── FlowResult ──────────────────────────────────────────────────────────────

export interface FlowResult {
  /** Antwort-Text (mit re-identifizierten internen IDs, wenn lokal) */
  text: string;
  /** Provider der tatsächlich aufgerufen wurde */
  provider: string;
  /** Modell das tatsächlich verwendet wurde */
  model: string;
  /** RAG-Zitationen (vollständig, keine UNVERIFIED) */
  citations: RankedCitation[];
  /** true wenn Redaction angewendet wurde */
  redactionApplied: boolean;
  /** Konfidenz-Zusammenfassung aus RAG-Zitationen */
  confidenceState: Record<string, unknown>;
}

// ─── FlowDeps ────────────────────────────────────────────────────────────────

export interface FlowDeps {
  /** Policy-Gate: wählt Provider nach dataClass + CloudReleaseGrant */
  policyGate: ProviderPolicyGate;
  /** RAG-Retrieval (Phase 1 — Embedder, Store, SourceRefReader) */
  retrieveDeps: RetrieveDeps;
  /** Pseudonymisierung (lokal-only) */
  pseudonymDeps: PseudonymizeDeps;
  /** Provenienz-Writer */
  provenanceWriter: ProvenanceWriter;
  /** Audit-Logger */
  auditLogger: AuditLogger;
  /**
   * Optionale injectable Redact-Funktion (Default: redact aus redact.ts).
   * Ermöglicht Tests mit deaktivierter Redaction (z.B. um Guard isoliert zu testen).
   */
  redactFn?: (text: string) => import("@/lib/privacy/redact").RedactResult;
}

// ─── Interne Hilfsfunktionen ──────────────────────────────────────────────────

/**
 * Einfaches SHA-256-ähnliches Fingerprint des Payloads (djb2-Hash, hex).
 * Kein Crypto-Modul nötig — ist nur ein nicht-umkehrbares Label für Audit-Zwecke,
 * kein kryptographisches Sicherheitsmerkmal in diesem Kontext.
 *
 * Für den Produktivbetrieb kann dies durch `import { createHash } from "crypto"`
 * + SHA-256 ersetzt werden. In Tests funktioniert diese leichte Variante ohne
 * Node-Crypto-Overhead.
 */
function promptFingerprint(payload: string): string {
  let hash = 5381;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) + hash) ^ payload.charCodeAt(i);
    hash = hash >>> 0; // unsigned 32-bit
  }
  return hash.toString(16).padStart(8, "0");
}

/** Baut den finalen Payload-String für den Guard-Scan + Provenienz-Hash. */
function buildPayloadString(
  messages: Message[],
  contextChunks: string[],
  system?: string,
): string {
  const parts: string[] = [];
  if (system) parts.push(system);
  for (const m of messages) {
    parts.push(`${m.role}: ${m.content}`);
  }
  if (contextChunks.length > 0) {
    parts.push("--- RAG-Kontext ---");
    parts.push(...contextChunks);
  }
  return parts.join("\n");
}

// ─── Haupt-Orchestrator ───────────────────────────────────────────────────────

/**
 * runFlow — vollständiger datenschutzkonformer LLM-Request-Fluss.
 *
 * Fail-closed-Invariante: Wirft PiiGuardError wenn der Guard PII im
 * finalen Payload erkennt. Der Provider wird in diesem Fall NICHT aufgerufen.
 *
 * @throws {PolicyViolationError} wenn dataClass/Provider-Kombination unzulässig
 * @throws {PiiGuardError}        wenn Guard PII im Payload erkennt
 */
export async function runFlow(
  deps: FlowDeps,
  req: FlowRequest,
): Promise<FlowResult> {
  const { policyGate, retrieveDeps, pseudonymDeps, provenanceWriter, auditLogger } = deps;
  const redactFn = deps.redactFn ?? redact;

  // ── (1) ProviderPolicyGate ────────────────────────────────────────────────
  const requestedProviderId = req.requestedProviderId ?? "ollama";
  const gateOpts: PolicyGateOptions = { schoolId: req.schoolId };
  const requestContext = {
    userId: req.userId,
    userRole: req.userRole,
    dataClass: req.dataClass,
    studentIds: req.studentRefs,
    subject: req.subject,
    gradeBand: req.gradeBand,
  };

  const provider: LLMProvider = await policyGate.selectProvider(
    requestedProviderId,
    requestContext,
    gateOpts,
  );

  const isLocalProvider = !provider.requiresCloudGrant;

  // ── (2) Pseudonymisierung + Redaction ─────────────────────────────────────
  // User-Nachrichten pseudonymisieren (interne Schüler-IDs → Pseudonyme)
  let processedMessages = req.messages;
  const pseudonymMap = new Map<string, string>();
  let redactionApplied = false;

  if (req.studentRefs && req.studentRefs.length > 0) {
    const newMessages: Message[] = [];
    for (const msg of req.messages) {
      if (msg.role === "user") {
        const { pseudonymizedText, pseudonymMap: pm } = await pseudonymizeText(
          pseudonymDeps,
          msg.content,
          req.studentRefs,
        );
        // Merging von Pseudonym-Maps (mehrere Nachrichten)
        for (const [ref, pid] of pm.mapping) {
          pseudonymMap.set(ref, pid);
        }
        newMessages.push({ ...msg, content: pseudonymizedText });
      } else {
        newMessages.push(msg);
      }
    }
    processedMessages = newMessages;
    if (pseudonymMap.size > 0) redactionApplied = true;
  }

  // Redact: PII in den User-Nachrichten maskieren
  const redactedMessages: Message[] = processedMessages.map((msg) => {
    if (msg.role === "user") {
      const { redactedText, foundPii } = redactFn(msg.content);
      if (foundPii.length > 0) redactionApplied = true;
      return { ...msg, content: redactedText };
    }
    return msg;
  });

  // ── (3) RAG-Retrieval ─────────────────────────────────────────────────────
  // Letzte User-Message als Query verwenden
  const queryMsg = [...redactedMessages].reverse().find((m) => m.role === "user");
  const query = queryMsg?.content ?? "";

  let citations: RankedCitation[] = [];
  if (query.trim().length > 0) {
    try {
      citations = await retrieve(retrieveDeps, query, req.retrieveOpts ?? {});
    } catch {
      // Retrieval-Fehler darf den Flow nicht blockieren (kein RAG-Kontext → fortfahren)
      await auditLogger.log({
        eventType: "RAG_RETRIEVAL_ERROR",
        actorId: req.userId,
        subject: req.subject,
        severity: "warning",
        details: { query: query.slice(0, 100) },
      });
    }
  }

  // RAG-Chunks als redacted Context-Strings
  const contextChunks = citations.map(
    (c) => `[${c.title} — ${c.publisher}, ${c.pageOrSection}]\n${c.chunkText}`,
  );

  // ── (4) Finalen Payload bauen + Guard ─────────────────────────────────────
  const payloadString = buildPayloadString(redactedMessages, contextChunks, req.system);

  try {
    assertNoPii(payloadString);
  } catch (err) {
    if (err instanceof PiiGuardError) {
      // Security-Event loggen (§3.2)
      await auditLogger.log({
        eventType: "PII_GUARD_FAILURE",
        actorId: req.userId,
        schoolId: req.schoolId,
        subject: req.subject,
        severity: "critical",
        details: {
          detectedPatterns: err.detectedPatterns,
          payloadLength: err.payloadLength,
          provider: provider.id,
          dataClass: req.dataClass,
        },
      });
    }
    // Re-throw: Provider wird NICHT aufgerufen (fail-closed)
    throw err;
  }

  // ── (5) Provider-Call ─────────────────────────────────────────────────────
  const chatResponse: ChatResponse = await provider.chat({
    messages: redactedMessages,
    system: req.system,
    contextChunks,
    context: requestContext,
    modelHint: req.modelHint,
  });

  // ── (6) Re-Identifikation (NUR lokal) ────────────────────────────────────
  let responseText = chatResponse.text;

  if (isLocalProvider && pseudonymMap.size > 0) {
    const pseudonymIds = Array.from(pseudonymMap.values());
    responseText = await reidentify(
      pseudonymDeps.repo,
      responseText,
      pseudonymIds,
    );
  }
  // Cloud-Pfad: keine Re-Identifikation — Pseudonyme bleiben in der Antwort

  // ── (7) Provenienz-Record ─────────────────────────────────────────────────
  const promptHash = promptFingerprint(payloadString);
  const sourceRefs = citations.map((c) => c.sourceId);
  const confidenceState: Record<string, unknown> = {
    citationCount: citations.length,
    confidences: citations.map((c) => ({ sourceId: c.sourceId, confidence: c.confidence })),
    overallConfidence: citations.length > 0
      ? (citations.every((c) => c.confidence === "GROUNDED") ? "GROUNDED" : "UNSUPPORTED_DRAFT")
      : "UNSUPPORTED_DRAFT",
  };

  await provenanceWriter.write({
    artifactType: req.artifactType ?? "STUDENT_FEEDBACK",
    artifactId: req.artifactId ?? "unknown",
    provider: chatResponse.provider,
    model: chatResponse.model,
    promptHash,
    redactionApplied,
    sourceRefs,
    confidenceState,
    ownerTeacherId: req.userId,
  });

  // ── (8) Audit-Log: erfolgreicher Call ────────────────────────────────────
  await auditLogger.log({
    eventType: "LLM_CALL_SUCCESS",
    actorId: req.userId,
    schoolId: req.schoolId,
    subject: req.subject,
    severity: "info",
    details: {
      provider: chatResponse.provider,
      model: chatResponse.model,
      dataClass: req.dataClass,
      redactionApplied,
      citationCount: citations.length,
    },
  });

  return {
    text: responseText,
    provider: chatResponse.provider,
    model: chatResponse.model,
    citations,
    redactionApplied,
    confidenceState,
  };
}
