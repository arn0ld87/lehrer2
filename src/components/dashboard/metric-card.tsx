import { Icon, type IconName } from "../ui/icon";
import { InlineLink } from "../ui/shared";
import type { DashboardMetric } from "@/lib/types";

const ACCENT_CLASS: Record<DashboardMetric["accent"], { icon: string; wrap: string }> = {
  purple: { icon: "bg-primary-soft text-primary", wrap: "bg-primary-soft" },
  green: { icon: "bg-success-soft text-religion", wrap: "bg-success-soft" },
  orange: { icon: "bg-danger-soft text-correction", wrap: "bg-danger-soft" },
  blue: { icon: "bg-info-soft text-sources", wrap: "bg-info-soft" },
};

/** KPI-Karte — Zahl mit Kicker, Fuß und Verweis. */
export function MetricCard({ metric }: { metric: DashboardMetric }) {
  const accent = ACCENT_CLASS[metric.accent];
  return (
    <article className="bg-surface border border-line rounded-[22px] shadow-subtle p-[19px] flex gap-3 items-start min-h-[123px]">
      <span
        className={`h-11 w-11 rounded-[14px] grid place-items-center shrink-0 ${accent.icon}`}
      >
        <Icon name={metric.icon as IconName} width={21} height={21} />
      </span>
      <div className="flex flex-col self-stretch min-w-0">
        <div className="text-[11px] font-bold text-[#5F6681]">{metric.kicker}</div>
        <div className="font-display text-[25px] font-extrabold tracking-[-0.05em] leading-[1.2] mt-0.5">
          {metric.value}
        </div>
        <div className="text-[11px] text-muted mt-0.5">{metric.foot}</div>
        <InlineLink href={metric.href} className="mt-auto pt-2">
          {metric.href === "/planung"
            ? "Plan ansehen →"
            : metric.href === "/arbeitsblaetter"
              ? "Arbeitsblätter →"
              : metric.href === "/korrektur"
                ? "Korrekturen →"
                : "Quellen durchsuchen →"}
        </InlineLink>
      </div>
    </article>
  );
}