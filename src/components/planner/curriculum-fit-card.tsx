import { Card, CardHead, Badge, StatusChip, InlineLink } from "../ui";
import { Icon } from "../ui/icon";
import type { CurriculumFit } from "@/lib/types";

/** Curriculum-Fit — Entwurfsbezug, noch keine rechtliche Zusicherung. */
export function CurriculumFitCard({ items }: { items: CurriculumFit[] }) {
  return (
    <Card>
      <CardHead
        title="Curriculum-Fit"
        subtitle="Entwurfsbezug, noch keine rechtliche Zusicherung."
        action={<Badge subject="deutsch">Deutsch</Badge>}
      />
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-2.5 py-2.5 border-b border-line-row last:border-b-0"
        >
          <span
            className={`h-8 w-8 rounded-[10px] grid place-items-center shrink-0 ${
              item.status === "pruefen"
                ? "bg-danger-soft text-correction"
                : "bg-info-soft text-sources"
            }`}
          >
            <Icon name={item.status === "pruefen" ? "alert" : "book"} width={17} height={17} />
          </span>
          <div className="min-w-0 flex-1">
            <strong className="block text-xs font-bold truncate">{item.label}</strong>
            <span className="block text-[10px] text-muted mt-px truncate">{item.detail}</span>
            <span className="block text-[9px] text-muted-2 mt-0.5">
              Quelle: {item.sourceHint}
            </span>
          </div>
          <StatusChip status={item.status === "belegt" ? "ready" : "review"}>
            {item.status === "belegt" ? "belegt" : "prüfen"}
          </StatusChip>
        </div>
      ))}
      <InlineLink href="/quelle" className="mt-3.5">
        Quellen und Fundstellen prüfen →
      </InlineLink>
    </Card>
  );
}