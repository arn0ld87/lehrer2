# Spezifikation: Bewertungsraster- & Erwartungshorizont-Generator

Diese Spezifikation beschreibt den Generator für Bewertungsraster und Erwartungshorizonte (EH). Der Fokus liegt auf der Unterstützung der Lehrkraft bei der Erstellung objektiver Beurteilungsgrundlagen, wobei die menschliche Letztentscheidung und der Verzicht auf Notenautomatik als Kernprinzipien gewahrt bleiben.

## 1. Zielsetzung und Prinzipien

Der Generator dient dazu, aus einer Aufgabenstellung (Task) und optionalem Kontext (Lehrplan, Unterrichtsmaterial) einen strukturierten Vorschlag für die Bewertung zu erstellen.

- **Menschliche Letztentscheidung:** Jede KI-generierte Komponente muss von der Lehrkraft gesichtet, ggf. bearbeitet und explizit freigegeben werden.
- **Keine Notenautomatik:** Das System schlägt Punkte oder Erfüllungsgrade vor, berechnet aber keine finalen Noten.
- **Transparenz:** Die Herkunft von Kriterien (z.B. aus dem Lehrplan) muss durch Zitate belegt sein.

## 2. Generator-Flow

Der Prozess der Generierung folgt einem vierstufigen Flow:

1.  **Input & Kontext:**
    - Auswahl einer bestehenden Aufgabe (`task`).
    - Optionaler Kontext: Hochgeladene Materialien, spezifische Kompetenzschwerpunkte aus dem Lehrplan (`curriculum_node`).
2.  **AI-Drafting:**
    - Generierung eines `expectation_horizon` (Musterlösung, Teillösungsschritte).
    - Generierung einer `rubric` (Kriterien, Gewichtungen, Deskriptoren).
    - Markierung von Unsicherheiten (Confidence) gemäß [FEEDBACK_FORMAT.md](FEEDBACK_FORMAT.md).
3.  **Mandatory Human Review (Nachbearbeitung):**
    - Die Lehrkraft sichtet den Entwurf in einer Editier-Ansicht.
    - Anpassung von Deskriptoren, Gewichtungen oder Kriterien.
    - Bestätigung der einzelnen Blöcke.
4.  **Finalisierung:**
    - Speicherung als `FINAL_APPROVED` Artefakt.
    - Das Artefakt dient als Basis für den Korrekturworkflow.

## 3. Datenstrukturen

Der Generator befüllt die in `src/lib/db/schema/artifacts.ts` definierten Strukturen:

### ExpectationHorizon (`expectation_horizon`)

- `model_solution`: Ein ausführlicher Textvorschlag der Musterlösung.
- `acceptance_criteria` (JSON): Eine Liste von atomaren Anforderungen (z.B. "Nennt drei Schichten des Waldbodens").
- `partial_credit_rules` (JSON): Regeln, wie Teilpunkte bei unvollständiger Erfüllung vergeben werden.

### Rubric (`rubric` & `rubric_criterion`)

- `scale_type`: `ANALYTIC` (Kriterien einzeln) oder `HOLISTIC` (Gesamteindruck).
- `rubric_criterion`:
  - `label`: Name des Kriteriums (z.B. "Fachsprachliche Präzision").
  - `weight`: Gewichtung des Kriteriums am Gesamtgewicht.
  - `level_descriptors` (JSON Array): Deskriptoren pro Niveau (z.B. 4 Stufen von "nicht erfüllt" bis "übertroffen").

## 4. Korrelation mit dem Korrekturworkflow (M3)

Das generierte und manuell freigegebene Raster ist die zwingende Voraussetzung für die Korrekturassistenz. Die Verknüpfung erfolgt über die `submissionId` und `rubricId` im `CorrectionDraft` (siehe [DATA_MODEL.md](../architecture/DATA_MODEL.md)).

- **Input für KI-Korrektur:** Die Korrektur-Engine lädt den verknüpften `expectation_horizon` und die `rubric`. Die `acceptance_criteria` und `level_descriptors` fließen als strukturierte Anweisungen (System-Prompt) in die Analyse der Schülerarbeit ein.
- **Konsistenzprüfung:** Das System stellt sicher, dass nur Raster mit dem Status `FINAL_APPROVED` für die Korrektur verwendet werden.
- **Traceability:** Abweichungen zwischen dem EH/Rubrik und der tatsächlichen KI-Bewertung werden im `CorrectionDraft` unter `provenance` dokumentiert (z.B. "Kriterium X konnte nicht eindeutig geprüft werden").
- **Menschliche Entscheidung:** Die Lehrkraft sieht im Korrektur-Interface das zugrundeliegende Raster parallel zum Schülertext und dem KI-Vorschlag, um die Konsistenz der Bewertung unmittelbar validieren zu können.

## 5. Risiken und Minderungsstrategien

| Risiko                               | Strategie                                                                                          |
| :----------------------------------- | :------------------------------------------------------------------------------------------------- |
| Hoher Nachbearbeitungsaufwand        | Bereitstellung von hochwertigen Vorlagen und schnellen Editier-Funktionen (Inline-Edit).           |
| Unkritische Übernahme von KI-Fehlern | Visuelle Hervorhebung von `LOW` Confidence Bereichen und Pflicht-Checkbox für "Gelesen & Geprüft". |
| Divergenz zum Lehrplan               | Erzwingung von RAG-Belegen für jedes generierte Kriterium.                                         |
