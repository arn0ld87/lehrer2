import { Icon, type IconName } from "../ui/icon";
import type { Activity } from "@/lib/types";

const ICON_CLASS: Record<Activity["icon"], string> = {
  ok: "bg-success-soft text-success",
  warn: "bg-danger-soft text-correction",
  info: "bg-info-soft text-sources",
};

const ACTIVITY_ICON: Record<Activity["icon"], IconName> = {
  ok: "check",
  warn: "wand",
  info: "calendar",
};

/** Aktivitäten-Feed — nachvollziehbar, nicht mystisch. */
export function ActivityFeed({ items }: { items: Activity[] }) {
  return (
    <div>
      {items.map((a, i) => (
        <div
          key={a.id}
          className="flex gap-2.5 relative pb-3.5 last:pb-0"
          style={i < items.length - 1 ? undefined : undefined}
        >
          {i < items.length - 1 ? (
            <span
              aria-hidden
              className="absolute w-px bg-[#E8EBF1] left-[15px] top-9 bottom-0"
            />
          ) : null}
          <span
            className={`h-[31px] w-[31px] rounded-full grid place-items-center shrink-0 z-[1] ${ICON_CLASS[a.icon]}`}
          >
            <Icon name={ACTIVITY_ICON[a.icon]} width={15} height={15} />
          </span>
          <div className="flex-1 min-w-0">
            <strong className="block text-[11px]">{a.title}</strong>
            <span className="block text-[10px] text-muted leading-[1.35] mt-0.5">
              {a.detail}
            </span>
          </div>
          <time className="text-[10px] text-muted-2 whitespace-nowrap">
            {a.timestamp}
          </time>
        </div>
      ))}
    </div>
  );
}