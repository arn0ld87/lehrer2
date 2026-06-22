/**
 * Backend-Factory für SourceEntriesReader und SourceRepository.
 *
 * Umgebungsvariable REPOSITORY_BACKEND steuert das Backend:
 *   "db"  → PgSourcesRepository (echte Postgres-Verbindung)
 *   sonst → In-Memory-Mock-Impl mit denselben Gate-Regeln (Default)
 *
 * getSourceEntriesReader() — schmaler Legacy-Adapter (M1-Compat, NICHT entfernen)
 * getSourceRepository()    — vollständiger Lifecycle-Vertrag (M2)
 */

import { randomUUID } from "crypto";
import { mockSourcesRepository } from "@/lib/mock";
import { PgSourcesRepository } from "./sources.pg";
import type {
  SourceApproveMeta,
  SourceCreateInput,
  SourceEntriesReader,
  SourceRegisterMeta,
  SourceRepository,
} from "@/lib/repositories";
import type { SourceEntry, SourceTrust } from "@/lib/types";

// ---------------------------------------------------------------------------
// Legacy-Adapter (M1-Compat)
// ---------------------------------------------------------------------------

export function getSourceEntriesReader(): SourceEntriesReader {
  if (process.env.REPOSITORY_BACKEND === "db") {
    return new PgSourcesRepository();
  }
  // Async-Adapter: kapselt den sync-Mock hinter das async-Interface,
  // damit Aufrufer nicht zwischen sync und async unterscheiden müssen.
  return {
    async entries() {
      return mockSourcesRepository.entries();
    },
  };
}

// ---------------------------------------------------------------------------
// In-Memory-Lifecycle-Mock (dieselben Gate-Regeln wie PgSourcesRepository)
// ---------------------------------------------------------------------------

type MockSourceRow = SourceEntry & {
  lifecycleStatus: string;
  licenseVerified: boolean;
  sourceType: SourceTrust;
  approvalMetadata?: unknown;
};

class MockSourceRepository implements SourceRepository {
  private readonly store = new Map<string, MockSourceRow>();

  async entries(): Promise<SourceEntry[]> {
    return this.list();
  }

  async list(): Promise<SourceEntry[]> {
    return Array.from(this.store.values()).map((r) => ({
      id: r.id,
      title: r.title,
      origin: r.origin,
      subject: r.subject,
      gradeRange: r.gradeRange,
      trust: r.trust,
      version: r.version,
      license: r.license,
      status: r.status,
    }));
  }

  async get(id: string): Promise<SourceEntry | null> {
    const row = this.store.get(id);
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      origin: row.origin,
      subject: row.subject,
      gradeRange: row.gradeRange,
      trust: row.trust,
      version: row.version,
      license: row.license,
      status: row.status,
    };
  }

  async create(input: SourceCreateInput): Promise<string> {
    const id = randomUUID();
    this.store.set(id, {
      id,
      title: input.title,
      origin: input.uri ?? "—",
      subject: "deutsch", // Interim-Placeholder (kein DB-Mapping im Mock)
      gradeRange: "—",
      trust: input.sourceType,
      version: "1",
      license: input.licenseInfo ?? "—",
      status: "active",
      lifecycleStatus: "DISCOVERED",
      licenseVerified: false,
      sourceType: input.sourceType,
    });
    return id;
  }

  async register(id: string, meta: SourceRegisterMeta): Promise<void> {
    const row = this.store.get(id);
    if (!row) throw new Error(`Mock sourceRef ${id} nicht gefunden`);
    if (row.lifecycleStatus !== "DISCOVERED" && row.lifecycleStatus !== "UNDER_REVIEW") {
      throw new Error(
        `register() erfordert Status DISCOVERED oder UNDER_REVIEW, ist aber ${row.lifecycleStatus}`,
      );
    }
    row.lifecycleStatus = "REGISTERED";
    if (meta.licenseInfo !== undefined) row.license = meta.licenseInfo;
    if (meta.licenseVerified !== undefined) row.licenseVerified = meta.licenseVerified;
    if (meta.approvalMetadata !== undefined) row.approvalMetadata = meta.approvalMetadata;
  }

  /**
   * approve() — FAIL-CLOSED Gate (identisch zu PgSourcesRepository):
   *   - lifecycleStatus muss "REGISTERED" sein
   *   - licenseVerified muss true sein
   *   - sourceType darf nicht "UNVERIFIED" sein
   */
  async approve(id: string, meta: SourceApproveMeta): Promise<void> {
    const row = this.store.get(id);
    if (!row) throw new Error(`Mock sourceRef ${id} nicht gefunden`);

    if (row.lifecycleStatus !== "REGISTERED") {
      throw new Error(
        `approve() erfordert Status REGISTERED, ist aber ${row.lifecycleStatus}`,
      );
    }
    if (!row.licenseVerified) {
      throw new Error(
        `approve() verweigert: licenseVerified ist false für sourceRef ${id}`,
      );
    }
    if (row.sourceType === "UNVERIFIED") {
      throw new Error(
        `approve() verweigert: sourceType UNVERIFIED darf nie in APPROVED überführt werden (sourceRef ${id})`,
      );
    }

    row.lifecycleStatus = "APPROVED";
    row.status = "active";
    // Parität mit PgSourcesRepository: approvalMetadata persistieren.
    if (meta.approvalMetadata !== undefined) row.approvalMetadata = meta.approvalMetadata;
  }

  async revoke(id: string): Promise<void> {
    const row = this.store.get(id);
    if (!row) throw new Error(`Mock sourceRef ${id} nicht gefunden`);
    row.lifecycleStatus = "REVOKED";
    row.status = "rejected";
  }

  async ingestMark(id: string): Promise<void> {
    const row = this.store.get(id);
    if (!row) throw new Error(`Mock sourceRef ${id} nicht gefunden`);
    if (row.lifecycleStatus !== "APPROVED") {
      throw new Error(
        `ingestMark() erfordert Status APPROVED, ist aber ${row.lifecycleStatus}`,
      );
    }
    row.lifecycleStatus = "INGESTED";
  }
}

// ---------------------------------------------------------------------------
// Öffentliche Factory
// ---------------------------------------------------------------------------

export function getSourceRepository(): SourceRepository {
  if (process.env.REPOSITORY_BACKEND === "db") {
    return new PgSourcesRepository();
  }
  return new MockSourceRepository();
}
