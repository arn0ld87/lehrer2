import type { Metadata } from "next";
import { AppHeader } from "@/components/app-shell";
import { Button } from "@/components/ui";
import { SectionBanner } from "@/components/ui/shared";
import { PlanningForm } from "@/components/planner/planning-form";
import { PlanningProgress } from "@/components/planner/planning-progress";
import { StructureProposal } from "@/components/planner/structure-proposal";
import { CurriculumFitCard } from "@/components/planner/curriculum-fit-card";
import { mockPlanningRepository } from "@/lib/mock";

export const metadata: Metadata = { title: "Unterrichtsplanung" };

export default function PlanningPage() {
  const repo = mockPlanningRepository;
  const steps = repo.steps();
  const phases = repo.structureProposal();
  const curriculum = repo.curriculumFit();

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
          action={<Button variant="secondary">Vorlage verwenden</Button>}
        />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
          <PlanningForm />
          <PlanningProgress steps={steps} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.92fr)]">
          <StructureProposal phases={phases} />
          <CurriculumFitCard items={curriculum} />
        </div>
      </div>
    </>
  );
}