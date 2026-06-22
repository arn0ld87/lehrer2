# Design-System – Unterrichtsassistenz LSA

## 1. Design-These

Lehrkräfte arbeiten mit hoher Informationsdichte, knapper Zeit und fachlicher Verantwortung. Das Interface soll deshalb nicht „spielerisch“ wirken, sondern **klar, professionell und kontrollierbar**.

Die Gestaltungsrichtung verbindet:
- administrative Ruhe,
- lesbare Fachlichkeit,
- sichtbare Quellen und Status,
- vorsichtige Akzentfarben für Domänen,
- klare menschliche Kontrollpunkte bei KI-Ergebnissen.

## 2. Grundregeln

### 2.1 Hierarchie

1. Seitenziel und aktueller Kontext stehen immer oben links.
2. Primäre Aktion steht oben rechts, maximal eine pro Screen.
3. Quellen, Unsicherheiten und Freigabestatus stehen in unmittelbarer Nähe zum betroffenen Inhalt.
4. Tabellen bleiben datenorientiert: keine unnötigen Karten pro Tabellenzeile.

### 2.2 KI-Verhalten im Interface

- KI-Ausgaben heißen **Entwurf**, **Vorschlag**, **Analyse** oder **Prüfhinweis**, niemals „Ergebnis“ ohne Einordnung.
- Unklarheiten werden mit einem sichtbaren Status `Prüfung erforderlich` markiert.
- Quellenbelege bleiben klickbar und nicht bloß dekorativ.
- Bei Korrekturen gibt es keinen „Note übernehmen“-Button.
- Externe Provider- oder Cloud-Verarbeitung muss sichtbar und konfigurierbar sein.

### 2.3 Fachfarben

| Bereich | Farbe | Verwendung |
|---|---|---|
| Marke / globale Aktion | Indigo `#5D3DF5` | Hauptaktionen, Navigation, Fokus |
| Deutsch | Violett `#7C3AED` | Fachbadges, Materialtyp, Kontext |
| Religion / positiver Status | Türkis `#0F9B7A` | Religionskontext, geprüfte Inhalte |
| Korrektur / Aufmerksamkeit | Koralle `#E05A38` | offene Prüfung, kritische Hinweise |
| Quellen | Blau `#2563EB` | Quellenverwaltung, Metadaten |

## 3. Layout

- **Desktop:** feste linke Sidebar mit 260px Breite.
- **Tablet:** Sidebar weiterhin vorhanden, jedoch verdichtete Inhalte.
- **Mobile:** Sidebar als Off-Canvas-Panel, einspaltige Inhaltsbereiche.
- **Maximale Content-Breite:** ca. 1680px.
- **Spacing-Rhythmus:** 4, 8, 12, 16, 20, 28, 36px.

## 4. Komponenten

### Status-Badge

| Status | Bedeutung |
|---|---|
| `Entwurf` | noch nicht fachlich geprüft |
| `Wartet` / `Prüfung` | menschliche oder technische Prüfung nötig |
| `Freigegeben` / `aktiv` | dokumentiert und nutzbar |
| `Unsicherheit` | KI-/Datenlage unklar, keine automatische Entscheidung |

### Card

Cards gruppieren zusammengehörige Arbeitsbereiche. Sie ersetzen keine Tabellen und keine längeren Workflows.

- Radius: 22px
- Border: 1px `#E6E8F0`
- Shadow: subtil
- Innenabstand: 19px oder 24px

### Buttons

- `Primary`: nur für die zentrale Aktion des aktuellen Kontexts.
- `Secondary`: reversible oder ergänzende Aktionen.
- `Ghost`: Navigation, Details, niedrig priorisierte Aktionen.
- Destruktive Aktionen werden nicht in diesem ersten Kit gezeigt, müssen später eindeutig rot und bestätigungspflichtig sein.

## 5. Accessibility

- Kontrastreiche Textfarben auf weißen Flächen.
- Fokuszustand über sichtbaren violetten Ring.
- Keine Bedeutung allein über Farbe.
- Status immer mit Text, nicht nur Symbol.
- Interaktive Ziele mindestens 42px hoch.
- Tabellen horizontal scrollbar statt unlesbar komprimiert.

## 6. Anti-Patterns

Nicht verwenden:

- überdimensionierte lila Verläufe
- Emoji als fachliche Statusanzeige
- Cartoon-Lehrkräfte oder „KI-Roboter“
- Gamification bei Korrektur und Bewertung
- verdeckte Quellen hinter Tooltips
- irreversibles „Ein-Klick-Übernehmen“ von KI-Vorschlägen
