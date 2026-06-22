import * as React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Karteninnenabstand (default: card-pad). */
  padded?: boolean;
}

/**
 * Karte — weiß, 1px Border, subtiler Schatten, Radius 22px.
 * Token-basiert, keine verstreuten Hex-Werte.
 */
export function Card({ padded = true, className, children, ...rest }: CardProps) {
  return (
    <div
      className={[
        "bg-surface border border-line rounded-[22px] shadow-subtle",
        padded ? "p-[19px]" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface CardHeadProps {
  title: string;
  subtitle?: string;
  /** Rechtsbündiger Slot (Filter, Status, Aktion). */
  action?: React.ReactNode;
  className?: string;
}

/** Kartenkopf — Titel, Untertitel und optionaler rechter Slot. */
export function CardHead({ title, subtitle, action, className }: CardHeadProps) {
  return (
    <div
      className={[
        "flex items-center justify-between gap-[10px] mb-[15px]",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="min-w-0">
        <h2 className="font-display text-base font-extrabold tracking-[-0.025em] text-ink m-0">
          {title}
        </h2>
        {subtitle ? (
          <p className="text-xs text-muted mt-[3px] m-0">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}