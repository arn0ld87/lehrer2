import { Card, CardHead, Button } from "../ui";
import type { StructurePhase } from "@/lib/types";

/** Vorgeschlagene Struktur — Entwurf, also prüfbar, anpassbar und nicht magisch. */
export function StructureProposal({ phases }: { phases: StructurePhase[] }) {
  return (
    <Card>
      <CardHead
        title="Vorgeschlagene Struktur"
        subtitle="Noch ein Entwurf. Also prüfbar, anpassbar und nicht magisch."
        action={
          <Button variant="secondary" size="small">
            Bearbeiten
          </Button>
        }
      />
      <div className="grid gap-2">
        {phases.map((p, i) => (
          <div
            key={p.id}
            className="flex items-start gap-2.5 p-3 border border-line rounded-[12px]"
          >
            <span
              aria-hidden
              className="grid place-items-center w-[21px] h-[21px] rounded-[7px] bg-primary-soft text-primary text-[11px] font-extrabold shrink-0"
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <strong className="block text-[11px]">{p.title}</strong>
              <span className="block text-[10px] text-muted mt-0.5">{p.detail}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}