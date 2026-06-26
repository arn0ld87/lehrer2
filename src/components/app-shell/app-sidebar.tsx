"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "../ui/icon";
import { authClient } from "@/lib/auth/client";
import type { NavRoute } from "@/lib/types";
import { ContextSwitcher } from "./context-switcher";

export const NAV_ROUTES: NavRoute[] = [
  { href: "/dashboard", label: "Übersicht", icon: "home" },
  { href: "/planung", label: "Unterrichtsplanung", icon: "calendar" },
  { href: "/arbeitsblaetter", label: "Arbeitsblätter", icon: "file" },
  { href: "/korrektur", label: "Korrekturassistenz", icon: "wand" },
  { href: "/quelle", label: "Quellen & Lehrpläne", icon: "layers" },
  { href: "/design-system", label: "Design-System", icon: "sparkles" },
];

export interface AppSidebarProps {
  open: boolean;
  onNavigate: () => void;
}

/**
 * Desktop-Sidebar 260px — sticky, mit Hauptnavigation, Kontext-Panel und
 * Nutzerkarte. Auf Mobil ein Drawer (translateX).
 */
export function AppSidebar({ open, onNavigate }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Hauptnavigation"
      className={[
        "fixed inset-y-0 left-0 z-40 w-[278px] max-w-[88vw]",
        "bg-surface border-r border-line flex flex-col gap-5",
        "p-5 pb-4 transition-transform duration-200 ease-out",
        "lg:sticky lg:top-0 lg:h-screen lg:w-[260px] lg:max-w-none lg:translate-x-0",
        open ? "translate-x-0 shadow-soft" : "-translate-x-[102%]",
      ].join(" ")}
    >
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="flex items-center gap-[11px] px-2.5 py-1.5"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- eigenes statisches Asset */}
        <img src="/logo.svg" alt="" className="h-[35px] w-[35px] shrink-0" />
        <span className="font-display text-sm font-extrabold tracking-[-0.03em] leading-[1.1]">
          Unterrichtsassistenz
          <span className="block text-muted font-semibold text-[11px] mt-[3px] tracking-normal">
            LSA
          </span>
        </span>
      </Link>

      <nav className="grid gap-1">
        {NAV_ROUTES.map((route) => {
          const active = isActive(pathname, route.href);
          return (
            <Link
              key={route.href}
              href={route.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={[
                "flex items-center gap-2.5 px-3 py-2.5 rounded-[11px] font-semibold transition-colors",
                active
                  ? "text-white bg-primary shadow-[0_7px_18px_rgba(93,61,245,0.22)]"
                  : "text-ink-nav hover:bg-primary-soft hover:text-primary",
              ].join(" ")}
            >
              <Icon name={route.icon as IconName} width={18} height={18} />
              {route.label}
            </Link>
          );
        })}
      </nav>

      <ContextSwitcher />

      <SidebarUser />
    </aside>
  );
}

/** Nutzerkarte — liest echte better-auth-Session, zeigt Name/E-Mail + Logout. */
function SidebarUser() {
  const { data: session, isPending } = authClient.useSession();

  const displayName = session?.user?.name ?? session?.user?.email ?? "—";
  const initials = deriveInitials(displayName);

  async function handleLogout() {
    await authClient.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="mt-auto border border-line p-2.5 rounded-[14px] flex items-center gap-2.5">
      <span
        aria-hidden
        className="h-[33px] w-[33px] rounded-full grid place-items-center text-white font-extrabold text-[11px] shrink-0"
        style={{ background: "var(--gradient-avatar)" }}
      >
        {isPending ? "…" : initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold truncate">
          {isPending ? "Wird geladen …" : displayName}
        </span>
        {!isPending && session?.user?.name && session.user.email && (
          <span className="block text-[10px] text-muted truncate">
            {session.user.email}
          </span>
        )}
      </span>
      <button
        onClick={handleLogout}
        aria-label="Abmelden"
        title="Abmelden"
        className="text-muted hover:text-danger transition-colors p-1 rounded-[6px] hover:bg-danger-bg"
      >
        <Icon name="logout" width={15} height={15} />
      </button>
    </div>
  );
}

/** Zwei Großbuchstaben aus Namen oder E-Mail-Präfix ableiten. */
function deriveInitials(name: string): string {
  if (name === "—") return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  // E-Mail oder Einwortname: erste zwei Zeichen des lokalen Teils
  const local = name.split("@")[0];
  return local.slice(0, 2).toUpperCase();
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}
