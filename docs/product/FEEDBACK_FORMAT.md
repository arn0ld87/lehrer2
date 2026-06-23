# Nachvollziehbares Feedbackformat (Belege/Unsicherheit/Verlauf)

Dieses Dokument spezifiziert das Feedbackformat für die Unterrichtsassistenz LSA. Es stellt sicher, dass Rückmeldungen an Schülerinnen und Schüler nicht als "Black Box" erscheinen, sondern durch Belege fundiert sind, Unsicherheiten offenlegen und in ihrer Entstehung (KI-Vorschlag bis menschliche Entscheidung) nachvollziehbar bleiben.

## 1. Struktur eines Feedbacks (FeedbackStatement)

Ein Feedback besteht aus einer Liste von Aussagen (Statements). Jede Aussage folgt dieser Struktur:

| Komponente                  | Beschreibung                                                                                        |
| :-------------------------- | :-------------------------------------------------------------------------------------------------- |
| **Aussage (Text)**          | Die eigentliche Rückmeldung (Lob, Kritik, Hinweis).                                                 |
| **Belege (Evidence)**       | Liste von Referenzen auf Quellen (Lehrplan, Handreichung) oder Stellen im Schülertext.              |
| **Sicherheit (Confidence)** | Metrik und Begründung der KI-Sicherheit (High, Medium, Low).                                        |
| **Status**                  | Kennzeichnung, ob es sich um einen reinen KI-Entwurf oder eine menschlich geprüfte Aussage handelt. |

### Beispiel (JSON-Struktur)

```json
{
  "id": "stmt-001",
  "text": "Du nutzt Textbelege gezielt, um Janas Schüchternheit zu untermauern.",
  "evidence": [
    {
      "type": "STUDENT_TEXT",
      "reference": "Zeile 12-14",
      "content": "...sie blickte zu Boden und antwortete kaum hörbar..."
    },
    {
      "type": "CURRICULUM",
      "source_ref_id": "src-lp-de-8",
      "label": "Fachlehrplan Deutsch, Kompetenzschwerpunkt Schreiben"
    }
  ],
  "confidence": {
    "level": "HIGH",
    "reasoning": "Direkte Übereinstimmung mit dem Erwartungshorizont und eindeutige Textstelle identifiziert."
  },
  "status": "HUMAN_APPROVED"
}
```

## 2. Belege und Quellen (CITATION_STANDARD)

Jede fachliche Aussage MUSS belegt sein. Wir unterscheiden zwei Arten von Belegen:

1.  **Interne Belege (Schülertext):** Verweise auf konkrete Zeilen, Absätze oder Zitate aus der eingereichten Arbeit.
2.  **Externe Belege (Fach/Lehrplan):** Verweise auf den Erwartungshorizont, den Lehrplan oder zugelassene Unterrichtsmaterialien gemäß [CITATION_STANDARD](../rag/CITATION_STANDARD.md).

## 3. Darstellung von Unsicherheit

Unsicherheit darf nie versteckt werden (AGENTS.md). Das System markiert Aussagen mit geringer Sicherheit visuell.

| Level      | Kriterium                                                                      | UI-Darstellung                                                        |
| :--------- | :----------------------------------------------------------------------------- | :-------------------------------------------------------------------- |
| **HIGH**   | Eindeutige Faktenlage, klare Belege.                                           | Normale Darstellung.                                                  |
| **MEDIUM** | Interpretation möglich, Belege nicht 100% deckungsgleich.                      | Hinweis-Icon (Info).                                                  |
| **LOW**    | Hypothetisch, keine direkten Belege gefunden, Modell "halluziniert" eventuell. | Warn-Icon + Farbliche Markierung (Gelb/Orange) + Text "Bitte prüfen". |

**Regel:** Aussagen mit `LOW` Confidence müssen von der Lehrkraft zwingend manuell bestätigt oder korrigiert werden, bevor sie für Schüler sichtbar werden.

## 4. Nachvollziehbarer Verlauf (History)

Der Weg vom ersten KI-Entwurf bis zum finalen Feedback für den Schüler wird lückenlos protokolliert.

### Phasen des Verlaufs

1.  **AI_GENERATED**: Der rohe Vorschlag des Modells (inkl. Redaction-Status).
2.  **HUMAN_REVIEW**: Die Lehrkraft sichtet den Entwurf.
3.  **HUMAN_EDITED**: Die Lehrkraft nimmt Änderungen vor.
4.  **FINAL_APPROVED**: Die Lehrkraft gibt das Feedback frei.

### Historien-Eintrag (Audit-fähig)

```json
{
  "timestamp": "2026-06-22T10:15:00Z",
  "actor": "AI (qwen2.5-14b)",
  "action": "CREATE_DRAFT",
  "change_summary": "Initialer Korrekturvorschlag generiert."
},
{
  "timestamp": "2026-06-22T10:20:00Z",
  "actor": "Jana Zwarg (Lehrkraft)",
  "action": "EDIT_STATEMENT",
  "target_id": "stmt-001",
  "original_text": "...",
  "new_text": "..."
}
```

## 5. Nicht-Ziele (Abgrenzung)

- **Keine Notenautomatik:** Das System berechnet keine finalen Noten. Es liefert Punktvorschläge basierend auf dem Raster, die finale Bewertung obliegt der Lehrkraft.
- **Kein Direktversand:** Feedback wird nie automatisiert an Schüler versendet. Die Lehrkraft bleibt das Gate.

## Verweise

- [CITATION_STANDARD](../rag/CITATION_STANDARD.md) — Format der Quellennachweise.
- [DATA_MODEL](../architecture/DATA_MODEL.md) — Persistenz der Korrekturdaten.
- [AGENTS.md](../../AGENTS.md) — Prinzip "Unsicherheit nie verdecken".
