import * as React from "react";
import { Icon, type IconName } from "./icon";

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/**
 * Leerzustand — ruhig, sachlich, ohne Marketing-Illustration.
 */
export function EmptyState({ icon = "file", title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6 gap-3">
      <span className="h-11 w-11 rounded-[14px] bg-primary-soft text-primary grid place-items-center">
        <Icon name={icon} width={22} height={22} />
      </span>
      <h3 className="font-display text-base font-extrabold text-ink m-0">{title}</h3>
      {description ? (
        <p className="text-xs text-muted max-w-[320px] m-0">{description}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}