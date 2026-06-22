import * as React from "react";
import type { DraftStatus, SourceStatus, SourceTrust } from "@/lib/types";

type StatusKind = DraftStatus | "active" | "waiting" | "rejected";

interface StatusChipProps {
  /** Entwurfs-/Freigabestatus. */
  status?: StatusKind;
  /** Vertrauensstufe einer Quelle (ADR 0003). */
  trust?: SourceTrust;
  className?: string;
  children?: React.ReactNode;
}

const STATUS_CLASSES: Record<StatusKind, string> = {
  draft: "bg-[#F0F2F7] text-[#66708A]",
  progress: "bg-[#FFF5DF] text-[#A66100]",
  ready: "bg-success-soft text-[#0C7D61]",
  review: "bg-danger-soft text-[#B54425]",
  active: "bg-success-soft text-[#0C7D61]",
  waiting: "bg-[#FFF5DF] text-[#A66100]",
  rejected: "bg-danger-soft text-[#B54425]",
};

const TRUST_LABEL: Record<SourceTrust, string> = {
  OFFICIAL_BINDING: "OFFICIAL_BINDING",
  OFFICIAL_GUIDANCE: "OFFICIAL_GUIDANCE",
  USER_APPROVED: "USER_APPROVED",
  UNVERIFIED: "UNVERIFIED",
};

const TRUST_CLASS: Record<SourceTrust, string> = {
  OFFICIAL_BINDING: "bg-success-soft text-[#0C7D61]",
  OFFICIAL_GUIDANCE: "bg-[#FFF5DF] text-[#A66100]",
  USER_APPROVED: "bg-[#F0F2F7] text-[#66708A]",
  // UNVERIFIED darf produktiv nie im RAG stehen — Status deutlich markieren.
  UNVERIFIED: "bg-danger-soft text-[#B54425]",
};

const STATUS_LABEL: Record<StatusKind, string> = {
  draft: "Entwurf",
  progress: "Prüfung",
  ready: "Freigegeben",
  review: "Unsicherheit",
  active: "aktiv",
  waiting: "Wartet",
  rejected: "Abgelehnt",
};

/**
 * Status-Chip — stellt Quellen- und Unsicherheitszustände dar,
 * ohne sie zu verdecken. UNVERIFIED bekommt eine Warn-Farbe.
 */
export function StatusChip({ status, trust, className, children }: StatusChipProps) {
  if (trust) {
    return (
      <span
        className={[
          "inline-flex items-center gap-1.5 rounded-full text-[10px] font-bold px-2 py-[5px] whitespace-nowrap",
          TRUST_CLASS[trust],
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children ?? TRUST_LABEL[trust]}
      </span>
    );
  }
  if (status) {
    return (
      <span
        className={[
          "inline-flex items-center gap-1.5 rounded-full text-[10px] font-bold px-2 py-[5px] whitespace-nowrap",
          STATUS_CLASSES[status],
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children ?? STATUS_LABEL[status]}
      </span>
    );
  }
  return null;
}