"use client";

import * as React from "react";
import { AppSidebar } from "./app-sidebar";

interface NavContextValue {
  open: boolean;
  openNav: () => void;
  closeNav: () => void;
}

const NavContext = React.createContext<NavContextValue | null>(null);

/** Hook für Header/Seiten, um den Mobile-Drawer zu steuern. */
export function useMobileNav(): NavContextValue {
  const ctx = React.useContext(NavContext);
  if (!ctx) {
    throw new Error("useMobileNav muss innerhalb von <AppShell> verwendet werden.");
  }
  return ctx;
}

/**
 * App-Shell — hält den Mobile-Drawer-Status und legt Sidebar + Inhaltsfläche
 * nebeneinander. Sidebar ist auf Desktop sticky (260px), auf Mobil ein Drawer
 * mit Backdrop.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = React.useState(false);

  const value = React.useMemo<NavContextValue>(
    () => ({
      open: navOpen,
      openNav: () => setNavOpen(true),
      closeNav: () => setNavOpen(false),
    }),
    [navOpen],
  );

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setNavOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <NavContext.Provider value={value}>
      <div className="grid lg:grid-cols-[260px_minmax(0,1fr)] min-h-screen">
        <AppSidebar open={navOpen} onNavigate={() => setNavOpen(false)} />
        {navOpen ? (
          <button
            type="button"
            aria-label="Menü schließen"
            onClick={() => setNavOpen(false)}
            className="fixed inset-0 z-30 bg-ink/40 lg:hidden"
          />
        ) : null}
        <main className="min-w-0 w-full max-w-[1680px] mx-auto p-7 lg:p-[28px_30px_42px]">
            {children}
        </main>
      </div>
    </NavContext.Provider>
  );
}