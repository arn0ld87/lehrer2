import * as React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "default" | "small";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white shadow-[0_8px_18px_rgba(93,61,245,0.22)] hover:bg-primary-strong active:translate-y-px",
  secondary:
    "bg-surface text-ink border border-line-strong hover:bg-[#FAFAFD]",
  ghost: "bg-transparent text-primary hover:text-primary-strong",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  default: "h-[42px] px-[15px] rounded-[11px] text-[13px]",
  small: "h-[34px] px-[11px] rounded-[9px] text-xs",
};

/**
 * Schaltfläche — stark für die primäre Handlung, leise für Alternativen.
 * Pro Seitenkopf maximal EINE primäre Aktion (Handoff-Vorgabe).
 */
export function Button({
  variant = "secondary",
  size = "default",
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={rest.type ?? "button"}
      className={[
        "inline-flex items-center justify-center gap-2 font-bold",
        "transition-[background,transform,border] duration-150 ease-out",
        "disabled:cursor-not-allowed disabled:opacity-60",
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}