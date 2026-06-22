/**
 * Backend-Factory für SourceEntriesReader.
 *
 * Umgebungsvariable REPOSITORY_BACKEND steuert das Backend:
 *   "db"  → PgSourcesRepository (echte Postgres-Verbindung)
 *   sonst → async-Wrapper um den synchronen Mock (Default)
 *
 * So können Server-Components dieselbe Schnittstelle (SourceEntriesReader)
 * nutzen, unabhängig davon, ob gerade ein DB-Container läuft oder nicht.
 */

import { mockSourcesRepository } from "@/lib/mock";
import { PgSourcesRepository } from "./sources.pg";
import type { SourceEntriesReader } from "@/lib/repositories";

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
