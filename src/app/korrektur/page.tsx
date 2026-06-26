import type { Metadata } from "next";
import { AppHeader } from "@/components/app-shell";
import { SectionBanner } from "@/components/ui/shared";
import { CorrectionWorkspace } from "@/components/correction/correction-workspace";
import { getCorrectionRepository } from "@/lib/db/repositories/correction.pg";

export const metadata: Metadata = { title: "Korrekturassistenz" };

export default async function CorrectionPage() {
  const repo = getCorrectionRepository();
  const [meta, scores, feedbackStatements, history] = await Promise.all([
    repo.submissionMeta(),
    repo.rubricScores(),
    repo.feedbackStatements(),
    repo.history(),
  ]);

  return (
    <>
      <AppHeader
        title="Korrekturassistenz"
        subtitle="Arbeite mit Kriterien, Belegen und menschlicher Finalentscheidung."
      />

      <div className="grid gap-5">
        <SectionBanner
          title="Korrekturassistenz ohne Autopilot."
          description="Die Anwendung strukturiert Beobachtungen, bezieht sich auf dein Raster und zeigt Unsicherheiten. Die Bewertung bleibt bei dir."
        />

        <CorrectionWorkspace
          initialMeta={meta}
          initialScores={scores}
          initialStatements={feedbackStatements}
          history={history}
        />
      </div>
    </>
  );
}
