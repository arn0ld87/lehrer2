import { Card, CardHead, StatusChip } from "../ui";
import { Icon, type IconName } from "../ui/icon";
import type { RagQuality } from "@/lib/types";

/** RAG-Qualität — die Datenbasis wird gemessen, nicht beschworen. */
export function RagQualityCard({ quality }: { quality: RagQuality }) {
  return (
    <Card>
      <CardHead
        title="RAG-Qualität"
        subtitle="Die Datenbasis wird gemessen, nicht beschworen."
        action={<StatusChip status="ready">stabil</StatusChip>}
      />
      <QualityRow
        icon="check"
        accent="ok"
        title="Metadatenabdeckung"
        detail="Quelle, Version, Fach und Gültigkeit für indexierte Chunks."
        value={`${quality.metadataCoverage.toLocaleString("de-DE")} %`}
      />
      <QualityRow
        icon="search"
        accent="info"
        title="Golden-Question-Recall"
        detail="Testfragen zu Deutsch und Religion mit belegtem Treffer."
        value={`${quality.goldenQuestionRecall.toLocaleString("de-DE")} %`}
      />
      <QualityRow
        icon="alert"
        accent="warn"
        title="Quellen mit Prüfbedarf"
        detail="Dokumente ohne geklärte Lizenz oder aktuelle Version."
        value={String(quality.sourcesNeedingReview)}
        valueClass="text-correction"
      />
    </Card>
  );
}

const ACCENT: Record<"ok" | "info" | "warn", string> = {
  ok: "bg-success-soft text-success",
  info: "bg-info-soft text-sources",
  warn: "bg-danger-soft text-correction",
};

function QualityRow({
  icon,
  accent,
  title,
  detail,
  value,
  valueClass,
}: {
  icon: IconName;
  accent: "ok" | "info" | "warn";
  title: string;
  detail: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 py-2.5 border-b border-[#EEF0F5] last:border-b-0">
      <span className={`h-8 w-8 rounded-[10px] grid place-items-center shrink-0 ${ACCENT[accent]}`}>
        <Icon name={icon} width={17} height={17} />
      </span>
      <div className="min-w-0 flex-1">
        <strong className="block text-xs font-bold">{title}</strong>
        <span className="block text-[10px] text-muted mt-px">{detail}</span>
      </div>
      <strong className={`text-[13px] ${valueClass ?? ""}`}>{value}</strong>
    </div>
  );
}