# CI/CD-Pipeline

Dieses Dokument beschreibt die GitHub Actions-Pipeline und ihre aktuellen sowie geplanten Gates.

## Überblick

Die CI/CD-Pipeline definiert automatisierte Checks, die bei jedem Push und Pull Request ausgeführt werden. Sie stellt sicher, dass Code und Dokumentation den Projektstandards entsprechen, bevor sie in den Hauptzweig integriert werden.

**Aktueller Status**: Dokumentation und Formatierung werden geprüft. App-Tests und Builds folgen in späteren Phasen.

## Aktive Jobs

### 1. docs

**Zweck**: Verifiziert die Integrität und Vollständigkeit aller Dokumentationsdateien.

**Ausführung**:

```bash
npm run verify:docs
```

Intern nutzt dieser Job das Skript [../../scripts/verify-docs.sh](../../scripts/verify-docs.sh), das prüft:

- Markdown-Syntaxkorrektheit
- Fehlende oder verwaiste Links (relative Pfade zu ../../, ../security/, etc.)
- Konsistenz von Cross-Links

**Bedingung**: Dieser Job ist erforderlich vor dem Merge in `main`.

### 2. format

**Zweck**: Prüft, dass alle Dateien Prettier-Formatierungsvorgaben einhalten.

**Ausführung**:

```bash
npm run format:check
```

Dies prüft TypeScript, JavaScript, Markdown, JSON, YAML und andere konfigurierte Dateitypen.

**Bedingung**: Dieser Job ist erforderlich vor dem Merge in `main`.

## Konfiguration

Die Pipeline-Definition befindet sich in [../../.github/workflows/ci.yml](../../.github/workflows/ci.yml).

Beispiel-Struktur:

```yaml
name: CI
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version-file: .nvmrc
      - run: npm install
      - run: npm run verify:docs

  format:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version-file: .nvmrc
      - run: npm install
      - run: npm run format:check
```

## Geplante zukünftige Gates

Folgende Jobs sind geplant, aber noch nicht implementiert:

### 3. lint

Nutzt ESLint zur Überprüfung von Code-Stil und Best-Practices in TypeScript/JavaScript.

**Geplante Ausführung**: `npm run lint`

### 4. typecheck

Führt den TypeScript-Compiler im strikten Modus aus, um Typ-Sicherheit zu erzwingen.

**Geplante Ausführung**: `npm run typecheck`

### 5. test

Unit- und Integrationstests (Jest, Vitest o. ä.) für App-Logik, Services und APIs.

**Geplante Ausführung**: `npm run test`

**Hinweis**: Startet erst, wenn App-Code existiert.

### 6. e2e

Playwright-E2E-Tests zur Überprüfung von Frontend- und User-Workflows.

**Geplante Ausführung**: `npm run test:e2e`

**Hinweis**: Startet erst, wenn UI vorhanden ist.

### 7. pii-leak-detection

Überprüft, dass PII-Daten (Namen, E-Mails, IDs) korrekt anonymisiert werden und nicht in Logs oder Outputs sichtbar sind. Prüft gegen den Redaction-Guard im Code.

**Geplante Ausführung**: Custom Script gegen identifizierte PII-Muster

**Abhängigkeiten**: Redaction-Guard-Implementierung in der App

## Branch- und PR-Strategie

### Branch-Struktur

- **main**: Produktionsbereit. Erfordert grüne CI und Code-Review.
- **develop**: Integrationszweig. Für Feature-Branches.
- **feature/\***: Kurzlebige Feature-Branches von `develop`.

### PR-Anforderungen

1. Alle CI-Jobs müssen erfolgreich sein (docs, format, später: lint, typecheck, test).
2. Mindestens ein Code-Review-Genehmigung.
3. Branches müssen mit `develop` oder `main` aktuell sein (kein Merge-Konflikt).

### Merge-Strategie

- **Squash Merge** für Feature-Branches (ein Commit pro Feature).
- **Rebase Merge** für `develop` → `main` (erhält History).

## Fehlerbehandlung

Wenn ein CI-Job fehlschlägt:

1. Lese die Job-Logs in GitHub Actions.
2. Führe den Job lokal aus (z. B. `npm run verify:docs`).
3. Behebe die Fehler in deinem Branch.
4. Pushe die Korrektur; CI restartet automatisch.

## Weitere Ressourcen

- [Entwicklungsumgebung](./DEVELOPMENT.md) – Lokale Einrichtung
- [Projektplan](../../PLAN.md) – Architektur und Roadmap
- [GitHub Actions Workflow](../../.github/workflows/ci.yml) – Vollständige Pipeline-Definition
- [Dokumentations-Verifizierungsskript](../../scripts/verify-docs.sh) – Technische Details
