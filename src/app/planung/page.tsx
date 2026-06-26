import type { Metadata } from "next";
import { AppHeader } from "@/components/app-shell";
import { SectionBanner } from "@/components/ui/shared";
import { PlanningForm } from "@/components/planner/planning-form";
import { getPlanningRepository } from "@/lib/db/repositories/planning.pg";

export const metadata: Metadata = { title: "Unterrichtsplanung" };

export default async function PlanningPage() {
  const repo = getPlanningRepository();
  const [steps, phases, curriculum] = await Promise.all([
    repo.steps(),
    repo.structureProposal(),
    repo.curriculumFit(),
  ]);

  return (
    <>
      <AppHeader
        title="Unterrichtsplanung"
        subtitle="Plane lehrplanorientiert, passe an und behalte die Kontrolle."
        primaryAction={{ icon: "plus", label: "Neu erstellen" }}
      />

      <div className="grid gap-5">
        <SectionBanner
          title="Aus einer Idee wird eine nachvollziehbare Unterrichtseinheit."
          description="Kompetenzen, Methoden, Differenzierung und Quellen werden an einer Stelle zusammengeführt. Keine Zettelarchäologie mehr."
        />

        {/* PlanningForm ist Client-Shell: kapselt beide Grid-Reihen
            (Formular+Fortschritt, Proposal+Fit) damit useActionState-State
            ohne Context an die Ergebnis-Komponenten fließen kann. */}
        <PlanningForm
          initialSteps={steps}
          initialPhases={phases}
          initialCurriculum={curriculum}
        />
      </div>
    </>
  );
}
