import type { Metadata } from "next";
import { AppHeader } from "@/components/app-shell";
import { SectionBanner } from "@/components/ui/shared";
import { WorksheetContainer } from "@/components/worksheet/worksheet-container";
import { getAvailableSubjects } from "@/lib/db/repositories/curriculum-subjects.pg";

export const metadata: Metadata = { title: "Arbeitsblätter" };

export default async function WorksheetsPage() {
  const subjects = await getAvailableSubjects();
  return (
    <>
      <AppHeader
        title="Arbeitsblätter"
        subtitle="Erstelle Material, das du fachlich verantworten und wirklich einsetzen kannst."
        primaryAction={{ icon: "plus", label: "Neu erstellen" }}
      />

      <div className="grid gap-5">
        <SectionBanner
          title="Arbeitsblätter, die nach Unterricht aussehen."
          description="Kein generischer KI-Zettel, sondern klar gegliedertes Material mit Differenzierung, Lösungen und sinnvoller Typografie."
          action={null}
        />

        <WorksheetContainer subjects={subjects} />
      </div>
    </>
  );
}
