import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { school } from "./tenant";

/**
 * CloudReleaseGrant — Freigabedokument für Cloud-LLM-Provider (ADR 0002, ADR 0004).
 *
 * Ein Grant erlaubt dem System, einen externen LLM-Provider für einen bestimmten
 * Scope (Fach, Klassenstufe) zu verwenden. Ohne gültigen, zeitlich aktiven Grant
 * ist jeder Cloud-Provider-Aufruf fail-closed blockiert (gate.ts §LLM-Request-Fluss).
 *
 * Felder:
 *   - scopeSubjects: leeres Array = alle Fächer freigegeben
 *   - scopeGradeBands: leeres Array = alle Klassenstufen freigegeben
 *   - legalBasis: Rechtsgrundlage (z. B. "DSGVO Art. 28 + AVV vom 2026-01-01")
 *   - avvStatus: AVV-Status gemäß Spec §4.1 ("signed" | "pending")
 *   - dsfaId: Referenz auf die Datenschutz-Folgenabschätzung (nullable)
 *   - region: Rechenzentrumsregion des Providers (z. B. "eu-central-1")
 *   - issuerName/issuerRole: Unterzeichner (Schulleitung, DSB, …)
 *
 * TODO (Phase 3): Gate-Enforcement von avvStatus === 'signed' und region in gate.ts.
 * Die Spalten werden jetzt persistiert; vollständige Validierung folgt nach DSFA-Review.
 */
export const cloudReleaseGrant = pgTable("cloud_release_grant", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => school.id, { onDelete: "restrict" }),
  provider: text("provider").notNull(),
  scopeSubjects: text("scope_subjects").array().notNull().default([]),
  scopeGradeBands: text("scope_grade_bands").array().notNull().default([]),
  legalBasis: text("legal_basis").notNull(),
  /** AVV-Unterzeichnungs-Status (Spec §4.1: "signed" | "pending") */
  avvStatus: text("avv_status").notNull().default("pending"),
  /** Referenz auf die Datenschutz-Folgenabschätzung (Spec §4.1: dsfaId) */
  dsfaId: text("dsfa_id"),
  /** Rechenzentrumsregion des Providers (Spec §4.1: z. B. "eu-central-1") */
  region: text("region").notNull(),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
  validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
  issuerName: text("issuer_name").notNull(),
  issuerRole: text("issuer_role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
