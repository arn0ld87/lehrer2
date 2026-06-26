"use client";

import * as React from "react";
import { Badge, StatusChip, Notice, Button } from "../ui";
import { Icon } from "../ui/icon";
import { exportWorksheetAction } from "@/app/actions/export";
import type { WorksheetActionResult } from "@/app/actions/worksheet";

// ── Statischer Platzhalter (wird angezeigt solange kein Ergebnis vorliegt) ───

interface WorksheetTask {
  title: string;
  instruction: string;
  linesHeight?: number;
}

const PLACEHOLDER_TASKS: WorksheetTask[] = [
  {
    title: "Aufgabe 1 · Figur wahrnehmen",
    instruction:
      "Markiere Aussagen, Handlungen und Gedanken, die etwas über Jana zeigen. Notiere zu jeder Markierung ein mögliches Merkmal.",
  },
  {
    title: "Aufgabe 2 · Textbelege ordnen",
    instruction:
      "Sortiere deine Belege in die Kategorien Aussehen, Verhalten, Sprache, Beziehungen. Entscheide, welche Kategorie für deine Charakterisierung besonders wichtig ist.",
  },
  {
    title: "Aufgabe 3 · Charakterisierung schreiben",
    instruction:
      "Schreibe einen zusammenhängenden Text. Nutze eine Einleitung, ordne deine Aussagen sinnvoll und belege mindestens drei Merkmale mit Textstellen.",
    linesHeight: 110,
  },
];

// ── Hilfs-Komponenten ─────────────────────────────────────────────────────────

function TaskBlock({ title, instruction, linesHeight }: WorksheetTask) {
  return (
    <div className="border border-task-border bg-task-bg p-[15px_16px] rounded-[12px] my-3.5">
      <strong className="block text-xs mb-1.5">{title}</strong>
      <p className="text-[13px] leading-[1.7] m-0">{instruction}</p>
      <div
        className="mt-2.5"
        style={{ height: linesHeight ?? 76, background: "var(--gradient-lines-fill)" }}
      />
    </div>
  );
}

// ── Export-Button-Gruppe ──────────────────────────────────────────────────────

function ExportButtons({ worksheetId }: { worksheetId: string }) {
  const [exporting, setExporting] = React.useState<"docx" | "pdf" | null>(null);
  const [exportError, setExportError] = React.useState<string | null>(null);

  async function handleExport(format: "docx" | "pdf") {
    setExporting(format);
    setExportError(null);
    try {
      const result = await exportWorksheetAction(worksheetId, format);
      if (!result.ok || !result.base64 || !result.filename) {
        setExportError(result.error ?? "Export fehlgeschlagen");
        return;
      }
      const bytes = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0));
      const mimeType =
        format === "docx"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "application/pdf";
      const blob = new Blob([bytes], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {exportError && (
        <p className="text-[11px] text-danger">{exportError}</p>
      )}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="small"
          disabled={exporting !== null}
          onClick={() => handleExport("docx")}
        >
          <Icon name="download" width={14} height={14} />
          {exporting === "docx" ? "Erstelle…" : "DOCX"}
        </Button>
        <Button
          variant="secondary"
          size="small"
          disabled={exporting !== null}
          onClick={() => handleExport("pdf")}
        >
          <Icon name="download" width={14} height={14} />
          {exporting === "pdf" ? "Erstelle…" : "PDF"}
        </Button>
      </div>
    </div>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

interface WorksheetPreviewProps {
  state: WorksheetActionResult | null;
}

/** Arbeitsblatt-Vorschau — zeigt Platzhalter oder generiertes Ergebnis. */
export function WorksheetPreview({ state }: WorksheetPreviewProps) {
  const hasResult = state !== null && state.ok && !state.unavailable;
  const worksheetId = state?.worksheetId ?? "";

  return (
    <section
      aria-label="Arbeitsblatt-Vorschau"
      className="bg-surface border border-line rounded-[12px] shadow-[0_22px_42px_rgba(25,28,52,0.1)] max-w-[820px] mx-auto p-[46px_54px] min-h-[880px]"
    >
      {/* Fehler-Notice */}
      {state?.error && (
        <div className="mb-6">
          <Notice icon="shield" title="Generierung fehlgeschlagen" tone="warning">
            {state.error}
          </Notice>
        </div>
      )}

      {/* Nicht verfügbar (RAG offline) */}
      {state?.unavailable && (
        <div className="mb-6">
          <Notice icon="shield" title="Quellenbasierte Generierung nicht verfügbar" tone="warning">
            {state.message ?? "Der Retrieval-Dienst ist zurzeit nicht erreichbar. Bitte versuche es später."}
          </Notice>
        </div>
      )}

      {/* Konfessions-Warnung */}
      {state?.crossDenominationWarning && (
        <div className="mb-4">
          <Notice icon="shield" title="Konfessions-Hinweis" tone="warning">
            Die gefundenen Quellen umfassen unterschiedliche Konfessionskontexte. Prüfe die Zuordnung vor dem Einsatz.
          </Notice>
        </div>
      )}

      {/* Kopfzeile */}
      <div className="flex justify-between text-[10px] text-muted border-b-2 border-ink pb-3">
        <span>Deutsch · Klasse 8 · Gemeinschaftsschule</span>
        <span>Name: ______________________</span>
      </div>

      {hasResult ? (
        /* ── Generierter Inhalt ── */
        <>
          <h1 className="font-display text-[26px] tracking-[-0.04em] mt-8 mb-2 font-extrabold">
            Generiertes Arbeitsblatt
          </h1>

          <div className="flex gap-2 flex-wrap mb-4">
            <Badge tone="neutral">Entwurf</Badge>
            <StatusChip status="draft">Prüfen vor Einsatz</StatusChip>
          </div>

          {/* Statements */}
          <div className="grid gap-3 mt-4">
            {state.statements.map((s, i) => (
              <div
                key={i}
                className="border border-task-border bg-task-bg p-[15px_16px] rounded-[12px]"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <strong className="block text-xs">Aufgabe {i + 1}</strong>
                  <StatusChip
                    status={s.confidence === "GROUNDED" ? "ready" : "review"}
                  >
                    {s.confidence === "GROUNDED" ? "Belegt" : "Unbelegt – Entwurf"}
                  </StatusChip>
                </div>
                <p className="text-[13px] leading-[1.7] m-0">{s.text}</p>
                {s.citationRefs.length > 0 && (
                  <p className="text-[10px] text-muted mt-1.5 m-0">
                    Quellen: [{s.citationRefs.join(", ")}]
                  </p>
                )}
                <div
                  className="mt-2.5"
                  style={{ height: 76, background: "var(--gradient-lines-fill)" }}
                />
              </div>
            ))}
          </div>

          {/* Quellen-Footer */}
          {state.citations.length > 0 && (
            <div className="mt-8 pt-4 border-t border-line">
              <h2 className="text-[13px] font-bold mb-3">Quellen</h2>
              <ol className="grid gap-2 list-decimal list-inside">
                {state.citations.map((c) => (
                  <li key={c.index} className="text-[11px] text-muted">
                    <span className="font-bold text-ink">{c.title}</span>
                    {c.publisher ? ` · ${c.publisher}` : ""}
                    {c.locator ? `, ${c.locator}` : ""}
                    {c.license ? ` [${c.license}]` : ""}
                    {" · "}
                    <StatusChip trust={c.trustLevel as Parameters<typeof StatusChip>[0]["trust"]} />
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Export-Aktionen (Sekundär) */}
          {worksheetId && (
            <div className="mt-6 pt-4 border-t border-line">
              <p className="text-[11px] text-muted mb-2">
                Entwurf exportieren — vor Einsatz im Unterricht prüfen.
              </p>
              <ExportButtons worksheetId={worksheetId} />
            </div>
          )}
        </>
      ) : (
        /* ── Statischer Platzhalter ── */
        <>
          <h1 className="font-display text-[26px] tracking-[-0.04em] mt-8 mb-2 font-extrabold">
            Eine Charakterisierung schreiben
          </h1>

          <div className="flex gap-2 flex-wrap">
            <Badge subject="deutsch">Deutsch</Badge>
            <Badge tone="neutral">45 Minuten</Badge>
            <Badge tone="neutral">Basis + Erweiterung</Badge>
          </div>

          <p className="text-[13px] leading-[1.7] mt-4">
            Du untersuchst die Figur <strong>Jana</strong> aus dem Auszug. Beschreibe ihre
            Eigenschaften nicht nur mit Adjektiven, sondern belege sie mit passenden Stellen aus
            dem Text.
          </p>

          {PLACEHOLDER_TASKS.map((t, i) => (
            <TaskBlock key={i} {...t} />
          ))}

          <h2 className="text-[15px] mt-6 mb-2 font-bold">Hilfekarte</h2>
          <p className="text-[13px] leading-[1.7] m-0">
            <strong>Satzstarter:</strong>{" "}
            {"„Jana wirkt …, weil …“"} &middot;{" "}
            {"„Dies zeigt sich besonders, als …“"} &middot;{" "}
            {"„Dadurch wird deutlich, dass …“"}
          </p>

          <table className="w-full border-collapse mt-4 text-[11px]">
            <thead>
              <tr>
                <th className="bg-rubric-th-bg text-rubric-th-fg text-left text-[10px] border border-line p-2">
                  Kriterium
                </th>
                <th className="bg-rubric-th-bg text-rubric-th-fg text-left text-[10px] border border-line p-2">
                  Woran erkennst du es?
                </th>
                <th className="bg-rubric-th-bg text-rubric-th-fg text-left text-[10px] border border-line p-2">
                  Selbsteinschätzung
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-line p-2 align-top">Textbelege</td>
                <td className="border border-line p-2 align-top">
                  Du erklärst mindestens drei Textstellen.
                </td>
                <td className="border border-line p-2 align-top whitespace-nowrap">
                  □ sicher &nbsp; □ teilweise &nbsp; □ noch üben
                </td>
              </tr>
              <tr>
                <td className="border border-line p-2 align-top">Aufbau</td>
                <td className="border border-line p-2 align-top">
                  Dein Text hat Einleitung, Hauptteil und Schluss.
                </td>
                <td className="border border-line p-2 align-top whitespace-nowrap">
                  □ sicher &nbsp; □ teilweise &nbsp; □ noch üben
                </td>
              </tr>
              <tr>
                <td className="border border-line p-2 align-top">Sprache</td>
                <td className="border border-line p-2 align-top">
                  Du verwendest treffende Verben und Adjektive.
                </td>
                <td className="border border-line p-2 align-top whitespace-nowrap">
                  □ sicher &nbsp; □ teilweise &nbsp; □ noch üben
                </td>
              </tr>
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
