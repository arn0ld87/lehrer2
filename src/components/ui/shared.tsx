import * as React from "react";
import { Icon, type IconName } from "./icon";

/** Inline-Link im Primär-Stil — für „alle anzeigen →” Art Verweise. */
export function InlineLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={[
        "inline-flex items-center gap-1.5 text-primary text-xs font-bold hover:underline",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </a>
  );
}

/** Hinweis-Box — für Unsicherheiten, Quellenmodus, Export-Warnungen. */
export function Notice({
  icon = "shield",
  title,
  children,
  tone = "warning",
}: {
  icon?: IconName;
  title: string;
  children: React.ReactNode;
  tone?: "warning" | "info";
}) {
  const toneClass =
    tone === "warning"
      ? "bg-warning-soft border-[#F5E3BA] text-[#7A4A00]"
      : "bg-info-soft border-info/20 text-info";
  return (
    <div
      className={[
        "flex gap-2.5 p-3 rounded-[12px] border text-[11px]",
        toneClass,
      ].join(" ")}
    >
      <Icon name={icon} width={18} height={18} className="shrink-0 mt-px" />
      <div className="min-w-0">
        <strong className="block text-[11px]">{title}</strong>
        <div className="block mt-[2px] leading-[1.35]">{children}</div>
      </div>
    </div>
  );
}

/** Abschnitts-Banner — dunkel, einleitend, mit sekundärer Aktion rechts. */
export function SectionBanner({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <section
      className="relative overflow-hidden rounded-[22px] text-white p-[26px] flex items-center justify-between gap-4 flex-wrap"
      style={{
        background:
          "radial-gradient(circle at 87% 30%, rgba(137,109,255,0.22), transparent 22%), linear-gradient(105deg, #171A37, #2A1B70)",
      }}
    >
      <div className="relative z-1 min-w-0">
        <h2 className="font-display text-[22px] tracking-[-0.04em] font-extrabold m-0">
          {title}
        </h2>
        <p className="text-xs text-[#D9D5FF] mt-[7px] max-w-[560px] m-0">{description}</p>
      </div>
      <div className="relative z-1">{action}</div>
    </section>
  );
}

/** Filter-Pille — aktiv/inaktiv, für Filterbars. */
export function FilterButton({
  active = false,
  icon,
  children,
  onClick,
}: {
  active?: boolean;
  icon?: IconName;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "h-[34px] px-[10px] rounded-[9px] border text-[11px] font-bold transition-colors",
        "flex items-center gap-1.5",
        active
          ? "bg-primary-soft border-[#C9BEFF] text-[#4D30CE]"
          : "bg-surface border-line-strong text-[#505873] hover:bg-[#FAFAFD]",
      ].join(" ")}
    >
      {icon ? <Icon name={icon} width={14} height={14} /> : null}
      {children}
    </button>
  );
}

/** Quadratischer Icon-Button (z.B. Benachrichtigungen, Menü). */
export function IconButton({
  icon,
  label,
  onClick,
  badge = false,
  className,
}: {
  icon: IconName;
  label: string;
  onClick?: () => void;
  badge?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={[
        "relative h-[42px] w-[42px] rounded-[11px] border border-line bg-surface text-ink",
        "grid place-items-center hover:border-[#CFC8F7] hover:bg-[#FAF9FF]",
        "transition-colors",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Icon name={icon} width={18} height={18} />
      {badge ? (
        <span
          aria-hidden
          className="h-[7px] w-[7px] rounded-full bg-correction border-2 border-surface absolute right-[10px] top-[9px]"
        />
      ) : null}
    </button>
  );
}