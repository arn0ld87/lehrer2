# 0007: Authentifizierung und Autorisierung

## Status

**Vorgeschlagen (Proposed), 2026-06-22** — finale Annahme durch Maintainer im PR-Review ausstehend.

> CLAUDE.md/AGENTS.md schreiben vor, dass die Auth-Lösung nicht ad hoc, sondern per ADR entschieden wird. Dieses ADR legt eine begründete Empfehlung vor; der Status wechselt mit der Maintainer-Zustimmung auf „Akzeptiert".

## Kontext

Anforderungen aus dem Projektrahmen:

- **Stack**: Next.js App Router, TypeScript strict, modularer Monolith, self-hosted in deutschen Schulnetzwerken; PostgreSQL + Drizzle ORM (ADR 0005), Redis vorhanden.
- **Datenschutz**: DSGVO, Datenresidenz DE/EU, local-first (keine Cloud-Abhängigkeit als Default, vgl. ADR 0004).
- **Rollen**: MVP `Lehrkraft` + `Admin`; später `Fachkonferenz-Vorsitz`, `Schuladmin`; Mandantentrennung (mehrere Schulen) als spätere Ausbaustufe.
- **Budget**: Schulträger budgetlimitiert → zusätzlicher Infrastruktur-Footprint (separate Container, JVM) ist teuer.

## Optionen (Recherchestand 2026-06)

| Lösung           | Typ              | Drizzle-nativ | RBAC/Mandanten        | Extra-Footprint   | Betrieb   | Reife/Risiko               |
| ---------------- | ---------------- | ------------- | --------------------- | ----------------- | --------- | -------------------------- |
| **Better Auth**  | In-App-Lib       | ja            | Plugins (RBAC, Orgs)  | 0 Container       | niedrig   | jung (v1.x), sehr aktiv    |
| Auth.js v5       | In-App-Lib       | nein (Custom) | Eigenimplementierung  | 0 Container       | niedrig   | reif, aber deprioritisiert |
| Lucia            | In-App-Lib       | —             | —                     | —                 | —         | **deprecated — raus**      |
| Zitadel          | Separater IdP    | n/a (OIDC)    | Org-Hierarchie nativ  | ~400–600 MB (Go)  | mittel    | aktiv, EU/Privacy-First    |
| Keycloak         | Separater IdP    | n/a (OIDC)    | sehr mächtig (Realms) | ~600–800 MB (JVM) | hoch      | sehr reif (CNCF)           |
| Ory Kratos/Hydra | Separate Dienste | n/a (OIDC)    | teils, viel Custom    | ~500 MB+, 2+ Svc  | sehr hoch | aktiv, ops-intensiv        |

## Entscheidung (vorgeschlagen)

**Better Auth als MVP-Lösung, hinter einer projekteigenen Auth-/Session-Abstraktion (analog zur Provider-Abstraktion in ADR 0002), mit Zitadel als dokumentiertem Migrationspfad.**

Begründung:

1. **Local-first & Footprint**: Better Auth läuft in-app gegen das vorhandene Postgres + Redis — kein zusätzlicher Container, keine JVM. Das passt zum budgetlimitierten Schul-Self-Hosting (ADR 0004) besser als jeder separate IdP.
2. **Drizzle-nativ**: direkte Integration ohne Custom-Adapter (Auth.js v5 bräuchte einen eigenen Drizzle-Adapter; zudem empfiehlt Auth.js selbst neue Projekte zu Better Auth).
3. **RBAC + Organizations als Plugins**: deckt den Rollenpfad (Lehrkraft/Admin → Fachkonferenz/Schuladmin) und spätere Mandantentrennung ab, ohne sie im MVP schon zu erzwingen.
4. **Skalierungspfad**: Wird zentrales Multi-Schul-SSO oder AD/LDAP-Föderation nötig, wird auf **Zitadel** (schlanker als Keycloak, Go statt JVM, native Org-Hierarchie Schulträger→Schule, Privacy-by-Design) als separaten OIDC-IdP migriert. Die Auth-Abstraktion hält diesen Wechsel lokal.

**Ausgeschlossen:** Lucia (deprecated, keine Sicherheitspatches). **Vorerst nicht:** Keycloak/Ory — Footprint und Betriebsaufwand für MVP-Schulnetze unverhältnismäßig.

## Wichtigste Gegenstimmen (dokumentiert)

- **Better Auth ist v1.x (jung)**: Risiko von Breaking Changes auf dem Weg zu v2. Mitigation: Auth-Zugriffe hinter einer Repository-/Service-Abstraktion kapseln; Better-Auth-API nicht breit durch die Codebasis streuen.
- **Sofort zentralen IdP (Zitadel) nehmen**: spart späteren Migrationsschritt, falls Multi-Mandant früh kommt. Entgegnung: erhöht MVP-Footprint und Betrieb ohne belegten Bedarf; Entscheidung bewusst aufschiebbar dank Abstraktion.

## Offene Fragen (vom Maintainer vor Annahme zu klären)

1. **Mandantentrennung**: erst später (→ Better Auth) oder bereits im MVP nötig (→ ggf. direkt Zitadel)?
2. **Föderation**: Anbindung an bestehende Schulverbund-AD/LDAP gefordert? (spräche für IdP mit OIDC-Federation.)
3. **Beta-Bereitschaft**: ist eine v1.x-Bibliothek für die Pilotphase akzeptabel?

## Konsequenzen

- M0/M1: Auth-Service-Abstraktion definieren; Better Auth dahinter implementieren; Sessions via Redis.
- Rollenmodell (`docs/.../Rollen`, Issue #25) baut auf den Better-Auth-RBAC-/Org-Plugins auf.
- Keine zusätzliche Betriebskomponente im MVP; Cloud-IdP bleibt optionaler Ausbaupfad.

## Verweise

- [0002-provider-agnostic-llm-layer.md](./0002-provider-agnostic-llm-layer.md) — Abstraktionsmuster gegen Anbieter-Lock-in.
- [0004-local-first-student-data.md](./0004-local-first-student-data.md) — Local-first, Self-Hosting.
- [0005-orm-drizzle.md](./0005-orm-drizzle.md) — Drizzle/Postgres.
- [../decisions/OPEN_QUESTIONS.md](../decisions/OPEN_QUESTIONS.md) — Rollen-/Freigabe-Übergang (Frage 5).
- Better Auth: <https://better-auth.com/docs> · Auth.js: <https://authjs.dev> · Zitadel: <https://zitadel.com/docs> · Keycloak: <https://www.keycloak.org>
