import { Button } from "../ui/button";
import type { SourceQuickAccess } from "@/lib/types";
import { Icon } from "../ui/icon";

/**
 * Aktionskarte — Einstieg in Planung / Arbeitsblatt / Korrektur.
 * Keine Marketing-Illustration im produktiven Verwaltungsflow; stattdessen
 * eine nüchterne Farbfläche als Akzent.
 */
export function ActionCard({
  accent,
  title,
  description,
  actionLabel,
  onAction,
}: {
  accent: "purple" | "green" | "orange";
  title: string;
  description: string;
  actionLabel: string;
  onAction?: () => void;
}) {
  const surfaceStyle =
    accent === "purple"
      ? { background: "var(--gradient-feature-purple)" }
      : accent === "green"
        ? { background: "var(--gradient-feature-green)" }
        : { background: "var(--gradient-feature-orange)" };
  const btnStyle =
    accent === "green"
      ? { background: "var(--color-religion)", color: "var(--color-surface)" }
      : accent === "orange"
        ? { background: "var(--color-correction)", color: "var(--color-surface)" }
        : undefined;
  return (
    <article
      className="relative overflow-hidden p-[19px] border border-line rounded-[22px] min-h-[220px] flex flex-col"
      style={surfaceStyle}
    >
      <h3 className="font-display text-[17px] leading-[1.2] tracking-[-0.03em] font-extrabold m-0 mb-[7px]">
        {title}
      </h3>
      <p className="text-xs text-ink-feature max-w-[250px] leading-[1.55] m-0">
        {description}
      </p>
      <div className="mt-auto pt-3">
        <Button
          variant={accent === "purple" ? "primary" : "secondary"}
          size="small"
          style={btnStyle}
          onClick={onAction}
        >
          {actionLabel} <span aria-hidden>→</span>
        </Button>
      </div>
    </article>
  );
}

/** Schnellzugriff auf Lehrpläne / Quellen. */
export function QuickSourcesCard({ sources }: { sources: SourceQuickAccess[] }) {
  return (
    <article className="relative p-[19px] border border-line rounded-[22px] bg-surface min-h-[220px] flex flex-col">
      <h3 className="font-display text-[17px] tracking-[-0.03em] font-extrabold m-0">
        Lehrplan &amp; Quellen
      </h3>
      <p className="text-xs text-ink-feature mt-0 mb-2">Schnellzugriff auf geprüfte Grundlagen.</p>
      <div className="flex flex-col">
        {sources.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-2 py-2 border-b border-line-row last:border-b-0"
          >
            <span
              className={`h-[27px] w-[27px] rounded-lg grid place-items-center shrink-0 ${
                s.accent === "green"
                  ? "bg-success-soft text-religion"
                  : "bg-source-quick-bg text-primary"
              }`}
            >
              <Icon name="file" width={15} height={15} />
            </span>
            <span className="flex-1 min-w-0">
              <strong className="block text-[10px] truncate">{s.title}</strong>
              <span className="block text-[9px] text-muted mt-px">{s.subtitle}</span>
            </span>
            <Icon name="external" width={15} height={15} className="text-muted shrink-0" />
          </div>
        ))}
      </div>
    </article>
  );
}