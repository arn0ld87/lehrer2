import type { Metadata } from "next";
import { AppHeader } from "@/components/app-shell";
import { Card, CardHead, InlineLink } from "@/components/ui";
import { FilterButton } from "@/components/ui/shared";
import { MetricCard } from "@/components/dashboard/metric-card";
import { RecentWorkList } from "@/components/dashboard/recent-work-list";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { ActionCard, QuickSourcesCard } from "@/components/dashboard/action-card";
import { TrustPrinciples } from "@/components/dashboard/trust-principles";
import { getDashboardRepository } from "@/lib/db/repositories/dashboard.pg";

export const metadata: Metadata = { title: "Übersicht" };

export default async function DashboardPage() {
  const repo = getDashboardRepository();
  const [metrics, recent, activities, quickSources, trust] = await Promise.all([
    repo.metrics(),
    repo.recentWork(),
    repo.activities(),
    repo.sourceQuickAccess(),
    repo.trustPrinciples(),
  ]);

  return (
    <>
      <AppHeader
        title="Guten Morgen, Jana! 👋"
        subtitle="Hier ist dein Überblick für heute."
        primaryAction={{ icon: "plus", label: "Neu erstellen" }}
      />

      <div className="grid gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {metrics.map((m) => (
            <MetricCard key={m.id} metric={m} />
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.92fr)]">
          <Card>
            <CardHead
              title="Weiterarbeiten"
              subtitle="Kontextbezogene Entwürfe und zuletzt geöffnete Inhalte."
              action={
                <div className="flex gap-1 bg-canvas border border-line rounded-[11px] p-[3px]">
                  <FilterButton active>Zuletzt bearbeitet</FilterButton>
                  <FilterButton>Geplant</FilterButton>
                  <FilterButton>Favoriten</FilterButton>
                </div>
              }
            />
            <RecentWorkList items={recent} />
            <InlineLink href="/planung" className="mt-3.5">
              Alle Entwürfe anzeigen →
            </InlineLink>
          </Card>

          <Card>
            <CardHead
              title="Aktivitäten"
              subtitle="Nachvollziehbar, nicht mystisch."
              action={<FilterButton>Alle ⌄</FilterButton>}
            />
            <ActivityFeed items={activities} />
            <InlineLink href="/quelle" className="mt-1.5">
              Alle Aktivitäten →
            </InlineLink>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <ActionCard
            accent="purple"
            title="Unterricht planen"
            description="Erstelle lehrplanorientierte Einheiten mit Zielen, Methoden und belegten Kompetenzen."
            actionLabel="Neue Einheit planen"
          />
          <ActionCard
            accent="green"
            title="Arbeitsblatt erstellen"
            description="Erzeuge differenzierte Aufgaben, Hilfen und Lösungen, die du noch selbst verantwortest."
            actionLabel="Arbeitsblatt erstellen"
          />
          <ActionCard
            accent="orange"
            title="Korrektur unterstützen lassen"
            description="Lade pseudonymisierte Arbeiten hoch und erhalte strukturierte, überprüfbare Vorschläge."
            actionLabel="Korrekturen öffnen"
          />
          <QuickSourcesCard sources={quickSources} />
        </div>

        <TrustPrinciples items={trust} />
      </div>
    </>
  );
}