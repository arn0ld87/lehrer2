# Unterrichtsassistenz LSA – UI Design Kit

Ein vollständiger, statischer UI-Prototyp für das Lehrkräfte-Produkt **Unterrichtsassistenz LSA**.

Dieses Paket ist kein Bild-Mockup und keine Pseudo-Figma-Datei. Es enthält echte, direkt im Browser lauffähige HTML-, CSS- und JavaScript-Dateien. Claude Code kann es als visuelle und technische Referenz in ein Next.js-/Tailwind-Projekt überführen.

## Enthaltene Screens

| Datei | Zweck |
|---|---|
| `dashboard.html` | Überblick mit Aktivitäten, Schnellzugriffen und Vertrauensprinzipien |
| `planner.html` | Unterrichtsplanung mit Curriculum-Fit, Kontext und Strukturentwurf |
| `worksheet-builder.html` | Arbeitsblatt-Builder mit realistisch gestalteter Druckvorschau |
| `correction.html` | Korrekturassistenz mit Kriterien, Unsicherheiten und Feedback |
| `sources.html` | Quellenregistry inklusive Vertrauen, Lizenzstatus und RAG-Qualität |
| `ui-kit.html` | Design-Tokens, Farbpalette, Typografie, Komponentenregeln |

## Schnellstart

```bash
cd unterrichtsassistenz-lsa-design-kit
python3 -m http.server 8080
```

Danach im Browser öffnen:

```text
http://localhost:8080/dashboard.html
```

Alternativ kannst du jede HTML-Datei direkt mit dem Browser öffnen.

## Projektstruktur

```text
unterrichtsassistenz-lsa-design-kit/
├── assets/
│   ├── app.css                  # Vollständiges, responsives Styling
│   ├── app.js                   # Icons, Tabs, Sidebar, Beispiel-Interaktionen
│   ├── logo.svg
│   └── empty-state.svg
├── handoff/
│   └── CLAUDE_CODE_HANDOFF.md   # Konkreter Implementierungsauftrag für Claude Code
├── reference/
│   └── dashboard-reference.png  # Visuelle Referenz, falls verfügbar
├── design-tokens.json           # Maschinenlesbare Farb-/Typografie-/Radius-Tokens
├── dashboard.html
├── planner.html
├── worksheet-builder.html
├── correction.html
├── sources.html
├── ui-kit.html
├── DESIGN_SYSTEM.md
└── README.md
```

## Designrichtung

- **Ausdruck:** professionell, ruhig, vertrauenswürdig, pädagogisch erwachsen
- **Kein EdTech-Kitsch:** keine Cartoonfiguren, keine Regenbogenverläufe, keine Belohnungsmechanik
- **Informationsdichte:** für Lehrkräfte optimiert, nicht für Marketing-Screens
- **Farben:** tiefes Indigo als Marke, Türkis für Religion/positive Prüfung, Orange für Korrektur- bzw. Warnkontext, Violett für Deutsch
- **Kernprinzip:** Quellen, Unsicherheiten, Status und menschliche Kontrolle sind sichtbar

## Integration in den echten Stack

Das Design ist absichtlich Framework-frei gehalten, damit du es in Next.js, Astro oder eine andere React-Struktur übertragen kannst.

Die gewünschte Zielstruktur:

```text
app/
├── (app)/
│   ├── dashboard/page.tsx
│   ├── planung/page.tsx
│   ├── arbeitsblaetter/page.tsx
│   ├── korrektur/page.tsx
│   └── quellen/page.tsx
├── components/
│   ├── app-shell/
│   ├── dashboard/
│   ├── planner/
│   ├── worksheet/
│   ├── correction/
│   ├── sources/
│   └── ui/
└── styles/
    └── tokens.css
```

Die genauen Anforderungen stehen in `handoff/CLAUDE_CODE_HANDOFF.md`.

## Hinweis zur fachlichen Umsetzung

Die dargestellten Quellen, Kennzahlen, Namen und Schülerarbeiten sind reine UI-Demodaten. Sie begründen keine Lehrplan-, Datenschutz- oder Produktkonformität.
