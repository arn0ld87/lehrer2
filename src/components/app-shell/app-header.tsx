"use client";

import * as React from "react";
import { Button } from "../ui/button";
import { Icon } from "../ui/icon";
import { IconButton } from "../ui/shared";
import { useMobileNav } from "./app-shell";

export interface AppHeaderProps {
  title: string;
  subtitle?: string;
  /** Primäre Aktion pro Seitenkopf — maximal EINE (Handoff-Vorgabe). */
  primaryAction?: {
    icon?: "plus" | "download";
    label: string;
    onClick?: () => void;
  };
}

/**
 * Topbar — Seitentitel links, Suche + Benachrichtigung + primäre Aktion rechts.
 * Die Suche ist rein visuell (UI-Shell, keine Suchfunktion).
 */
export function AppHeader({ title, subtitle, primaryAction }: AppHeaderProps) {
  const { openNav } = useMobileNav();
  return (
    <header className="flex items-center justify-between gap-[18px] mb-[26px] flex-wrap">
      <div className="flex items-start gap-2.5 min-w-0">
        <button
          type="button"
          aria-label="Menü öffnen"
          onClick={openNav}
          className="lg:hidden h-[42px] w-[42px] rounded-[11px] border border-line bg-surface grid place-items-center text-ink shrink-0"
        >
          <Icon name="menu" width={18} height={18} />
        </button>
        <div className="min-w-0">
          <h1 className="font-display text-[28px] leading-[1.15] tracking-[-0.045em] font-extrabold m-0">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-[13px] text-muted mt-1.5 m-0">{subtitle}</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <SearchField />
        <IconButton icon="bell" label="Benachrichtigungen" badge />
        {primaryAction ? (
          <Button variant="primary" onClick={primaryAction.onClick}>
            {primaryAction.icon ? (
              <Icon name={primaryAction.icon} width={16} height={16} />
            ) : null}
            {primaryAction.label}
          </Button>
        ) : null}
      </div>
    </header>
  );
}

function SearchField() {
  return (
    <label
      aria-label="Suche"
      className="hidden md:flex w-[clamp(240px,31vw,360px)] h-[42px] border border-line-strong rounded-[11px] bg-surface items-center gap-2 px-[11px] text-muted"
    >
      <Icon name="search" width={18} height={18} />
      <input
        type="search"
        placeholder="Materialien, Themen, Quellen suchen"
        className="border-0 outline-none min-w-0 w-full text-ink bg-transparent text-[13px] placeholder:text-[#9BA1B1]"
      />
      <span className="text-[10px] bg-[#F5F6FA] border border-[#E9EBF1] rounded px-1.5 py-[3px] text-[#7C8296] whitespace-nowrap">
        ⌘ K
      </span>
    </label>
  );
}