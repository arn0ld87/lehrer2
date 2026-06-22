# 0008: Dokument-Export-Stack (DOCX/PDF)

## Status

**Vorgeschlagen (Proposed), 2026-06-22** — finale Annahme durch Maintainer im PR-Review ausstehend.

> CLAUDE.md/AGENTS.md schreiben vor, dass der Export-Stack nicht ad hoc, sondern per ADR entschieden wird. Dieses ADR legt eine begründete Empfehlung vor.

## Kontext

Exportiert werden **Arbeitsblätter** und **Bewertungsraster/Erwartungshorizonte** (`Worksheet`, `Rubric`, `ExpectationHorizon` aus DATA_MODEL): strukturierte Dokumente mit Überschriften, Aufgabenlisten, Tabellen, ggf. Kopfzeilen/Logos.

Anforderungen:

- **Zwei Formate**: DOCX (von Lehrkräften nachbearbeitbar) und PDF (druckfertig).
- **Self-hosted / local-first**: keine externen Cloud-Render-Dienste; geringer Server-Footprint (budgetlimitierte Schulnetze).
- **Unicode**: Umlaute, ggf. griechische Schrift (Religion); zuverlässiges Font-Handling.
- **Lizenz**: keine versteckten kommerziellen/AGPL-Abhängigkeiten ungeprüft einziehen (vgl. Beitragsregeln, [LICENSE-DECISION.md](../../LICENSE-DECISION.md)).

## Optionen (Recherchestand 2026-06)

**DOCX**

| Lib           | Lizenz                | Status                | Bewertung                                                |
| ------------- | --------------------- | --------------------- | -------------------------------------------------------- |
| **docx**      | MIT                   | aktiv                 | volle programmatische Kontrolle, schlank                 |
| docxtemplater | Core MIT + Pro-Module | aktiv                 | Template-basiert; HTML-/Image-Module **kostenpflichtig** |
| officegen     | MIT                   | **deprecated** (2022) | raus                                                     |
| html-to-docx  | —                     | **abandoned/404**     | raus                                                     |

**PDF**

| Lib                  | Lizenz      | Status | Footprint       | Bewertung                                    |
| -------------------- | ----------- | ------ | --------------- | -------------------------------------------- |
| **pdfkit**           | MIT         | aktiv  | ~57 KB          | imperativ, gut für strukturierte Dokumente   |
| @react-pdf/renderer  | MIT         | aktiv  | ~70 KB          | deklarativ (React), Next.js-affin            |
| pdf-lib              | MIT         | aktiv  | ~135 KB         | eher Manipulation als Layout-Generierung     |
| Puppeteer/Playwright | Apache 2.0  | aktiv  | **300 MB–1 GB** | beste Layout-Treue, aber Footprint untragbar |
| Typst/LaTeX/Pandoc   | div. (frei) | aktiv  | extra Binary    | sehr drucktreu, eigener Toolchain-Aufwand    |

## Entscheidung (vorgeschlagen)

- **DOCX: `docx` (MIT).** Aktiv gepflegt, schlank, vollständige Kontrolle über strukturierte Inhalte, sauberes Unicode-Handling. Liefert das nachbearbeitbare Lehrkraft-Format.
- **PDF: `pdfkit` (MIT)** als Default für die strukturierten Arbeitsblätter/Raster; **`@react-pdf/renderer`** als gleichwertige Alternative, falls ein deklarativer, komponentennaher Layout-Stil bevorzugt wird.
- **Headless-Browser (Puppeteer/Playwright) ausgeschlossen** für den MVP: 300 MB–1 GB Footprint plus dauerhafter RAM-Verbrauch sind für Schul-Self-Hosting unverhältnismäßig.
- **docxtemplater** nur, falls Lehrkräfte eigene Vorlagen pflegen sollen — und dann strikt im **Core (MIT)**; kostenpflichtige Pro-Module (HTML/Images) erst nach dokumentierter Lizenzfreigabe.

## Wichtigste Gegenstimmen (dokumentiert)

- **HTML→PDF via Headless-Browser** gäbe die höchste Layout-Treue (eine HTML-Vorlage für Web-Vorschau und PDF). Entgegnung: Footprint disqualifiziert es für budgetlimitierte Schulnetze; bei echtem Bedarf an pixelgenauem mehrspaltigem Layout ist eher eine **Typst**-Renderer-Evaluierung (single binary, drucktreu) sinnvoll als ein Browser.
- **Single-Source `docx` → PDF via LibreOffice headless** vermeidet zwei Render-Pfade, zieht aber LibreOffice (mehrere hundert MB) als Abhängigkeit ein — ebenfalls Footprint-Trade-off; nicht für MVP.

## Offene Fragen (vom Maintainer vor Annahme zu klären)

1. Ist pixelgenaue, mehrspaltige Layout-Treue ein MVP-Muss? Falls ja → Typst-Renderer gegen pdfkit evaluieren.
2. `pdfkit` (imperativ) oder `@react-pdf/renderer` (deklarativ) — Team-Präferenz?
3. Sollen Web-Vorschau und PDF aus **einer** Quelle gerendert werden (spräche für einen HTML-/Komponenten-Ansatz trotz Footprint)?

## Konsequenzen

- M1 (Issue #14 „DOCX-/PDF-Export-Architektur und Lizenzrisiken"): Export hinter einer Format-Abstraktion (`exportWorksheet(format)`), damit Renderer austauschbar bleiben.
- `Worksheet.license` / `derivation_source` (DATA_MODEL) werden in den Export-Footer übernommen (Quellen-/Lizenztransparenz).
- Nur MIT-Abhängigkeiten im MVP-Pfad; Lizenzprüfung dokumentiert.

## Verweise

- [../architecture/DATA_MODEL.md](../architecture/DATA_MODEL.md) — `Worksheet`, `Rubric`, `ExpectationHorizon`, `license`, `derivation_source`.
- [../../LICENSE-DECISION.md](../../LICENSE-DECISION.md) — Lizenzrahmen des Projekts.
- docx: <https://docx.js.org> · pdfkit: <https://pdfkit.org> · @react-pdf/renderer: <https://react-pdf.org> · Typst: <https://typst.app>
