import { Icon, type IconName } from "../ui/icon";
import type { TrustPrinciple } from "@/lib/types";

/** Vertrauensgrundsätze — Local-first, Quellen, menschliche Entscheidung. */
export function TrustPrinciples({ items }: { items: TrustPrinciple[] }) {
  return (
    <section className="grid sm:grid-cols-3 gap-0 p-[15px_20px] bg-surface border border-line rounded-[16px]">
      {items.map((t, i) => (
        <div
          key={t.id}
          className={`flex items-center gap-2 px-3.5 ${
            i < items.length - 1 ? "sm:border-r border-line" : ""
          } ${i > 0 ? "border-t sm:border-t-0 border-line pt-3 sm:pt-0" : ""} ${
            i < items.length - 1 ? "sm:pr-3.5" : ""
          }`}
        >
          <span className="h-[30px] w-[30px] rounded-[10px] bg-primary-soft text-primary grid place-items-center shrink-0">
            <Icon name={t.icon as IconName} width={16} height={16} />
          </span>
          <div className="min-w-0">
            <strong className="block text-[10px]">{t.title}</strong>
            <span className="block text-[9px] text-muted mt-px">{t.detail}</span>
          </div>
        </div>
      ))}
    </section>
  );
}