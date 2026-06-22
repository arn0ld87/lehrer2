import { Icon, type IconName } from "../ui/icon";
import type { RecentWork, Subject } from "@/lib/types";

const SUBJECT_ICON_CLASS: Record<Subject, string> = {
  deutsch: "bg-[#F0EAFE] text-deutsch",
  "evangelische-religion": "bg-success-soft text-religion",
  "katholische-religion": "bg-success-soft text-religion",
  ethik: "bg-info-soft text-info",
};

/** Liste „Weiterarbeiten” — kontextbezogene Entwürfe. */
export function RecentWorkList({ items }: { items: RecentWork[] }) {
  return (
    <div>
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-[11px] py-2.5 border-b border-[#EEF0F5] last:border-b-0"
        >
          <span
            className={`h-8 w-8 rounded-[10px] grid place-items-center shrink-0 ${SUBJECT_ICON_CLASS[item.subject]}`}
          >
            <Icon name={item.icon as IconName} width={17} height={17} />
          </span>
          <div className="min-w-0 flex-1">
            <strong className="block text-xs font-bold truncate">{item.title}</strong>
            <span className="block text-[10px] text-muted mt-px truncate">
              {item.subtitle}
            </span>
          </div>
          <span className="text-[10px] text-muted-2 whitespace-nowrap hidden sm:block">
            {item.modifiedAt}
          </span>
          <button
            type="button"
            aria-label="Weitere Aktionen"
            className="border-0 bg-transparent text-muted text-lg leading-none px-1.5"
          >
            ⋮
          </button>
        </div>
      ))}
    </div>
  );
}