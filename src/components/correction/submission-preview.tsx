import { Badge, StatusChip, Notice } from "../ui";

/** Einreichungs-Vorschau — pseudonymisiert, mit Unsicherheits-Hinweis. */
export function SubmissionPreview({
  title,
  subjectLabel,
  submittedAt,
  pseudonym,
}: {
  title: string;
  subjectLabel: string;
  submittedAt: string;
  pseudonym: string;
}) {
  return (
    <article className="bg-surface border border-line rounded-[22px] p-6">
      <div className="flex items-center justify-between pb-[17px] border-b border-line gap-3 flex-wrap">
        <div className="min-w-0">
          <strong className="font-display text-base font-extrabold">{title}</strong>
          <p className="text-[11px] text-muted mt-1 m-0">
            {subjectLabel} · eingereicht am {submittedAt}
          </p>
        </div>
        <span className="font-mono bg-anon-bg rounded-[7px] px-1.5 py-1 text-[10px] text-text-anon">
          {pseudonym}
        </span>
      </div>

      <div className="flex justify-between items-center my-[22px_0_12px] flex-wrap gap-2">
        <Badge subject="deutsch">Pseudonymisiert</Badge>
        <StatusChip status="review">Vorschlag prüfen</StatusChip>
      </div>

      {/* Platzhalter-Zeilen (kein echter Schülertext). */}
      <div className="space-y-2.5">
        <TextLine width="87%" />
        <TextLine width="100%" />
        <TextLine width="71%" />
        <TextLine width="100%" highlight label="Kriterium: Argumentation" />
        <TextLine width="100%" />
        <TextLine width="87%" />
        <TextLine width="100%" />
        <TextLine width="71%" />
        <TextLine width="100%" highlight label="Kriterium: Belege" />
        <TextLine width="87%" />
        <TextLine width="100%" />
        <TextLine width="71%" />
      </div>

      <div className="mt-5">
        <Notice icon="alert" title="Unklare Zuordnung erkannt.">
          Die Passage ab Absatz 3 kann als Inhaltsangabe oder als Deutung gelesen werden.
          Kein Punktvorschlag ohne Sichtprüfung.
        </Notice>
      </div>
    </article>
  );
}

function TextLine({
  width,
  highlight = false,
  label,
}: {
  width: string;
  highlight?: boolean;
  label?: string;
}) {
  if (highlight) {
    return (
      <div
        className="h-2.5 rounded-[3px] my-2.5 relative"
        style={{
          background: "var(--gradient-text-line-highlight)",
          width,
        }}
      >
        {label ? (
          <span className="absolute right-0 -top-1 text-[9px] text-highlight-label-fg bg-danger-soft rounded px-1.5 py-0.5">
            {label}
          </span>
        ) : null}
      </div>
    );
  }
  return (
    <div
      className="h-2.5 rounded-[3px] my-2.5"
      style={{ background: "var(--gradient-text-line)", width }}
    />
  );
}