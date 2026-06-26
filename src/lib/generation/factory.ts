/**
 * factory.ts — Verdrahtung aller GenerationDeps für den lokalen Default-Pfad
 *
 * PgAuditSink: Schreibt Audit-Events in audit_log.
 *   - details-Feld: NIEMALS Klarnamen, Schülernamen oder sonstiges PII.
 *   - event.detail → { detail: string } (jsonb); fehlt → null.
 *   - severity wird direkt durchgereicht (Subset von auditSeverityEnum).
 *
 * createGenerationDeps():
 *   Erzeugt vollständig verdrahtete GenerationDeps.
 *   Default: local-first (withGate(OllamaChatProvider, providerKind:'local')).
 *   Override: CLOUD_LLM_ENABLED=true → createGatedCloudProvider('openai')
 *   (gegateter Cloud-Pfad; nur mit dokumentiertem, aktivem CloudReleaseGrant
 *   wirksam — Redaction + Grant-Check + Guard + Audit bleiben fail-closed).
 */

import { db as defaultDb } from "@/lib/db/client";
import type { Db } from "@/lib/db/client";
import { auditLog } from "@/lib/db/schema/provenance";
import { createGatedCloudProvider, createLLMProvider, withGate, type AuditSink } from "@/lib/llm";
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
 * Cloud-Override (explizite Nutzerfreigabe 2026-06-26): bei CLOUD_LLM_ENABLED=true
 * wird createGatedCloudProvider('openai') verwendet — fail-closed nur mit aktivem
 * CloudReleaseGrant (gate.ts). Sonst bleibt der lokale Pfad Default.
 */
export function createGenerationDeps(): GenerationDeps {
  const db = defaultDb;
  const audit = new PgAuditSink(db);
  const grantReader = new PgGrantReader();
  // Embeddings bleiben IMMER lokal (OllamaEmbedder via createEmbedder()).
  // Nur der Chat-/Generierungs-Provider wird bei aktivem Cloud-Flag umgeschaltet.
  const provider =
    process.env.CLOUD_LLM_ENABLED === "true"
      ? createGatedCloudProvider({ name: "openai", grantReader, audit })
      : withGate(createLLMProvider(), {
          providerKind: "local",
          grantReader,
          audit,
        });
  const embedder = createEmbedder();
  const store = createVectorStore();
  const sourceRefReader = new PgSourceRefReader();

  return { db, provider, embedder, store, sourceRefReader, audit };
}
