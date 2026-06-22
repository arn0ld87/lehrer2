import type { Metadata } from "next";
import { AppHeader } from "@/components/app-shell";
import { Card, CardHead, Button } from "@/components/ui";
import { Icon } from "@/components/ui/icon";
import { SectionBanner } from "@/components/ui/shared";
import { SourceFilterBar } from "@/components/sources/source-filter-bar";
import { SourceTable } from "@/components/sources/source-table";
import { RagQualityCard } from "@/components/sources/rag-quality-card";
import { mockSourcesRepository } from "@/lib/mock";
import { getSourceEntriesReader } from "@/lib/db/repositories/factory";

export const metadata: Metadata = { title: "Quellen & Lehrpläne" };

export default async function SourcesPage() {
  const reader = getSourceEntriesReader();
  const entries = await reader.entries();
  const repo = mockSourcesRepository;
  const quality = repo.ragQuality();
  // RAG-Layer / M2.2 gehoert hier hin, wenn implementiert; vorlaeufig vom Mock:
  const checks = repo.governanceChecks();

  return (
    <>
      <AppHeader
        title="Quellen & Lehrpläne"
        subtitle="Registriere, prüfe und versioniere die fachliche Grundlage deiner Antworten."
        primaryAction={{ icon: "plus", label: "Quelle erfassen" }}
      />

      <div className="grid gap-5">
        <SectionBanner
          title="Quellen sind Teil des Produkts, nicht Dekoration."
          description="Jede Quelle braucht Herkunft, Version, Lizenzstatus, Fachkontext und nachvollziehbare Freigabe. Überraschend, aber genau so vermeidet man später Chaos."
          action={
            <Button variant="secondary">
              <Icon name="plus" width={16} height={16} />
              Quelle erfassen
            </Button>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MiniKpi
            label="Verifizierte Quellen"
            value="248"
            hint="+ 5 diese Woche"
            hintClass="text-success"
          />
          <MiniKpi
            label="In Lizenzprüfung"
            value="11"
            hint="manuelle Freigabe nötig"
            hintClass="text-warning"
          />
          <MiniKpi
            label="RAG-Index aktuell"
            value="99,2 %"
            hint={`letzte Prüfung: heute`}
            hintClass="text-success"
          />
        </div>

        <Card>
          <CardHead
            title="Quellenregister"
            subtitle="Amtliche und freigegebene Quellen mit Versionierung."
            action={
              <Button variant="secondary" size="small">
                <Icon name="download" width={14} height={14} />
                Register exportieren
              </Button>
            }
          />
          <SourceFilterBar />
          <SourceTable entries={entries} />
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <RagQualityCard quality={quality} />
          <Card>
            <CardHead
              title="Governance-Check"
              subtitle="Relevante Regeln vor der nächsten Ingestion."
            />
            <div className="grid gap-2">
              {checks.map((c, i) => (
                <div
                  key={c.id}
                  className="flex items-start gap-2.5 p-3 border border-line rounded-[12px]"
                >
                  <span className="grid place-items-center w-[21px] h-[21px] rounded-[7px] bg-primary-soft text-primary text-[11px] font-extrabold shrink-0">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <strong className="block text-[11px]">{c.title}</strong>
                    <span className="block text-[10px] text-muted mt-0.5">{c.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function MiniKpi({
  label,
  value,
  hint,
  hintClass,
}: {
  label: string;
  value: string;
  hint: string;
  hintClass: string;
}) {
  return (
    <article className="p-3.5 border border-line rounded-[13px] bg-surface">
      <span className="block text-[10px] text-muted">{label}</span>
      <strong className="font-display text-[21px] tracking-[-0.05em] block mt-0.5">
        {value}
      </strong>
      <span className={`block mt-1 text-[10px] ${hintClass}`}>{hint}</span>
    </article>
  );
}