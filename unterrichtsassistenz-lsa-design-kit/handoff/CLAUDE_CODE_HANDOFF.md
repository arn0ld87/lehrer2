# Claude Code Handoff – UI-Implementierung

## Ziel

Überführe dieses statische Design-Kit in die bestehende Next.js-App der Unterrichtsassistenz LSA.

## Harte Anforderungen

- Nutze Next.js App Router, TypeScript strict und Tailwind CSS.
- Halte die Screens semantisch, zugänglich und responsive.
- Ersetze alle Demodaten durch klar getrennte Mock-Factories bzw. Repository-Interfaces.
- Baue keine echten RAG-/Korrektur-/Lehrplanfunktionen in diesem Schritt.
- Implementiere nur die UI-Struktur und navigierbare Screens.
- Keine echten Schülerdaten, Tokens oder Lehrplandokumente verwenden.
- Verwende für Icons `lucide-react`; keine Inline-SVG-Duplikate im Produktcode.
- Nutze eine zentrale Token-Datei und keine verstreuten Hex-Werte.
- Verwende keine externen Bild- oder Font-CDNs ohne explizite Entscheidung.

## Screens

Implementiere diese Routes:

```text
/dashboard
/planung
/arbeitsblaetter
/korrektur
/quellen
/design-system
```

## Komponentenstruktur

```text
components/
├── app-shell/
│   ├── app-sidebar.tsx
│   ├── app-header.tsx
│   └── context-switcher.tsx
├── dashboard/
│   ├── metric-card.tsx
│   ├── recent-work-list.tsx
│   ├── activity-feed.tsx
│   ├── action-card.tsx
│   └── trust-principles.tsx
├── planner/
│   ├── planning-form.tsx
│   ├── planning-progress.tsx
│   ├── structure-proposal.tsx
│   └── curriculum-fit-card.tsx
├── worksheet/
│   ├── builder-panel.tsx
│   └── worksheet-preview.tsx
├── correction/
│   ├── submission-preview.tsx
│   ├── rubric-score-card.tsx
│   └── feedback-draft.tsx
├── sources/
│   ├── source-table.tsx
│   ├── source-filter-bar.tsx
│   └── rag-quality-card.tsx
└── ui/
    ├── badge.tsx
    ├── card.tsx
    ├── button.tsx
    ├── empty-state.tsx
    └── status-chip.tsx
```

## Visuelle Anforderungen

- Verwende die Werte aus `design-tokens.json`.
- Desktop-Sidebar: 260px.
- Seitenfläche: `#F7F7FB`.
- Karten: weiß, 1px Border, subtiler Schatten, Radius 22px.
- Primärfarbe: `#5D3DF5`.
- Maximal eine primäre Aktion pro Seitenkopf.
- Quellen- und Unsicherheitszustände dürfen nicht verdeckt werden.
- UI-Texte bleiben auf Deutsch.
- Keine Marketing-Illustrationen in produktiven Verwaltungsflows.

## Akzeptanzkriterien

- [ ] Alle sechs Routen sind erreichbar.
- [ ] Navigation markiert die aktive Route.
- [ ] Alle Screens funktionieren ohne externe API.
- [ ] Mobile Navigation ist nutzbar.
- [ ] Buttons, Eingaben und Filter zeigen sichtbare Fokuszustände.
- [ ] Keine kritischen ESLint- oder TypeScript-Fehler.
- [ ] Keine Inline-Hex-Farben außerhalb der zentralen Token-/Theme-Definition.
- [ ] Datums-, Nutzer- und Schülerdaten sind klar als Mock-Daten gekennzeichnet.
- [ ] UI kopiert keine Bewertung automatisch in ein finales Ergebnis.

## Nicht-Ziele

- Keine Authentifizierung
- Kein Datenbankmodell
- Keine Dokument-Uploads
- Keine OCR
- Kein echter PDF-Export
- Kein LLM-Aufruf
- Kein Qdrant oder RAG
