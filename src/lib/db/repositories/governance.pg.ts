/**
 * Governance-Checks (DB-gestützt) + Backend-Factory.
 *
 * Übersetzt den realen Quellen-Lifecycle-Zustand (sourceRef) in die Governance-
 * Hinweise, die `/quelle` vor der nächsten Ingestion anzeigt. Statt statischer
 * Mock-Texte werden echte Counts je lifecycleStatus/sourceType aggregiert und mit
 * den bindenden Governance-Regeln (Konfessionstrennung, Lizenzpflicht) kombiniert.
 *
 * Datenschutz: ausschließlich Quellen-Metadaten, kein PII.
 */

import { isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sourceRef } from "@/lib/db/schema/artifacts";
import { mockSourcesRepository } from "@/lib/mock";

export interface GovernanceCheck {
  id: string;
  title: string;
  detail: string;
}

/**
 * Aggregiert den realen Lifecycle-Zustand und baut daraus die Hinweisliste.
 * Dynamische Hinweise (mit echten Counts) zuerst, danach die immer geltenden
 * bindenden Regeln. Fällt bei DB-Fehler/Mock-Backend auf die Mock-Hinweise zurück.
 */
export async function getGovernanceChecks(): Promise<GovernanceCheck[]> {
  if (process.env.REPOSITORY_BACKEND !== "db") {
    return mockSourcesRepository.governanceChecks();
  }

  try {
    const rows = await db
      .select({
        lifecycleStatus: sourceRef.lifecycleStatus,
        sourceType: sourceRef.sourceType,
        count: sql<number>`count(*)::int`,
      })
      .from(sourceRef)
      .where(isNull(sourceRef.deletedAt))
      .groupBy(sourceRef.lifecycleStatus, sourceRef.sourceType);

    const sumWhere = (pred: (r: (typeof rows)[number]) => boolean): number =>
      rows.filter(pred).reduce((acc, r) => acc + (r.count ?? 0), 0);

    const unverified = sumWhere((r) => r.sourceType === "UNVERIFIED");
    const registered = sumWhere((r) => r.lifecycleStatus === "REGISTERED");
    const approved = sumWhere((r) => r.lifecycleStatus === "APPROVED");

    const checks: GovernanceCheck[] = [];

    checks.push({
      id: "gov-unverified",
      title:
        unverified > 0
          ? `${unverified} UNVERIFIED-Quelle(n) bleiben aus dem produktiven RAG`
          : "Keine UNVERIFIED-Quellen im produktiven Bestand",
      detail:
        "UNVERIFIED ist die niedrigste Vertrauensstufe und darf nie produktiv im RAG stehen (ADR 0003).",
    });

    if (registered > 0) {
      checks.push({
        id: "gov-registered",
        title: `${registered} Quelle(n) registriert, Freigabe ausstehend`,
        detail:
          "REGISTERED → APPROVED ist fail-closed: nur mit verifizierter Lizenz und zulässiger Vertrauensstufe.",
      });
    }

    if (approved > 0) {
      checks.push({
        id: "gov-approved",
        title: `${approved} Quelle(n) freigegeben, Ingestion ausstehend`,
        detail: "APPROVED → INGESTED überführt die Quelle in den RAG-Index.",
      });
    }

    checks.push({
      id: "gov-confession",
      title: "Konfessionstrennung ist erzwungen",
      detail:
        "Ev./kath./konfessionssensibel werden über den curriculum_strand-CHECK getrennt gehalten; kein Cross-Strang-Retrieval.",
    });

    checks.push({
      id: "gov-license",
      title: "Lizenz- und Quellenpflicht je Aussage",
      detail:
        "Jede curriculare Aussage trägt Quelle, Version, Abschnitt/Seite und Abrufdatum (Quellenpflicht).",
    });

    return checks;
  } catch {
    // DB nicht verfügbar → Mock-Hinweise (Regeln bleiben sichtbar, keine Fake-Counts)
    return mockSourcesRepository.governanceChecks();
  }
}
