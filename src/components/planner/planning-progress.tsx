import { Card, CardHead, StatusChip, Notice } from "../ui";
import type { PlanningStep } from "@/lib/types";

/** Planungsfortschritt — Timeline, nachvollziehbar statt „KI sagt schon irgendwas”. */
export function PlanningProgress({ steps }: { steps: PlanningStep[] }) {
  const done = steps.filter((s) => s.done).length;
  return (
    <Card>
      <CardHead
        title="Planungsfortschritt"
        subtitle="Nachvollziehbar statt „KI sagt schon irgendwas”."
        action={<StatusChip status="progress">{`${done} / ${steps.length}`}</StatusChip>}
      />
      <div className="relative pl-[26px]">
        <span
          aria-hidden
          className="absolute left-2 top-2.5 bottom-2.5 w-px bg-[#E4E6EE]"
        />
        {steps.map((s) => (
          <div key={s.id} className="relative pb-[19px] last:pb-0">
            <span
              aria-hidden
              className={`absolute -left-[22px] top-1 h-[11px] w-[11px] rounded-full bg-surface border-[3px] ${
                s.done ? "border-religion bg-religion" : "border-primary"
              }`}
            />
            <h4 className="text-xs font-extrabold m-0">{s.title}</h4>
            <p className="text-[11px] text-muted mt-[3px] m-0">{s.detail}</p>
          </div>
        ))}
      </div>
      <div className="mt-3.5">
        <Notice icon="shield" title="Quellenmodus ist aktiv.">
          Lehrplanbehauptungen werden nur mit Quellenbeleg erzeugt.
        </Notice>
      </div>
    </Card>
  );
}