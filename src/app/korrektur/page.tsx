import type { Metadata } from "next";
import { AppHeader } from "@/components/app-shell";
import { Button } from "@/components/ui";
import { Icon } from "@/components/ui/icon";
import { SectionBanner } from "@/components/ui/shared";
import { SubmissionPreview } from "@/components/correction/submission-preview";
import { RubricScoreCard } from "@/components/correction/rubric-score-card";
import { FeedbackDraft } from "@/components/correction/feedback-draft";
import { CorrectionHistory } from "@/components/correction/correction-history";
import { mockCorrectionRepository } from "@/lib/mock";

export const metadata: Metadata = { title: "Korrekturassistenz" };

export default function CorrectionPage() {
  const repo = mockCorrectionRepository;
  const meta = repo.submissionMeta();
  const scores = repo.rubricScores();
  const feedbackStatements = repo.feedbackStatements();
  const history = repo.history();

  return (
    <>
      <AppHeader
        title="Korrekturassistenz"
        subtitle="Arbeite mit Kriterien, Belegen und menschlicher Finalentscheidung."
        primaryAction={{ icon: "plus", label: "Arbeit hinzufügen" }}
      />

      <div className="grid gap-5">
        <SectionBanner
          title="Korrekturassistenz ohne Autopilot."
          description="Die Anwendung strukturiert Beobachtungen, bezieht sich auf dein Raster und zeigt Unsicherheiten. Die Bewertung bleibt bei dir."
          action={
            <Button variant="secondary">
              <Icon name="plus" width={16} height={16} />
              Arbeit hinzufügen
            </Button>
          }
        />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(310px,0.7fr)]">
          <SubmissionPreview
            title={meta.title}
            subjectLabel={meta.subjectLabel}
            submittedAt={meta.submittedAt}
            pseudonym={meta.pseudonym}
          />
          <div className="grid gap-5 content-start">
            <RubricScoreCard scores={scores} />
            <FeedbackDraft statements={feedbackStatements} />
            <CorrectionHistory entries={history} />
          </div>
        </div>
      </div>
    </>
  );
}