# Design System — Unterrichtsassistenz LSA

## Übersicht

Das Design-Kit `unterrichtsassistenz-lsa-design-kit` ist ein vollständiges Figma-Export-Artefakt (oder ähnliches Design-Tool-Handoff) für die Lehrkraft-Unterrichtsassistenz-Anwendung. Es enthält:

- Design Tokens (Farben, Typografie, Spacing)
- CSS-Assets und JavaScript-Utilities
- HTML-Prototypen für alle Hauptscreens
- Manifest mit Metadaten
- Handoff-Dokumentation für Entwickler

**Absoluter Pfad des Kits:** `/Volumes/T7/Projekte/jana_lehrerin/unterrichtsassistenz-lsa-design-kit`

**Liegt das Kit im Repo?** Ja, innerhalb von `jana_lehrerin/`.

---

## Design Tokens

### Farben

Die `design-tokens.json` definiert ein umfassendes Farbsystem. Zu ermitteln durch direktes Lesen der Datei — die Struktur folgt einem standardisierten Token-Format (wahrscheinlich Figma Design Tokens oder ähnlich).

Erwartete Kategorien (typisch):
- **Neutral-Palette:** Grau-Abstufungen für Hintergründe, Borders, Text
- **Semantische Farben:** Success (Grün), Warning (Orange), Danger (Rot), Info (Blau)
- **Brand-Farben:** Primär und Sekundär (abhängig von Schullayout)
- **Kontrast-Verhältnisse:** WCAG AA/AAA für Barrierefreiheit

### Typografie

CSS und Tokens definieren vermutlich:
- **Schriftfamilien:** Sans-Serif für UI (z.B. Inter, -apple-system), Serif optional für Hervorhebungen
- **Schriftgrößen:** Skalierte Größen (z.B. xs, sm, base, lg, xl, 2xl)
- **Zeilenhöhen:** Gut lesbar für Schüler-/Lehrkraft-Texte
- **Font-Weight:** Regular, Semibold, Bold für Hierarchie

### Spacing

Wahrscheinlich 4er- oder 8er-Skala:
- `xs, sm, md, lg, xl, 2xl` für Padding/Margin/Gap

### Weitere Token

- **Border Radius:** Für Buttons, Cards (wahrscheinlich `sm, md, lg`)
- **Shadows:** Für Tiefenwirkung bei Card-Layouts
- **Opacity:** Für Hover-States, Disabled-Zustände

---

## Komponenten- und Screen-Inventar

### Komponenten (erwartet)

- **Button** (Primary, Secondary, Danger, Disabled States)
- **Input** (Text, TextArea, Select, Checkbox, Radio)
- **Card** (mit Header, Body, Footer)
- **Modal** / **Dialog**
- **Tabs**
- **Alert / Banner**
- **Dropdown / Menu**
- **Badge / Label**
- **Progress Bar** (für Bewertungs-/Korrektur-Status)
- **Table** (für Schülerlisten, Aufgabenüberblick)
- **Avatar** (optional, für Lehrkraft/Schüler-Identifikation)

### Screens (aus HTML-Prototypen)

Basierend auf den HTML-Dateien im Kit:

- `dashboard.html` — Haupt-Dashboard der Lehrkraft (Übersicht, Quick-Actions)
- `worksheet-builder.html` — Arbeitsblatt-Editor/Builder
- `planner.html` — Schulplaner oder Stundenplan-Ansicht
- `correction.html` — Korrektur-/Bewertungs-Interface
- `sources.html` — Quellenmanagement oder Material-Bibliothek
- `ui-kit.html` — Komponenten-Galerie (für Entwickler/Designer)

### Referenzen

- `reference/dashboard-reference.png` — Visuelles Mockup des Dashboards

---

## Mapping auf geplanten Stack

### Next.js + TypeScript + Tailwind CSS

Das Design-Kit ist **Design-Tool-agnostik**, sollte aber problemlos zu folgendem Stack migriert werden:

#### Tokens → Tailwind Config

1. **`design-tokens.json` → `tailwind.config.ts`**
   - Farben in `theme.colors`
   - Typografie in `theme.fontFamily`, `fontSize`, `lineHeight`
   - Spacing in `theme.spacing`
   - Border-Radius in `theme.borderRadius`
   - Shadows in `theme.boxShadow`

   Beispiel:
   ```typescript
   // tailwind.config.ts
   export default {
     theme: {
       colors: {
         // aus design-tokens.json
         neutral: { 50: "#f9fafb", 900: "#111827" },
         success: "#10b981",
         warning: "#f59e0b",
         danger: "#ef4444",
       },
       fontFamily: {
         sans: ["Inter", "-apple-system", "sans-serif"],
       },
       spacing: {
         xs: "0.25rem",
         sm: "0.5rem",
         md: "1rem",
         lg: "1.5rem",
       },
     },
   };
   ```

2. **CSS-Assets → Next.js Globals**
   - `assets/app.css` → `styles/globals.css` (oder in Layout importieren)
   - Reset, Base-Styles, Utility-Klassen erhalten
   - CSS-Variablen (falls vorhanden) zu Tailwind-Klassen refaktorieren

3. **HTML-Prototypen → React Components**
   - Jede `screen.html` wird zu einer Next.js Page oder komponiertem Layout
   - Struktur bleibt identisch, HTML-Elemente werden zu JSX konvertiert
   - CSS-Klassen mit Tailwind-Klassen ersetzen oder ergänzen

#### Komponenten-Umsetzung

Alle Komponenten (Button, Input, etc.) sollten:
1. Auf `Tailwind`-Klassen bauen (nicht Custom-CSS)
2. Variant-Pattern unterstützen (Primary, Secondary, Size: sm/md/lg)
3. In `/app/components/` oder `/lib/ui/` organisiert sein
4. TypeScript-Props typisiert sein
5. Accessibility-Attribute (ARIA) enthalten

Beispiel:
```typescript
// app/components/Button.tsx
interface ButtonProps {
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  children: React.ReactNode;
}

export function Button({ variant = "primary", size = "md", disabled = false, children }: ButtonProps) {
  const baseClasses = "font-semibold rounded-md transition focus:outline-none";
  const variantClasses = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-neutral-200 text-neutral-900 hover:bg-neutral-300",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };
  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
```

---

## Nutzungshinweise für UI-Umsetzung

### Regeln für Entwickler

1. **Keine Magic-Colors:** Immer Tailwind-Token oder Design-Tokens verwenden, nie Hex-Werte hardcoden.

2. **Responsive Design:** Tailwind Breakpoints nutzen (sm, md, lg, xl) — die sollten den Kit-Breakpoints entsprechen.

3. **Dark Mode:** Falls `design-tokens.json` Dark-Mode-Varianten enthält, in `tailwind.config.ts` mit `darkMode: 'class'` konfigurieren.

4. **Component-Library:** Eine zentrale `lib/ui/` oder `app/components/` Struktur aufbauen, um Duplikation zu vermeiden.

5. **Änderungen am Token:**
   - Token-Änderungen → `design-tokens.json` UND `tailwind.config.ts` synchonisieren
   - Idealtypisch: Token als Single Source of Truth, von dort generiert (z.B. mit Style Dictionary oder Token Studio)

6. **Prototyp-zu-Produktion:** HTML-Prototypen sind Referenz, nicht Code — refaktoriert zu React/Next.js Komponenten, nicht 1:1 kopiert.

---

## Barrierefreiheit und Kontrast

### Zu prüfen im Kit

1. **Farbkontraste:** WCAG AA (Mindestens 4.5:1 für Text, 3:1 für größere Elemente)
   - Besonders kritisch: Neutral-Farben für Text auf Hintergrund
   - `correction.html` und Bewertungs-Elemente (wichtig für Fehlermarkierungen)

2. **Schriftgrößen:**
   - Mindestens `14px` für Körpertext (WCAG)
   - `12px` max für Sekundärtext (aber lieber `13px+`)

3. **Focus States:**
   - Deutlicher Outline-Ring bei Keyboard-Navigation (z.B. `ring-2 ring-offset-2 ring-blue-600`)
   - Nicht nur Farbänderung

4. **Semantisches HTML:**
   - Buttons → `<button>`, nicht `<div>` mit Click-Handler
   - Eingabefelder → `<label>` + `<input>` verbunden via `htmlFor` / `id`
   - Überschriften → `<h1>`/`<h2>`/`<h3>` in Hierarchie

5. **SVG-Icons:**
   - `aria-hidden="true"` für rein dekorative Icons
   - `aria-label` für Icon-Buttons ohne Text (z.B. Close-Button)

### Zu dokumentieren im Code

- `app/components/accessibility-notes.md` — bekannte Compliance-Lücken und Mitigationen

---

## Design-Kit-Dateien (Inventar)

| Datei | Typ | Zweck |
|-------|-----|-------|
| `README.md` | Markdown | Übersicht, Setup-Anleitung |
| `design-tokens.json` | JSON | Designdaten (Farben, Typo, Spacing, Shadows) |
| `assets/app.css` | CSS | Base-Styles, Resets, Utilities |
| `assets/app.js` | JavaScript | Interaktivität (Dropdowns, Modals, Tabs) |
| `manifest.json` | JSON | Metadaten (Version, Autor, Lizenz, Export-Datum) |
| `handoff/CLAUDE_CODE_HANDOFF.md` | Markdown | Technische Handoff-Notes für Entwickler |
| `dashboard.html` | HTML | Prototype: Haupt-Dashboard |
| `worksheet-builder.html` | HTML | Prototype: Arbeitsblatt-Editor |
| `planner.html` | HTML | Prototype: Stundenplaner |
| `correction.html` | HTML | Prototype: Korrektur-Interface |
| `sources.html` | HTML | Prototype: Quellenmanagement |
| `ui-kit.html` | HTML | Komponenten-Galerie |
| `assets/logo.svg` | SVG | Anwendungs-Logo |
| `assets/empty-state.svg` | SVG | Leerzustand-Illustration |
| `reference/dashboard-reference.png` | PNG | Mockup-Referenz |

---

## Nächste Schritte

1. **Token-Extraktion:** `design-tokens.json` vollständig lesen und in `tailwind.config.ts` überführen.
2. **Component-Scaffolding:** React-Komponenten für jede UI-Komponente erzeugen (basierend auf Prototypen).
3. **CSS-Migration:** `app.css` in Tailwind-Classes refaktorieren, nur notwendiges Custom-CSS behalten.
4. **Accessibility-Audit:** Prototypen mit axe DevTools oder ähnlich prüfen.
5. **Design-System-Dokumentation:** Storybook oder ähnlich aufsetzen, um Komponenten zu showcasen.

---

## Verweise

- [../../PLAN.md](../../PLAN.md) — Projekt-Roadmap und Meilensteine
- [../product/USER_FLOWS.md](../product/USER_FLOWS.md) — Benutzer-Journeys
- [Design-Kit-Root](../../../unterrichtsassistenz-lsa-design-kit/) — Lokales Design-Artefakt
