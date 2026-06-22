import { Card, CardHead, Button, FilterButton } from "../ui";
import { Icon } from "../ui/icon";
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
          const isLowConfidence = s.confidence?.level === "LOW";

          return (
            <div
              key={s.id}
              className={`border rounded-[12px] p-3 transition-colors ${
                isLowConfidence ? "border-warning-soft bg-warning-soft/10" : "border-line"
              }`}
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <strong className="text-[11px]">{s.criterion}</strong>
                    {isLowConfidence && (
                      <Icon name="alert" width={12} height={12} className="text-warning" />
                    )}
                  </div>
                </div>
                <span className="font-display text-[17px] font-extrabold text-primary">
                  {s.achieved} / {s.max}
                </span>
              </div>
              <div className="h-[7px] bg-line-row rounded-full overflow-hidden my-2">
                <div
                  className={`h-full block rounded-full ${isLowConfidence ? "bg-warning" : "bg-primary"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[10px] text-muted m-0">{s.note}</p>
              {s.confidence && (
                <p className="text-[9px] text-muted-dark italic mt-2 flex items-center gap-1 border-t border-line/50 pt-1.5">
                  <Icon name={isLowConfidence ? "alert" : "message"} width={10} height={10} />
                  {s.confidence.reasoning}
                </p>
              )}
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
