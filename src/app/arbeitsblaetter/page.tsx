import type { Metadata } from "next";
import { AppHeader } from "@/components/app-shell";
import { Button } from "@/components/ui";
import { Icon } from "@/components/ui/icon";
import { SectionBanner } from "@/components/ui/shared";
import { BuilderPanel } from "@/components/worksheet/builder-panel";
import { WorksheetPreview } from "@/components/worksheet/worksheet-preview";

export const metadata: Metadata = { title: "Arbeitsblätter" };

export default function WorksheetsPage() {
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
          action={
            <Button variant="secondary">
              <Icon name="download" width={16} height={16} />
              Als PDF exportieren
            </Button>
          }
        />

        <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          <BuilderPanel />
          <WorksheetPreview />
        </div>
      </div>
    </>
  );
}