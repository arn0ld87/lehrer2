import { Card, CardHead } from "../ui";
import { Icon } from "../ui/icon";
import type { FeedbackHistoryEntry } from "@/lib/types";

/**
 * Korrekturverlauf — macht die Entstehung nachvollziehbar.
 * Zeigt den Weg vom KI-Vorschlag bis zur menschlichen Entscheidung.
 */
export function CorrectionHistory({ entries }: { entries: FeedbackHistoryEntry[] }) {
  return (
    <Card>
      <CardHead
        title="Korrekturverlauf"
        subtitle="Nachvollziehbarer Weg der Entscheidung."
        action={<Icon name="layers" width={18} height={18} className="text-muted" />}
      />
      <div className="relative mt-2 pl-4 border-l border-line space-y-5">
        {entries.map((entry, i) => (
          <div key={i} className="relative">
            {/* Timeline Dot */}
            <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 border-surface-muted bg-primary" />

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-ink-body">
                  {entry.action === "CREATE_DRAFT" ? "KI-Entwurf erstellt" : entry.changeSummary}
                </span>
                <span className="text-[10px] text-muted whitespace-nowrap">{entry.timestamp}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-dark font-medium">
                  {entry.actor}
                </span>
              </div>

              {entry.newText && (
                <p className="text-[10px] text-muted-dark mt-1 line-clamp-2 italic">
                  "{entry.newText}"
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
