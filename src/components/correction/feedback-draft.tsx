import { Card, CardHead, Badge } from "../ui";
import { Icon } from "../ui/icon";
import type { FeedbackStatement, ConfidenceLevel } from "@/lib/types";

function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  if (level === "HIGH") return null;

  const colors = {
    MEDIUM: "bg-info-soft text-info",
    LOW: "bg-warning-soft text-warning",
  };

  return (
    <Badge className={colors[level]}>
      <Icon name={level === "LOW" ? "alert" : "message"} width={10} height={10} />
      {level}
    </Badge>
  );
}

/** Feedback-Entwurf — mit Belegen, Unsicherheit und Status. */
export function FeedbackDraft({ statements }: { statements: FeedbackStatement[] }) {
  return (
    <Card>
      <CardHead
        title="Feedback-Entwurf"
        subtitle="Strukturiert mit Belegen und KI-Konfidenz."
        action={<Icon name="sparkles" width={18} height={18} className="text-primary" />}
      />
      <div className="space-y-4 mt-2">
        {statements.map((stmt) => (
          <div key={stmt.id} className="border-b border-line pb-3 last:border-0 last:pb-0">
            <div className="flex justify-between items-start gap-2 mb-1">
              <p className="text-xs leading-[1.65] text-ink-body m-0 flex-1">{stmt.text}</p>
              <ConfidenceBadge level={stmt.confidence.level} />
            </div>

            {stmt.evidence.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {stmt.evidence.map((ev, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-surface-muted rounded text-[10px] text-muted">
                    <Icon name="file" width={10} height={10} />
                    <span>{ev.label || ev.reference}</span>
                  </div>
                ))}
              </div>
            )}

            {stmt.confidence.level !== "HIGH" && (stmt.confidence.reasoning) && (
              <p className="text-[10px] text-muted-dark italic mt-1.5 flex items-center gap-1">
                <Icon name="message" width={10} height={10} />
                {stmt.confidence.reasoning}
              </p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
