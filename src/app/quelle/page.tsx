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
import { db } from "@/lib/db/client";
import { ragChunk } from "@/lib/db/schema/rag";
import { sql } from "drizzle-orm";
import type { RagQuality } from "@/lib/types";

export const metadata: Metadata = { title: "Quellen & Lehrpläne" };

export default async function SourcesPage() {
  const reader = getSourceEntriesReader();
  const entries = await reader.entries();

  // Echte RAG-Kennzahlen aus der DB (keine Mock-Werte mehr).
  const [{ chunks = 0, indexedSources = 0 } = {}] = await db
    .select({
      chunks: sql<number>`count(*)::int`,
      indexedSources: sql<number>`count(distinct ${ragChunk.sourceRefId})::int`,
    })
    .from(ragChunk);

  const total = entries.length;
  const withLicense = entries.filter((e) => e.license && e.license !== "—").length;
  const needingReview = Math.max(0, total - indexedSources);
  const quality: RagQuality = {
    metadataCoverage: total ? Math.round((withLicense / total) * 100) : 0,
    // Anteil der Register-Quellen, die tatsächlich im RAG-Index liegen
    goldenQuestionRecall: total ? Math.round((indexedSources / total) * 100) : 0,
    sourcesNeedingReview: needingReview,
    indexFreshness: chunks > 0 ? "aktuell" : "leer",
  };
  // Governance-Hinweise (statische Regeln) weiterhin aus der Mock-Schicht.
  const checks = mockSourcesRepository.governanceChecks();

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
            label="Quellen im Register"
            value={total.toLocaleString("de-DE")}
            hint={`${indexedSources.toLocaleString("de-DE")} im RAG-Index`}
            hintClass="text-success"
          />
          <MiniKpi
            label="Noch nicht indexiert"
            value={needingReview.toLocaleString("de-DE")}
            hint="Registrierung/Freigabe ausstehend"
            hintClass={needingReview > 0 ? "text-warning" : "text-success"}
          />
          <MiniKpi
            label="Chunks im RAG-Index"
            value={chunks.toLocaleString("de-DE")}
            hint={chunks > 0 ? "lokal + OpenAI-Embeddings" : "noch keine Ingestion"}
            hintClass={chunks > 0 ? "text-success" : "text-muted"}
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