import { Card, CardHead, Button, FilterButton } from "../ui";
import type { RubricScore } from "@/lib/types";

/**
 * Rasterbasierter Vorschlag — Kriterien vor Textgefühl.
 * WICHTIG: Vorschlag, kein finales Ergebnis. Bewertung bleibt bei der Lehrkraft.
 */
export function RubricScoreCard({ scores }: { scores: RubricScore[] }) {
  return (
    <Card>
      <CardHead
        title="Rasterbasierter Vorschlag"
        subtitle="Kriterien vor Textgefühl."
        action={<FilterButton>Raster v2 ⌄</FilterButton>}
      />
      <div className="grid gap-3">
        {scores.map((s) => {
          const pct = Math.round((s.achieved / s.max) * 100);
          return (
            <div key={s.id} className="border border-line rounded-[12px] p-3">
              <div className="flex items-start justify-between gap-2.5">
                <strong className="text-[11px]">{s.criterion}</strong>
                <span className="font-display text-[17px] font-extrabold text-primary">
                  {s.achieved} / {s.max}
                </span>
              </div>
              <div className="h-[7px] bg-[#EEF0F5] rounded-full overflow-hidden my-2">
                <div
                  className="h-full block rounded-full bg-primary"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[10px] text-muted m-0">{s.note}</p>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2.5 mt-3.5">
        <Button variant="secondary" size="small" className="flex-1">
          Begründungen
        </Button>
        {/* „Prüfen” statt „Übernehmen” — menschliche Finalentscheidung. */}
        <Button variant="primary" size="small" className="flex-1">
          Prüfen
        </Button>
      </div>
    </Card>
  );
}