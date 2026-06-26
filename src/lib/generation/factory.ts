/**
 * factory.ts — Verdrahtung aller GenerationDeps für den lokalen Default-Pfad
 *
 * PgAuditSink: Schreibt Audit-Events in audit_log.
 *   - details-Feld: NIEMALS Klarnamen, Schülernamen oder sonstiges PII.
 *   - event.detail → { detail: string } (jsonb); fehlt → null.
 *   - severity wird direkt durchgereicht (Subset von auditSeverityEnum).
 *
 * createGenerationDeps():
 *   Erzeugt vollständig verdrahtete GenerationDeps für den lokalen Pfad.
 *   Slice: CLOUD_LLM_ENABLED=false — NIEMALS createGatedCloudProvider hier.
 *   providerKind ist fix auf 'local' (BLOCKER-B aus gate.ts).
 */

import { db as defaultDb } from "@/lib/db/client";
import type { Db } from "@/lib/db/client";
import { auditLog } from "@/lib/db/schema/provenance";
import { createLLMProvider, withGate, type AuditSink } from "@/lib/llm";
import { createEmbedder, createVectorStore } from "@/lib/infra";
import { PgGrantReader } from "@/lib/db/repositories/grants.pg";
import { PgSourceRefReader } from "@/lib/rag/source-ref-reader.pg";
import type { GenerationDeps } from "./deps";

// ── PgAuditSink ───────────────────────────────────────────────────────────────

/**
 * Schreibt Audit-Events in die audit_log-Tabelle.
 *
 * Datenschutz (KRITISCH):
 * - details darf NIEMALS Klarnamen, Schülernamen oder PII enthalten —
 *   nur technische Metadaten (Flags, pseudonyme IDs, Kategorien).
 * - event.detail wird als { detail: string } in das jsonb-Feld verpackt;
 *   fehlt event.detail → null.
 * - severity wird direkt durchgereicht (AuditSink-Typ ist Subset von
 *   auditSeverityEnum und damit direkt zuweisbar).
 *
 * Testbarkeit: db-Argument ist optional — in Tests eine gefakte Drizzle-Instanz
 * übergeben, im Produktivcode verwendet PgAuditSink den Singleton aus client.ts.
 */
export class PgAuditSink implements AuditSink {
  constructor(private readonly db: Db = defaultDb) {}

  async record(event: {
    eventType: string;
    actorId?: string;
    subject?: string;
    severity: "info" | "warning" | "critical";
    /** Technische Metadaten — kein PII, keine Klarnamen */
    detail?: string;
  }): Promise<void> {
    await this.db.insert(auditLog).values({
      eventType: event.eventType,
      actorId: event.actorId ?? null,
      subject: event.subject ?? null,
      // Mapping: event.detail (singular) → details (jsonb, plural)
      details: event.detail != null ? { detail: event.detail } : null,
      severity: event.severity,
    });
  }
}

// ── createGenerationDeps ──────────────────────────────────────────────────────

/**
 * Erzeugt vollständig verdrahtete GenerationDeps für den lokalen Default-Pfad.
 *
 * Verdrahtung:
 *   - db           → Postgres-Singleton (src/lib/db/client.ts)
 *   - audit        → PgAuditSink(db)
 *   - grantReader  → PgGrantReader (wird vom Gate für Cloud-Prüfungen verwendet,
 *                    im lokalen Pfad nicht aktiv aufgerufen)
 *   - provider     → withGate(OllamaChatProvider, { providerKind:'local', ... })
 *   - embedder     → OllamaEmbedder
 *   - store        → QdrantStore
 *   - sourceRefReader → PgSourceRefReader
 *
 * WICHTIG: NIE createGatedCloudProvider hier — lokaler Pfad ist Default.
 * providerKind ist fix auf 'local' (BLOCKER-B, gate.ts).
 */
export function createGenerationDeps(): GenerationDeps {
  const db = defaultDb;
  const audit = new PgAuditSink(db);
  const grantReader = new PgGrantReader();
  const provider = withGate(createLLMProvider(), {
    providerKind: "local",
    grantReader,
    audit,
  });
  const embedder = createEmbedder();
  const store = createVectorStore();
  const sourceRefReader = new PgSourceRefReader();

  return { db, provider, embedder, store, sourceRefReader, audit };
}
