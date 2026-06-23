/**
 * Datenschutz-Tabellen: CloudReleaseGrant + PseudonymMapping
 *
 * SICHERHEITSHINWEIS:
 * - pseudonym_mappings: NIEMALS an Provider / Cloud senden. Nur lokaler DB-Zugriff.
 *   Die Tabelle verbindet student_id ↔ pseudonym_id und darf das System nie verlassen.
 * - cloud_release_grants: Rechtliche Freigaben für Cloud-LLM-Calls (ADR 0002 §109,
 *   REDACTION_AND_GUARD_SPEC.md §4).
 */

import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { avvStatusEnum, cloudProviderEnum, cloudRegionEnum, grantIssuerRoleEnum } from "../enums";

/**
 * CloudReleaseGrant — zwingende Voraussetzung für Cloud-LLM-Calls.
 *
 * Invarianten (REDACTION_AND_GUARD_SPEC.md §4.2):
 * 1. Ohne gültigen (nicht abgelaufenen) Grant → fail-closed (kein Cloud-Call).
 * 2. Scope (subjects / gradeBands) muss zum aktuellen Anfrage-Kontext passen.
 * 3. Jede Erstellung / Änderung wird im audit_log geloggt.
 */
export const cloudReleaseGrant = pgTable("cloud_release_grants", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull(),

  // Welcher Cloud-Provider und in welcher Region
  provider: cloudProviderEnum("provider").notNull(),
  region: cloudRegionEnum("region").notNull(),

  // Rechtliche Basis (REDACTION_AND_GUARD_SPEC.md §4.1)
  legalBasis: text("legal_basis").notNull(),
  dsfaId: text("dsfa_id").notNull(),
  avvStatus: avvStatusEnum("avv_status").notNull().default("pending"),

  // Geltungsbereich als JSONB: { subjects: string[], gradeBands: string[] }
  scope: jsonb("scope").notNull().$type<{ subjects: string[]; gradeBands: string[] }>(),

  // Zeitliche Gültigkeit
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
  validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),

  // Aussteller
  issuerName: text("issuer_name").notNull(),
  issuerRole: grantIssuerRoleEnum("issuer_role").notNull(),

  // Audit
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * PseudonymMapping — Mapping student_id ↔ pseudonym_id.
 *
 * !! NIEMALS AN PROVIDER / CLOUD SENDEN !!
 *
 * Algorithmus (REDACTION_AND_GUARD_SPEC.md §1.1):
 *   pseudonym_id = BASE64_URL_SAFE(HMAC_SHA256(school_secret, student_id))
 *
 * Die Tabelle bleibt ausschließlich im lokalen Postgres-System (verschlüsselt).
 * Re-Identifikation ist nur lokal möglich — nie über einen externen Provider.
 */
export const pseudonymMapping = pgTable("pseudonym_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Stabiles Pseudonym (BASE64_URL_SAFE HMAC-SHA256) */
  pseudonymId: text("pseudonym_id").notNull().unique(),
  /**
   * Echte interne Schüler-Referenz (DB-ID oder opaker Verweis).
   * NIEMALS Klarname — nur die interne ID aus dem Schulsystem.
   */
  studentRef: text("student_ref").notNull(),
  schoolId: uuid("school_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
