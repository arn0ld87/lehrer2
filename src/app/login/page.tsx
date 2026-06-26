"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Anmeldeseite — Email/Passwort-Formular für single-tenant LSA.
 * Kein Inline-Hex; ausschließlich Design-Tokens aus globals.css.
 *
 * useSearchParams() erzwingt eine Suspense-Boundary (Next.js Prerender) —
 * deshalb liegt die eigentliche Logik in LoginForm, der Default-Export umhüllt sie.
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const result = await authClient.signIn.email({ email, password });

    setPending(false);

    if (result.error) {
      // Keinen rohen Stacktrace anzeigen — verständliche Fehlermeldung
      const msg =
        result.error.status === 401
          ? "E-Mail-Adresse oder Passwort ist nicht korrekt."
          : result.error.message ?? "Anmeldung fehlgeschlagen. Bitte erneut versuchen.";
      setError(msg);
      return;
    }

    router.push(redirect);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-[380px]">
        {/* Wordmark */}
        <p className="text-center text-[13px] font-bold tracking-widest uppercase text-muted mb-8">
          Unterrichtsassistenz LSA
        </p>

        <Card>
          <h1 className="font-display text-xl font-extrabold tracking-[-0.03em] text-ink mb-6">
            Anmelden
          </h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="email"
                className="text-xs font-bold text-ink-secondary"
              >
                E-Mail-Adresse
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={[
                  "h-[42px] px-[13px] rounded-[11px] text-[13px]",
                  "bg-surface border text-ink outline-none",
                  "transition-[border-color,box-shadow] duration-150",
                  "focus:border-primary focus:shadow-[0_0_0_3px_rgba(93,61,245,0.15)]",
                  "placeholder:text-muted",
                  error ? "border-danger" : "border-line-strong",
                ].join(" ")}
                placeholder="jana@schule.de"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="password"
                className="text-xs font-bold text-ink-secondary"
              >
                Passwort
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={[
                  "h-[42px] px-[13px] rounded-[11px] text-[13px]",
                  "bg-surface border text-ink outline-none",
                  "transition-[border-color,box-shadow] duration-150",
                  "focus:border-primary focus:shadow-[0_0_0_3px_rgba(93,61,245,0.15)]",
                  "placeholder:text-muted",
                  error ? "border-danger" : "border-line-strong",
                ].join(" ")}
                placeholder="••••••••"
              />
            </div>

            {error ? (
              <p
                role="alert"
                className="text-[13px] text-danger bg-danger-bg rounded-[10px] px-[13px] py-[10px]"
              >
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              variant="primary"
              disabled={pending}
              className="mt-2 w-full"
            >
              {pending ? "Wird angemeldet …" : "Anmelden"}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-canvas px-4" />
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}
