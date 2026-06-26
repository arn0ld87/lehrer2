import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Geschützte Pfad-Präfixe (inkl. Unterpfade).
 * Erweiterbar: weitere Routen eintragen, die Auth verlangen.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/planung",
  "/arbeitsblaetter",
  "/quelle",
];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );
}

/**
 * Edge-Middleware — prüft Session-Cookie ohne DB-Zugriff (fail-closed).
 *
 * Kein Session-Cookie vorhanden → Redirect auf /login?redirect=<pfad>.
 * Bei unklarem Ergebnis (z. B. Cookie-Parsing-Fehler) wird geschützt, nicht durchgelassen.
 *
 * Entscheidung: getSessionCookie() aus better-auth/cookies liest nur den Cookie-Header,
 * kein DB/Edge-Runtime-incompatible Code. signOut bleibt client-seitig (authClient.signOut).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtected(pathname)) {
    return NextResponse.next();
  }

  let sessionCookie: string | null = null;

  try {
    sessionCookie = getSessionCookie(request);
  } catch {
    // Cookie-Parsing-Fehler → fail-closed, weiterleiten
    sessionCookie = null;
  }

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  /*
   * Matcher schließt aus: /login, /api/auth (better-auth-Handler), _next
   * (statische Ressourcen, Chunks) sowie öffentliche statische Dateien.
   * Alle anderen Pfade laufen durch — isProtected() entscheidet dann.
   */
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|ico|webp|jpg|jpeg|js|css|woff2?|map)).*)",
  ],
};
