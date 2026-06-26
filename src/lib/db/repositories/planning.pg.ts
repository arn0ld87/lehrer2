/**
 * Planning-Repository (DB-gestützt) + Backend-Factory.
 *
 *   steps()            → feste Workflow-Struktur (Konstante; done wird clientseitig
 *                        an den echten Formularzustand gekoppelt).
 *   structureProposal()→ leer: der Vorschlag entsteht erst durch Generierung
 *                        (keine erfundene Initial-Vorschau).
 *   curriculumFit()    → echte Kompetenzknoten des dominanten aktiven Strangs mit
 *                        echter Quellenangabe (frameworkAuthority + Version).
 *
 * Fällt bei DB-Fehler/leerer DB auf die Mock-Schicht zurück. Konfessionstrennung
 * bleibt gewahrt: der Strang trägt subject + confessionContext.
 */

import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { curriculumNode, curriculumStrand } from "@/lib/db/schema/curriculum";
import { mockPlanningRepository } from "@/lib/mock";
import type { AsyncPlanningRepository } from "@/lib/repositories";
import type { CurriculumFit, PlanningStep, StructurePhase } from "@/lib/types";

export class PgPlanningRepository implements AsyncPlanningRepository {
  async steps(): Promise<PlanningStep[]> {
    // Feste Workflow-Schritte (keine erfundenen Daten — die Abfolge ist das Produkt).
    return mockPlanningRepository.steps();
  }

  async structureProposal(): Promise<StructurePhase[]> {
    // Bewusst leer: die Struktur wird erst durch die Generierung erzeugt.
    return [];
  }

  async curriculumFit(): Promise<CurriculumFit[]> {
    try {
      const [strand] = await db
        .select()
        .from(curriculumStrand)
        .where(eq(curriculumStrand.status, "ACTIVE"))
        .orderBy(asc(curriculumStrand.subject))
        .limit(1);
      if (!strand) return [];

      const nodes = await db
        .select()
        .from(curriculumNode)
        .where(eq(curriculumNode.strandId, strand.id))
        .orderBy(asc(curriculumNode.code))
        .limit(6);

      if (nodes.length === 0) return [];

      const sourceHint = `${strand.frameworkAuthority}, ${strand.version}`;
      return nodes.map((n) => ({
        id: n.id,
        label: n.title,
        detail: n.description ?? n.competenceArea ?? "Kompetenzbereich des Lehrplans",
        // Echter Lehrplanknoten → belegt (mit nachvollziehbarer Quelle).
        status: "belegt" as const,
        sourceHint,
      }));
    } catch {
      return mockPlanningRepository.curriculumFit();
    }
  }
}

/** Backend-Factory: REPOSITORY_BACKEND=db → Postgres, sonst Mock-Adapter (sync→async). */
export function getPlanningRepository(): AsyncPlanningRepository {
  if (process.env.REPOSITORY_BACKEND === "db") {
    return new PgPlanningRepository();
  }
  return {
    async steps() {
      return mockPlanningRepository.steps();
    },
    async structureProposal() {
      return mockPlanningRepository.structureProposal();
    },
    async curriculumFit() {
      return mockPlanningRepository.curriculumFit();
    },
  };
}
