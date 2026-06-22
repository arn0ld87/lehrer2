import * as React from "react";
import type { Subject } from "@/lib/types";

type SubjectStyle = "deutsch" | "religion" | "evangelische-religion" | "katholische-religion" | "ethik";

const SUBJECT_CLASSES: Record<SubjectStyle, string> = {
  deutsch: "bg-deutsch-soft text-deutsch-fg",
  religion: "bg-success-soft text-religion-fg",
  "evangelische-religion": "bg-success-soft text-religion-fg",
  "katholische-religion": "bg-success-soft text-religion-fg",
  ethik: "bg-info-soft text-info",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  subject?: Subject;
  /** Freier Text-Badge ohne Fach-Semantik. */
  tone?: "neutral";
}

/**
 * Fach-Badge — semantisch, nicht dekorativ.
 * Religion wird konfessionssensibel behandelt; Ethik ist eigenes Fach.
 */
export function Badge({ subject, tone, className, children, ...rest }: BadgeProps) {
  const subjectClass = subject ? SUBJECT_CLASSES[subject] : "";
  const toneClass = tone === "neutral" ? "bg-chip-bg text-muted border border-line" : "";
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full text-[10px] font-bold px-2 py-[5px] whitespace-nowrap",
        subjectClass,
        toneClass,
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </span>
  );
}