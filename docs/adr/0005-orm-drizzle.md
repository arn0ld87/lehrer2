# 0005: ORM-Wahl — Drizzle statt Prisma

## Status

Akzeptiert, 2026-06-22

## Kontext

Das Projekt nutzt PostgreSQL als Primär-Datenbank und benötigt einen TypeScript-ORM für folgende Anforderungen:

- **TypeScript-First**: Strikte Typsicherheit ist Projektstandard (tsconfig: strict: true).
- **Self-Hosting**: Anwendung wird in schulischen Netzwerken auf eigenen Servern betrieben; Gewicht und Abhängigkeiten sind relevant.
- **Auditierbare Löschkonzepte**: DSGVO Art. 17 (Recht auf Vergessenwerden) verlangt dokumentierte, testbare Löschvorgänge; der ORM sollte diese transparent machen.
- **Kostenempfindlichkeit**: Schulträger sind Budget-limitiert; Infrastruktur-Footprint (RAM, CPU, Startup-Zeit) zählt.
- **DX vs. Migrationen**: Gute Developer Experience ist wichtig, darf aber Sicherheit und Auditierbarkeit nicht untergraben.

Die beiden Hauptkandidaten sind **Prisma** und **Drizzle**:

## Optionen

### (a) Prisma

**Merkmale:**

- Sehr reife Migrations-Infrastruktur (`prisma migrate`).
- Exzellente DX: Prisma Studio (GUI-Datenbank-Browser), Code-Generation, intuitive Schema-Syntax.
- Breite Verbreitung, große Community, reichlich Tutorials/StackOverflow-Antworten.
- SQL wird abstrahiert; Queries sind häufig lesbar, aber nicht direkt einsehbar.
- TypeScript-Client auto-generiert.
- Live-Query-Validierung in VSCode via Extension.

**Nachteile:**

- Schwergewichtiger: `@prisma/client` + `@prisma/internals` sind umfangreich; Startup-Zeit länger.
- SQL-Abstraktion erschwert das Nachprüfen, ob eine Löschoperation wirklich vollständig ist.
- Migrationen sind Prisma-eigenes Format (.prisma); direkter SQL-Review nötig für Audit.
- Vendor-Lock-in: Prisma-eigenes Konzept (z. B. Prisma Relations) schwer auf andere ORMs übertragbar.

**Bewertung:**

- ✅ Branchenerfahrung, Onboarding für große Teams.
- ❌ SQL-Transparenz schwächer; Löschkonzepte weniger auditierbar.
- ⚠️ Für Self-Hosting: annehmbar, aber nicht optimal.

### (b) Drizzle ORM (GEWÄHLT)

**Merkmale:**

- SQL-transparent: Queries sind reales SQL; `SELECT`, `DELETE`, `UPDATE` sind sichtbar und auditierbar.
- TypeScript-nativ: Schema als TS-Objekte; Generator erzeugt Types aus Schema.
- Schlank: `drizzle-orm` ist minimal; Startup schnell.
- Migrationen: SQL-Dateien (`.sql`), nicht proprietär.
- Flexible Query-API: Can mix Drizzle Query Builder mit Raw SQL.
- Hervorragend für Compliance-Anforderungen: SQL-Logik ist transparent.

**Nachteile:**

- Migrations-Tooling jünger als Prisma; weniger Best-Practices in der Wildnis.
- Geringere Community-Größe; weniger Tutorials, kleinerer Pool an erfahrenen Entwickler:innen.
- Keine GUI-Tools wie Prisma Studio (Workaround: psql direkt oder pgAdmin).
- Type-Inferenz kann in komplexen Queries knifflig sein; oft manuelle Type-Assertions nötig.
- Dokumentation teilweise terse (verbessert sich aktiv).

**Bewertung:**

- ✅ SQL-Transparenz; schlanke Infrastruktur; auditierbare Löschkonzepte.
- ✅ Self-Hosting-freundlich.
- ❌ Geringere Reife bei Migrationen; kleinere Community.
- ⚠️ Lernkurve für Team, falls Prisma-Erfahrung vorhanden.

### Vergleichstabelle

| Kriterium               | Prisma      | Drizzle      |
| ----------------------- | ----------- | ------------ |
| SQL-Transparenz         | Mittel      | Hoch         |
| Migrations-Reife        | Hoch        | Mittel       |
| Community-Größe         | Groß        | Klein-Mittel |
| Startup-Zeit            | ~1s         | ~100ms       |
| Self-Hosting-freundlich | Ja          | Ja (besser)  |
| Type Safety             | Hoch        | Hoch         |
| DX: Onboarding          | Hoch        | Mittel       |
| Audit-Compliance        | Mittel      | Hoch         |
| Kostenmodell            | Open Source | Open Source  |

## Entscheidung

**Drizzle ORM wird als Standard-ORM gewählt.**

### Begründung

1. **SQL-Transparenz für Compliance**: Löschoperationen (DSGVO Art. 17) müssen auditierbar sein. Mit Drizzle sind SQL-Statements direkt lesbar; Code-Review + Regression-Tests können die Vollständigkeit von Deletes nachweisen. Prisma erfordert zusätzliche Übersetzungsschritte.

2. **Self-Hosting-Effizienz**: Schulische Netzwerke können ressourcen-begrenzt sein. Drizzle ist schlanker; Startup-Zeit und RAM-Footprint sind geringer.

3. **Klarheit bei Migrationen**: SQL-basierte Migrationen (Drizzle) vs. proprietäre `.prisma`-Migrationen (Prisma). SQL ist Industrie-Standard und lässt sich mit Standard-Tools (psql, Flyway, Liquibase) kombinieren, falls später nötig.

4. **Zukunftssicherheit**: Sollte das Projekt später zu anderem Stack migrieren, sind SQL-Migrationen portierbar; Prisma-Migrationen sind nicht.

### Wichtigste Gegenstimme (Dokumentiert)

**Prisma hätte Vorteil bei:**

- **Migrations-Reife**: Prisma `migrate` ist battle-tested; Drizzle-Migrationen sind noch aktiv in Entwicklung.
- **Onboarding**: Neue Entwickler:innen haben eher Prisma-Erfahrung; Einarbeitung ist schneller.
- **Ökosystem**: Mehr Third-Party-Tools, Middleware, Community-Patterns.

**Entgegnung**: Für ein greenfield-Projekt mit kleinerem Team und hohen Compliance-Anforderungen überwiegen die SQL-Vorteile von Drizzle. Das jüngere Migrations-Tooling ist kein Blocker mit strukturiertem Testing.

## Konsequenzen

### Positiv

- **Auditierbare Löschkonzepte**: Jede DELETE-Operation ist als SQL sichtbar; Testabdeckung ist einfach (SQL-Snapshot-Tests).
- **Schlanke Infrastruktur**: Weniger RAM, schnellere Startups, besser für Schulumgebungen.
- **Langfristige Wartbarkeit**: SQL-Migrations sind nicht an Prisma-Ecosystem gebunden.
- **DSGVO-ready**: Datenschutz-Audits können SQL-Statements direkt validieren.

### Mitigationen für Nachteile

#### Migrations-Reife: Strukturierte Prozesse

- **Benannte SQL-Repository-Methoden**: Anstelle von Ad-hoc-Deletes in Code, alle Löschvorgänge in dedizierte Repository-Funktionen (`deleteStudentByIdWithAuditLog`, `purgeClassroomData`).
- **Migrations-Reviewpflicht**: Alle `.sql`-Migrationen müssen in PR reviewed werden; automatisches Flag für `DELETE/UPDATE` statements.
- **Schema-Drift-Check in CI**: GitHub Action, die Schema gegen Typ-Definitionen validiert.
- **Regression-Testing**: Jest-Tests gegen Test-DB; jede Migration wird getestet.

#### Onboarding

- **Drizzle-Dokumentation in CONTRIBUTING.md**: Query-Patterns, Best Practices, häufige Fehler.
- **Pair-Programming für erste Feature**: Erfahrene Dev + Neuzugang für Schema-Änderungen.
- **Query-Sniffs**: Linter-Regel (ESLint) gegen N+1-Queries, Raw-SQL ohne guten Grund.

#### Community-Lücken

- **Fallback auf Raw SQL**: Drizzle erlaubt `db.execute(sql\`...\`)`; bei kniffligen Queries ist expliziter SQL akzeptabel (mit Code-Review).
- **Interne Patterns dokumentieren**: Wiki mit Rezepten (Pagination, Soft Deletes, Audit Trails).

### Restrisiken

- **Migrations-Tooling-Fehler**: Drizzle-CLI könnte Bugs enthalten, die Migrationen beschädigen.
  - **Kontrolle**: Staging-Environment vor Production; Backup vor Migration; Rollback-Strategie klar dokumentiert.
- **Type-Inferenz-Probleme**: Komplexe JOINs können Type-Checker überfordern.
  - **Kontrolle**: Defensive Type-Assertions mit `as` (dokumentiert); Tests stärken Vertrauen.
- **Langfristige Wartbarkeit**: Sollte Drizzle-Projekt stagnieren, ist Umstieg teuer.
  - **Kontrolle**: Drizzle ist aktiv entwickelt (GitHub-Activity, Release-Zyklus prüfen); SQL-Layer ist robust auch bei Unmaintainability.

## Verweise

- [../architecture/DATA_MODEL.md](../architecture/DATA_MODEL.md) — Schema-Definition, Relationen, Indizes.
- [../architecture/ARCHITECTURE.md](../architecture/ARCHITECTURE.md) — Persistence-Layer, Abstraktionen über ORM.
- [../security/DATA_PROTECTION.md](../security/DATA_PROTECTION.md) — Löschkonzepte, Audit Trails, DSGVO Art. 17.
- DSGVO Art. 17 (Recht auf Vergessenwerden).
- [Drizzle ORM — Dokumentation](https://orm.drizzle.team/).
- [Prisma — Dokumentation](https://www.prisma.io/docs/).
