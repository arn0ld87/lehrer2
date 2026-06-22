# 0006: Curriculum-Modellierung — Sek-II-Scope, Konfessionsstrang und Ethik

## Status

Akzeptiert, 2026-06-22

Konsolidiert drei zuvor offene, fachlich verschränkte Fragen aus [OPEN_QUESTIONS.md](../decisions/OPEN_QUESTIONS.md) (Fragen 1–3). Das in [DATA_MODEL.md](../architecture/DATA_MODEL.md) bereits angelegte Vokabular (`SchoolStage`, `Subject`, `ConfessionContext`, `GradeBand`) folgte den Vorschlägen schon vor dieser Entscheidung; dieses ADR ratifiziert die Linie verbindlich und stellt OPEN_QUESTIONS ↔ DATA_MODEL konsistent.

## Kontext

Das Curriculummodell trägt die fachliche und konfessionelle Identität der gesamten Lehrplantopologie (`CurriculumStrand` → `CurriculumNode`). Drei Designfragen waren offen und mussten vor dem M1-Datenmodell entschieden werden, weil jede die Enum-Topologie und die Pflicht-Retrieval-Filter (`subject + confessionContext`) prägt:

1. **Sekundarstufe II**: Wie werden Klassen 11/12 modelliert, und sind sie MVP-relevant? Sek II ist in Sachsen-Anhalt kurs-/halbjahresorganisiert, nicht jahrgangsbezogen — eine andere Lehrplanlogik als Sek I (5–10).
2. **Konfessionalität**: Bekommen konfessionsübergreifende/ökumenische Materialien einen eigenen `confessionContext`-Wert oder werden sie dual unter evangelisch + katholisch indexiert?
3. **Ethik**: Eigenständiges Fach oder Modus von Religion?

Bindende Grundsätze (siehe [AGENTS.md](../../AGENTS.md)): Religion ist strikt zu trennen (ev./kath./konfessionssensibel-übergreifend); Ethik wird **nicht** unter Religion subsumiert.

## Entscheidung

### (1) Sekundarstufe II — MVP nur Sek I (Klassen 5–10), Schema bleibt vorwärtskompatibel

- MVP-Curriculum-Ingestion, Generierung, Matching und Korrekturmodelle gelten **ausschließlich für Sek I** (`SchoolStage.SEK_I`, `GradeBand` `KS5`–`KS10`).
- `SchoolStage.SEK_II` und die Kurshalbjahres-Bänder (z. B. `Q1_HJ1`) **bleiben im Schema vorgesehen** (forward-compatible), werden im MVP aber nicht befüllt und nicht produktiv ausgewertet.
- Keine doppelte Curriculum-Logik im MVP; Sek II wird als eigene nachgelagerte Ausbaustufe behandelt, sobald Lehrpläne und Bedarf vorliegen.

**Gewählte Option:** OPEN_QUESTIONS Frage 1, Option 1.

### (2) Konfessionalität — dritter Strang `KONFESSIONSSENSIBEL_UEBERGREIFEND`, keine duale Indexierung

- Konfessionsübergreifende/ökumenische Materialien erhalten **einen** Strang mit `confessionContext = KONFESSIONSSENSIBEL_UEBERGREIFEND` (ein Dokument, ein Index-Eintrag). Keine redundante Doppel-Indexierung unter `EVANGELISCH` + `KATHOLISCH`.
- **Retrieval-Regel (verbindlich):** Eine Anfrage für `EVANGELISCH` bzw. `KATHOLISCH` darf zusätzlich `KONFESSIONSSENSIBEL_UEBERGREIFEND`-Material einbeziehen, **niemals** aber direkt zwischen `EVANGELISCH` und `KATHOLISCH` aggregieren. Die strukturelle Konfessionstrennung aus DATA_MODEL §„Erzwungene Konfessionstrennung" bleibt unberührt.

**Gewählte Option:** OPEN_QUESTIONS Frage 2, Option 1.

### (3) Ethik — eigenes `Subject`, nicht Modus von Religion

- `Subject.ETHIK` ist ein eigenständiges Fach mit eigenen Lehrplänen.
- `confessionContext` für Ethik ist auf `{RELIGIONSKUNDLICH, NICHT_ANWENDBAR}` beschränkt (DB-CHECK-Constraint bereits in DATA_MODEL).
- Ethik wird nicht über `confessionContext` an Religion gekoppelt; religionskundliche Betrachtung bleibt als `RELIGIONSKUNDLICH`-Kontext abbildbar.

**Gewählte Option:** OPEN_QUESTIONS Frage 3, Option 1.

## Wichtigste Gegenstimmen (dokumentiert)

- **Sek II ab MVP**: Falls die Pilotschule Sek-II-Klassen parallel unterrichtet, entsteht eine Funktionslücke. Entgegnung: Pilot fokussiert laut PLAN auf Sek I; Sek-II-Lehrpläne liegen für den MVP nicht kuratiert vor (ADR 0003 verbietet Ingestion ungeprüfter Quellen). Die Lücke ist bewusst und nachrüstbar, da das Schema `SEK_II` schon kennt.
- **Duale Indexierung statt drittem Strang**: Gäbe granularere Per-Konfession-Kontrolle. Entgegnung: erzeugt Redundanz und Drift-Risiko zwischen den Kopien und verwässert die Invariante; der dritte Strang ist semantisch ehrlicher.
- **Ethik als Religion-Modus**: Wäre Enum-sparsamer. Entgegnung: Ethik hat eigene (oft KMK-harmonisierte) Lehrpläne mit philosophischem statt theologischem Inhalt; eigene `Subject`-Dimension ist klarer zu filtern und zu zitieren.

## Konsequenzen

### Positiv

- Datenmodell ist entscheidungsfest; M1 (Curriculum-Datenmodell, Planungsassistent) kann ohne offene Enum-Fragen starten.
- Konfessionstrennung bleibt strukturell erzwungen; ein dritter Strang verhindert stille Vermischung.
- Vorwärtskompatibilität für Sek II ohne MVP-Komplexität.

### Offene Folgepunkte (kein Blocker für M1)

- **Stakeholder-Bestätigung** für den MVP-Schnitt (Sek I) bleibt erforderlich: Werden an der Pilotschule Sek-II-Schüler parallel unterrichtet? (OPEN_QUESTIONS Frage 1, Status-Notiz.)
- Retrieval-Schicht muss die Übergreifend-Einbeziehungsregel als Pflichttest abbilden (Akzeptanzkriterium für M2).
- Sek-II-Ausbau erhält ein eigenes ADR, sobald Lehrpläne kuratiert vorliegen.

## Verweise

- [../decisions/OPEN_QUESTIONS.md](../decisions/OPEN_QUESTIONS.md) — Fragen 1–3 (jetzt entschieden).
- [../architecture/DATA_MODEL.md](../architecture/DATA_MODEL.md) — `SchoolStage`, `Subject`, `ConfessionContext`, `GradeBand`, Konfessionstrennung.
- [../architecture/RAG_ARCHITECTURE.md](../architecture/RAG_ARCHITECTURE.md) — Pflichtfilter `subject + confessionContext`.
- [0003-source-governance-before-ingestion.md](./0003-source-governance-before-ingestion.md) — keine Ingestion ungeprüfter (Sek-II-)Quellen.
