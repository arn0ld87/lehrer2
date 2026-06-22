# Datenmodell

Konzeptionelles Datenmodell für die Unterrichtsassistenz-Plattform. Beschreibt Entitäten, Relationen, Datenklassen und Invarianten. Implementiert wird das Modell in TypeScript/Drizzle ORM (siehe [ADR-0005](../adr/0005-orm-drizzle.md)).

> **Implementierungsstatus (Stand 2026-06-22):** M1 Schritt 2 (Branch `m1/data-model-export`) implementiert die Entitäten der Datenklassen `PUBLIC` und `INTERNAL` — Auth/Tenant, Curriculum, Unterrichtsplan, Arbeitsblatt, Bewertungsraster/Erwartungshorizont, Provenienz/Audit sowie die Export-Architektur (DOCX/PDF). Die `SENSITIVE_STUDENT`-Entitäten (`StudentSubmission`, `CorrectionDraft`, `pseudonym_mappings`) sind **konzeptionell hier beschrieben, aber bewusst nicht in M1 implementiert** — sie folgen in **M3** (Korrekturassistenz), sobald Pseudonymisierung, Redaction und DSFA-Vorbehalt vollständig ausgearbeitet sind (ADR 0004, ADR 0009).

## Kontrollierte Vokabulare (Enums)

### SchoolForm

- `GESAMTSCHULE` — Integrierte Gesamtschule
- `GEMEINSCHAFTSSCHULE` — Gemeinschaftsschule

### EducationTrack (Bildungsgang)

- `HAUPTSCHULBILDUNGSGANG`
- `REALSCHULBILDUNGSGANG`
- `GYMNASIALER_BILDUNGSGANG`

Nur in Sekundarstufe I relevant; bei Sekundarstufe II `NULL` (schulformübergreifend).

### SchoolStage

- `SEK_I` — Sekundarstufe I (Klassen 5–10)
- `SEK_II` — Sekundarstufe II (Qualifikationsphase mit Kurshalbjahren statt Jahrgangszahlen)

### Subject

- `DEUTSCH`
- `RELIGION`
- `ETHIK`

Weiterer Ausbau je nach Schulkontext geplant.

### ConfessionContext (Konfessionalitaet)

- `EVANGELISCH` — Evangelische Perspektive
- `KATHOLISCH` — Katholische Perspektive
- `KONFESSIONSSENSIBEL_UEBERGREIFEND` — Religion mit konfessioneller Sensibilität, aber übergreifend
- `RELIGIONSKUNDLICH` — Ethik mit religionskundlichem Bezug
- `NICHT_ANWENDBAR` — Wert für nicht-religiöse Fächer (z.B. DEUTSCH)

**Invariante (auf DB-Ebene erzwungen):**

- `subject = RELIGION` ⟹ `confessionContext ∈ {EVANGELISCH, KATHOLISCH, KONFESSIONSSENSIBEL_UEBERGREIFEND}`
- `subject = ETHIK` ⟹ `confessionContext ∈ {RELIGIONSKUNDLICH, NICHT_ANWENDBAR}`
- `subject = DEUTSCH` ⟹ `confessionContext = NICHT_ANWENDBAR`

Diese Checks verhindern auf Datenbankebene Falscheingaben wie „katholischer Deutschunterricht".

### GradeBand

- `KS5`, `KS6`, `KS7`, `KS8`, `KS9`, `KS10` — Sekundarstufe I (Klassen 5–10)
- Sekundarstufe II: Kurshalbjahre, nicht Jahrgangszahlen (z.B. `Q1_HJ1` für erstes Halbjahr der Qualifikationsphase)

## Kontrollierte Quellen (RAG-Trust)

Siehe [RAG_ARCHITECTURE.md](./RAG_ARCHITECTURE.md):

- `OFFICIAL_BINDING` — Gesetzliche Lehrpläne, Rahmenvorgaben (Kultusministerium)
- `OFFICIAL_GUIDANCE` — Amtliche Handreichungen, Empfehlungen
- `OPEN_CURATED` — Vetted Open Educational Resources
- `USER_APPROVED` — Von der Lehrkraft explizit freigegeben
- `UNVERIFIED` — Nicht freigegeben, nur intern für Drafts

`UNVERIFIED` darf nicht in produktiver Generierung verwendet werden.

## CurriculumStrand

**Unbrechbare, fachliche Einheit der Lehrplantopologie.**

Sitzt am oberen Rand der Hierarchie und trägt die domänenbezogene und konfessionelle Identität (bei Religion/Ethik).

| Feld                  | Typ               | Beschreibung                                                             | Invarianten                                                                |
| --------------------- | ----------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `id`                  | UUID              | Primärschlüssel                                                          | PK                                                                         |
| `subject`             | Subject           | Fachbereich                                                              | NOT NULL                                                                   |
| `confessionContext`   | ConfessionContext | Konfessionelle Ausrichtung (bei Religion/Ethik)                          | NOT NULL; CHECK (subject + confessionContext kombiniert zulässig)          |
| `schoolForm`          | SchoolForm        | Schulform (nur Sek I relevant)                                           | Nullable; nur bei `schoolStage = SEK_I` gesetzt                            |
| `educationTrack`      | EducationTrack    | Bildungsgang (nur Sek I relevant)                                        | Nullable; nur bei `schoolStage = SEK_I` und `schoolForm` definiert gesetzt |
| `schoolStage`         | SchoolStage       | Schulstufe                                                               | NOT NULL                                                                   |
| `framework_authority` | String            | Herausgebende Institution (z.B. „Kultusministerium Nordrhein-Westfalen") | NOT NULL                                                                   |
| `valid_from`          | Date              | Gültigkeitsbeginn                                                        | NOT NULL                                                                   |
| `valid_to`            | Date              | Gültigkeitsende                                                          | Nullable                                                                   |
| `version`             | String (SemVer)   | Versionsnummer des Lehrplans                                             | NOT NULL                                                                   |
| `supersedes_id`       | UUID              | Verweis auf älteren Strang (Versionierung)                               | Nullable FK → CurriculumStrand                                             |
| `status`              | Enum              | `DRAFT`, `ACTIVE`, `RETIRED`                                             | NOT NULL; Default `DRAFT`                                                  |

**Konkretes Beispiel:**

```
CurriculumStrand {
  id: "...",
  subject: RELIGION,
  confessionContext: EVANGELISCH,
  schoolForm: GESAMTSCHULE,
  educationTrack: GYMNASIALER_BILDUNGSGANG,
  schoolStage: SEK_I,
  framework_authority: "Kultusministerium Nordrhein-Westfalen",
  valid_from: "2019-08-01",
  valid_to: NULL,
  version: "1.0.0",
  supersedes_id: NULL,
  status: ACTIVE
}
```

## CurriculumNode

**Hierarchischer Kompetenz-/Themenknoten innerhalb eines Strangs.**

Erbt `subject` und `confessionContext` von `strand_id` — Konfession ist nicht austauschbar.

| Feld              | Typ       | Beschreibung                                                | Invarianten                                             |
| ----------------- | --------- | ----------------------------------------------------------- | ------------------------------------------------------- |
| `id`              | UUID      | Primärschlüssel                                             | PK                                                      |
| `strand_id`       | UUID      | Verweis zum Strand                                          | FK → CurriculumStrand; NOT NULL; erbt confessionContext |
| `parent_id`       | UUID      | Überknoten (Baumstruktur)                                   | Nullable FK → CurriculumNode (gleicher Strang)          |
| `grade_band`      | GradeBand | Zieljahrgang / Kurshalbjahr                                 | Nullable (zur Differenzierung)                          |
| `code`            | String    | Offizieller Lehrplan-Code (für Zitation)                    | NOT NULL; eindeutig pro Strand                          |
| `title`           | String    | Kompetenzbezeichnung                                        | NOT NULL                                                |
| `description`     | Text      | Detaillierte Beschreibung                                   | Nullable                                                |
| `competence_area` | String    | Thematischer Bereich (z.B. „Bibelkunde", „Sprachkompetenz") | Nullable                                                |

**Baum-Invariante:** `parent_id` verweist immer auf Knoten desselben `strand_id`.

**Konkretes Beispiel:**

```
CurriculumNode {
  id: "...",
  strand_id: "<evangelischer_strand>",
  parent_id: NULL,  // Root-Knoten
  grade_band: KS8,
  code: "EV.8.1",
  title: "Bibel als Zeugnis des Glaubens",
  description: "Schüler kennen zentrale biblische Erzählungen und ihre Bedeutung für evangelischen Glauben.",
  competence_area: "Bibelkunde"
}
```

## Erzwungene Konfessionstrennung

Die Plattform verhindert kreuzkonfessionelle Vermischung strukturell auf drei Ebenen:

### 1. Datenbankebene

- `confessionContext` sitzt am `CurriculumStrand`, nicht an Blatt-Inhalten.
- Alle `CurriculumNode` erben `confessionContext` über `strand_id`.
- CHECK-Constraint: `(subject, confessionContext)` darf nicht gleichzeitig widersprüchlich sein (siehe ConfessionContext-Invarianten oben).

### 2. Applikationslogik

- RAG-Retrieval für Unterrichtsartefakte trägt `subject + confessionContext` als **Pflichtfilter**.
- Lehrkraft wählt bei Generierungs-Anfrage Strang (und damit Konfession) aus; Prompt enthält nur Kontexte aus diesem Strang.
- **Keine kreuzkonfessionelle Aggregation:** Eine Generierungs-Anfrage für RELIGION-EVANGELISCH zieht nicht aus RELIGION-KATHOLISCH hinzu.

### 3. Audit & Transparenz

- Jede Generierung (via `GenerationProvenance`) erfasst, welche `CurriculumStrand`-IDs konsultiert wurden.
- Logs sind reviewbar für Schulleitung / Eltern.

## Unterrichtsartefakte

Alle Unterrichtsartefakte teilen folgende konventionelle Felder:

| Feld               | Typ       | Beschreibung                                 |
| ------------------ | --------- | -------------------------------------------- |
| `id`               | UUID      | Primärschlüssel                              |
| `owner_teacher_id` | String    | User-ID der erstellen Lehrkraft              |
| `strand_id`        | UUID      | FK → CurriculumStrand (Domäne + Konfession)  |
| `data_class`       | DataClass | Klassifizierung (siehe Datenklassifizierung) |
| `created_at`       | Timestamp | Erstellungszeit                              |
| `updated_at`       | Timestamp | Letzte Änderung                              |
| `deleted_at`       | Timestamp | Soft-Delete (Nullable)                       |
| `version`          | Integer   | Optimistic Lock                              |

### TeachingUnit

Unterrichtssequenz mit mehreren Lektionen.

| Feld               | Typ       | Beschreibung                    |
| ------------------ | --------- | ------------------------------- |
| `id`               | UUID      | PK                              |
| `title`            | String    | Titel der Sequenz               |
| `strand_id`        | UUID      | FK → CurriculumStrand           |
| `grade_band`       | GradeBand | Zieljahrgang                    |
| `goals`            | Text      | Übergeordnete Lernziele         |
| `sequence_order`   | Integer   | Reihenfolge innerhalb Schuljahr |
| `status`           | Enum      | `DRAFT`, `ACTIVE`, `ARCHIVED`   |
| `owner_teacher_id` | String    | Lehrkraft                       |
| `data_class`       | DataClass | `INTERNAL`                      |
| `created_at`       | Timestamp |                                 |
| `updated_at`       | Timestamp |                                 |
| `deleted_at`       | Timestamp | Soft-Delete                     |
| `version`          | Integer   |                                 |

**Relationen:**

- 1:n zu `Lesson`
- 1:n zu `Worksheet`

### Lesson

Einzelne Schulstunde mit Phasenbeschreibungen.

| Feld               | Typ       | Beschreibung                                   |
| ------------------ | --------- | ---------------------------------------------- |
| `id`               | UUID      | PK                                             |
| `unit_id`          | UUID      | FK → TeachingUnit                              |
| `objectives`       | Text      | Stundenziele                                   |
| `phase_plan`       | JSON      | Ablauf (z.B. Einstieg, Erarbeitung, Sicherung) |
| `owner_teacher_id` | String    |                                                |
| `data_class`       | DataClass | `INTERNAL`                                     |
| `created_at`       | Timestamp |                                                |
| `updated_at`       | Timestamp |                                                |
| `deleted_at`       | Timestamp |                                                |
| `version`          | Integer   |                                                |

**Relationen:**

- n:m zu `CurriculumNode` (Kompetenzzuordnung)

### Worksheet

Arbeitsblatt mit mehreren Aufgaben.

| Feld                | Typ       | Beschreibung                        |
| ------------------- | --------- | ----------------------------------- |
| `id`                | UUID      | PK                                  |
| `unit_id`           | UUID      | FK → TeachingUnit                   |
| `title`             | String    | Name des Arbeitsblatts              |
| `instructions`      | Text      | Allgemeine Anweisungen              |
| `layout_ref`        | String    | Verweis zu Designvorlage (optional) |
| `license`           | String    | Lizenz (z.B. CC-BY-SA)              |
| `derivation_source` | Text      | Ursprungsquelle (wenn adaptiert)    |
| `owner_teacher_id`  | String    |                                     |
| `data_class`        | DataClass | `INTERNAL`                          |
| `created_at`        | Timestamp |                                     |
| `updated_at`        | Timestamp |                                     |
| `deleted_at`        | Timestamp |                                     |
| `version`           | Integer   |                                     |

**Relationen:**

- 1:n zu `Task`
- n:m zu `SourceRef` (RAG-Quellen)

### Task

Einzelne Aufgabe / Übung.

| Feld                          | Typ       | Beschreibung                                                                         |
| ----------------------------- | --------- | ------------------------------------------------------------------------------------ |
| `id`                          | UUID      | PK                                                                                   |
| `worksheet_id`                | UUID      | FK → Worksheet                                                                       |
| `prompt`                      | Text      | Aufgabentext                                                                         |
| `task_type`                   | Enum      | `MULTIPLE_CHOICE`, `SHORT_ANSWER`, `ESSAY`, `STRUCTURED_REASONING`, `MEDIA_ANALYSIS` |
| `difficulty`                  | Enum      | `EASY`, `MEDIUM`, `HARD`                                                             |
| `expected_competence_node_id` | UUID      | FK → CurriculumNode (erwartete Kompetenz)                                            |
| `points`                      | Integer   | Maximale Punktzahl                                                                   |
| `owner_teacher_id`            | String    |                                                                                      |
| `data_class`                  | DataClass | `INTERNAL`                                                                           |
| `created_at`                  | Timestamp |                                                                                      |
| `updated_at`                  | Timestamp |                                                                                      |
| `deleted_at`                  | Timestamp |                                                                                      |
| `version`                     | Integer   |                                                                                      |

**Relationen:**

- 1:1 zu `ExpectationHorizon`

### ExpectationHorizon

Musterlösung und Bewertungskriterien einer Aufgabe.

| Feld                   | Typ       | Beschreibung                                   |
| ---------------------- | --------- | ---------------------------------------------- |
| `id`                   | UUID      | PK                                             |
| `task_id`              | UUID      | FK → Task                                      |
| `model_solution`       | Text      | Exemplarische Musterlösung                     |
| `acceptance_criteria`  | JSON      | Strukturierte Kriterien (z.B. Rubriken-Levels) |
| `partial_credit_rules` | JSON      | Regeln für Teilpunkte                          |
| `owner_teacher_id`     | String    |                                                |
| `data_class`           | DataClass | `INTERNAL`                                     |
| `created_at`           | Timestamp |                                                |
| `updated_at`           | Timestamp |                                                |
| `deleted_at`           | Timestamp |                                                |
| `version`              | Integer   |                                                |

### Rubric

Bewertungsmatrix (z.B. analytische oder holistische Rubrik).

| Feld               | Typ       | Beschreibung                                                |
| ------------------ | --------- | ----------------------------------------------------------- |
| `id`               | UUID      | PK                                                          |
| `scope`            | Enum      | `UNIT` (ganze Sequenz) oder `TASK` (einzelne Aufgabe)       |
| `target_id`        | UUID      | FK → TeachingUnit oder Task                                 |
| `scale_type`       | Enum      | `ANALYTIC` (Kriterien einzeln), `HOLISTIC` (Gesamteindruck) |
| `total_points`     | Integer   | Maximale Punktzahl                                          |
| `owner_teacher_id` | String    |                                                             |
| `data_class`       | DataClass | `INTERNAL`                                                  |
| `created_at`       | Timestamp |                                                             |
| `updated_at`       | Timestamp |                                                             |
| `deleted_at`       | Timestamp |                                                             |
| `version`          | Integer   |                                                             |

**Relationen:**

- 1:n zu `RubricCriterion`

### RubricCriterion

Einzelnes Bewertungskriterium (z.B. Kategorie + Deskriptoren).

| Feld                | Typ        | Beschreibung                                                                                                             |
| ------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| `id`                | UUID       | PK                                                                                                                       |
| `rubric_id`         | UUID       | FK → Rubric                                                                                                              |
| `label`             | String     | Kriteriumsname (z.B. „Religionskundliche Korrektheit")                                                                   |
| `weight`            | Float      | Gewichtung (z.B. 0.5 für 50%)                                                                                            |
| `level_descriptors` | JSON Array | Beschreibungen pro Level (z.B. `["Faktisch inkorrekt", "Teils korrekt", "Korrekt mit Nuancen", "Theologisch vertieft"]`) |
| `owner_teacher_id`  | String     |                                                                                                                          |
| `data_class`        | DataClass  | `INTERNAL`                                                                                                               |
| `created_at`        | Timestamp  |                                                                                                                          |
| `updated_at`        | Timestamp  |                                                                                                                          |
| `deleted_at`        | Timestamp  |                                                                                                                          |
| `version`           | Integer    |                                                                                                                          |

### StudentSubmission

Schülereingabe (Lösung zu einer Aufgabe).

| Feld               | Typ       | Beschreibung                                               |
| ------------------ | --------- | ---------------------------------------------------------- |
| `id`               | UUID      | PK                                                         |
| `task_id`          | UUID      | FK → Task                                                  |
| `pseudonym_id`     | String    | Verschlüsselte Schüler-ID (keine Klarnamen)                |
| `content_ref`      | String    | Verweis zu Inhalt (z.B. Object-Store-Pfad, formatabhängig) |
| `ocr_text_ref`     | String    | Verweis zu OCR-transkribiertem Text (falls Scan)           |
| `submitted_at`     | Timestamp | Einreichungszeitpunkt                                      |
| `owner_teacher_id` | String    | Lehrkraft (Klasse)                                         |
| `data_class`       | DataClass | `SENSITIVE_STUDENT`                                        |
| `created_at`       | Timestamp |                                                            |
| `updated_at`       | Timestamp |                                                            |
| `deleted_at`       | Timestamp |                                                            |
| `version`          | Integer   |                                                            |

**Datenpaket:** Klarnamen verlassen das System nicht. Nur `pseudonym_id` wird persistent gespeichert.

### CorrectionDraft

KI-generierter Korrekturvorschlag + menschliche Entscheidung.

| Feld               | Typ       | Beschreibung                                                                                                                 |
| ------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `id`               | UUID      | PK                                                                                                                           |
| `submission_id`    | UUID      | FK → StudentSubmission                                                                                                       |
| `rubric_id`        | UUID      | FK → Rubric (optionale Bindung)                                                                                              |
| `ai_suggestion`    | JSON      | KI-generierte Bewertung (Punkte, Kommentare, Verbesserungsvorschläge)                                                        |
| `provenance`       | JSON      | Herkunft der KI-Suggestion (Provider, Modell, Redaction-Flag, verwendete Quellen)                                            |
| `human_decision`   | JSON      | Von Lehrkraft bestätigte oder überschriebene Bewertung                                                                       |
| `decided_by`       | String    | User-ID der Lehrkraft (Pflicht bei Bestätigung)                                                                              |
| `decided_at`       | Timestamp | Zeitpunkt der Entscheidung (Pflicht bei Bestätigung)                                                                         |
| `status`           | Enum      | `DRAFT` (KI-Vorschlag, nicht bestätigt), `HUMAN_CONFIRMED` (Lehrkraft bestätigt), `OVERRIDDEN` (Lehrkraft hat überschrieben) |
| `owner_teacher_id` | String    |                                                                                                                              |
| `data_class`       | DataClass | `SENSITIVE_STUDENT`                                                                                                          |
| `created_at`       | Timestamp |                                                                                                                              |
| `updated_at`       | Timestamp |                                                                                                                              |
| `deleted_at`       | Timestamp |                                                                                                                              |
| `version`          | Integer   |                                                                                                                              |

**Kritische Invarianten:**

- `status = HUMAN_CONFIRMED` ⟹ `decided_by IS NOT NULL AND decided_at IS NOT NULL`
- `status = OVERRIDDEN` ⟹ `decided_by IS NOT NULL AND decided_at IS NOT NULL AND human_decision IS NOT NULL`
- Statusübergänge: `DRAFT` → `HUMAN_CONFIRMED` oder `DRAFT` → `OVERRIDDEN` (nur mit Lehrkraft-Input)
- **Menschliche Letztentscheidung als Datenmodell-Invariante:** Keine automatische Übernahme von KI-Vorschlägen.

### GenerationProvenance

Audit-Trail für jede KI-Generierung (Transparenz + Reproducibility).

| Feld                | Typ        | Beschreibung                                                                                                            |
| ------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| `id`                | UUID       | PK                                                                                                                      |
| `artifact_type`     | Enum       | `TEACHING_UNIT`, `LESSON`, `WORKSHEET`, `TASK`, `EXPECTATION_HORIZON`, `RUBRIC`, `CORRECTION_DRAFT`, `STUDENT_FEEDBACK` |
| `artifact_id`       | UUID       | FK zum generierten Artefakt                                                                                             |
| `provider`          | String     | LLM-Provider (z.B. „ollama", „anthropic")                                                                               |
| `model`             | String     | Modellname (z.B. „qwen2.5-14b", „claude-opus")                                                                          |
| `prompt_hash`       | String     | SHA256 des Prompts (zur Deduplication und Audit)                                                                        |
| `redaction_applied` | Boolean    | Ob Schülernamen / sensitive Daten vor LLM-Call gelöscht wurden                                                          |
| `source_refs`       | UUID Array | FK-Liste zu SourceRef (welche RAG-Quellen flossen ein)                                                                  |
| `confidence_state`  | JSON       | Confidence-Metadaten (z.B. Flaggen für unsichere Räume, theologische Nuance)                                            |
| `owner_teacher_id`  | String     | Lehrkraft                                                                                                               |
| `data_class`        | DataClass  | `INTERNAL` (Audit)                                                                                                      |
| `created_at`        | Timestamp  |                                                                                                                         |
| `updated_at`        | Timestamp  |                                                                                                                         |
| `deleted_at`        | Timestamp  |                                                                                                                         |
| `version`           | Integer    |                                                                                                                         |

### SourceRef

Verweis auf RAG-Quelle (Lehrplan, Handreichung, OER, etc.).

| Feld               | Typ       | Beschreibung                                                                           |
| ------------------ | --------- | -------------------------------------------------------------------------------------- |
| `id`               | UUID      | PK                                                                                     |
| `content_hash`     | String    | Fingerprint des Quellinhalts (Deduplication)                                           |
| `source_type`      | Enum      | `OFFICIAL_BINDING`, `OFFICIAL_GUIDANCE`, `OPEN_CURATED`, `USER_APPROVED`, `UNVERIFIED` |
| `title`            | String    | Quelltitel                                                                             |
| `uri`              | String    | Zitierbare URL oder DOI (optional)                                                     |
| `confidence`       | Float     | Vertrauenswert (0–1)                                                                   |
| `owner_teacher_id` | String    | Lehrkraft (nur bei `USER_APPROVED`)                                                    |
| `data_class`       | DataClass | `INTERNAL`                                                                             |
| `created_at`       | Timestamp |                                                                                        |
| `updated_at`       | Timestamp |                                                                                        |
| `deleted_at`       | Timestamp |                                                                                        |
| `version`          | Integer   |                                                                                        |

**Relationen:**

- n:m zu `Worksheet`
- n:m zu `GenerationProvenance`

## Datenklassifizierung

| Klasse              | Beispiele                                                 | Behandlung                                                                                                                                             | Retention                              |
| ------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| `PUBLIC`            | Lehrplan-Metadaten, Competence Framework                  | Minimal verschlüsselt; kann in Aggregaten/Benchmarks fließen                                                                                           | Permanent                              |
| `INTERNAL`          | Unterrichtsartefakte, Generierungs-Logs                   | Verschlüsselt in Transit; nur Lehrkraft + Admin sehen; kein Cloud-LLM ohne Freigabe                                                                    | Per Schuljahr + 2 Jahre Audit          |
| `PERSONAL_TEACHER`  | Notizen, Unterrichtsplanung, Metakognition der Lehrkraft  | Verschlüsselt, nur Lehrkraft sichtbar; DSGVO-Recht auf Vergessenwerden                                                                                 | Max. 5 Jahre oder auf Anfrage gelöscht |
| `SENSITIVE_STUDENT` | Schülerangaben, OCR-Transkripte, Bewertungen, Korrekturen | **Pseudonymisiert;** Klarnamen verlassen das System im Normalbetrieb nie; nur Lehrkraft+Schuladmin mit Audit-Log; Redaction-Schritt vor jedem LLM-Call | Per Schuljahr + 1 Jahr Archiv          |

## Schüssselinvarianten & Guardrails

### Konfessionstrennung

- Abfragen, die `subject+confessionContext` verbinden, sind atomar im Modell.
- Kein Cross-Strand-Retrieval für Religion/Ethik.

### Pseudonymisierung

- Alle Schülernamen → `pseudonym_id` (1:1 Mapping mit eindeutiger Schulung); Mapping existiert nur in SecureEnclave / HSM (Schulleitung).
- **Fail-Closed:** Falls Redaction-Schritt fehlschlägt, Generierung bricht ab; LLM-Call findet nie statt.

### Menschliche Letztentscheidung

- `CorrectionDraft.status` wechselt zu `HUMAN_CONFIRMED` / `OVERRIDDEN` **nur mit gültigem `decided_by` (Lehrkraft)**.
- Keine KI-Auto-Annahme; Lehrkraft muss explizit bestätigen oder überschreiben.

### Versionierung

- Alle Artefakte haben `version` (Optimistic Lock); Änderungen erzeugen neue Einträge, alte bleiben (Audit Trail).
- `CurriculumStrand` mit `supersedes_id` dokumentiert Lehrplan-Updates ohne Datenverlust.

### Audit & Provenance

- Jede Generierung wird in `GenerationProvenance` erfasst (Modell, Provider, Redaction-Flag, Quellen).
- Soft-Delete (`deleted_at IS NOT NULL`) behält Daten für Audit / Compliance.

### UI-Subsumption und RAG-Retrieval-Hinweis (M1→M2)

- `KONFESSIONSSENSIBEL_UEBERGREIFEND` wird in der UI-`Subject`-Union (die keinen dritten Konfessionsstrang kennt) unter `evangelische-religion` dargestellt (siehe `src/lib/db/repositories/mapping.ts`). RAG-Retrieval-Queries müssen daher `confession_context IN ('EVANGELISCH','KONFESSIONSSENSIBEL_UEBERGREIFEND')` verwenden, nie Gleichheit.
- Die Join-Tabelle `task_source_ref` (Task ↔ SourceRef) ist eine bewusste Erweiterung gegenüber dem ursprünglichen DATA_MODEL (Quellennachweis direkt auf Aufgabenebene); sie ist additiv und mit FK + UNIQUE abgesichert.

## Erweiterungen (nicht im MVP)

- **Benutzermodell:** Rollen (Lehrkraft, Admin, später Fachkonferenz, Schuladmin), Permissions.
- **Klassen- / Kursmodell:** Explizite Zuordnung Lehrkraft ↔ Schüler ↔ Klasse.
- **Feedback- / Notiz-Artefakte:** Student-facing Rückmeldungen (Korrektur-Kommentare, Lernfeedback).
- **Materiallibraries:** Wiederverwendbare Ressourcen-Vorlagen.
- **Multi-Provider-LLM:** Switching zwischen Ollama (lokal), OpenAI (mit Freigabe), Anthropic (mit Freigabe).

## Verweise

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Systemarchitektur und Komponenten
- [RAG_ARCHITECTURE.md](./RAG_ARCHITECTURE.md) — Retrieval, Ingestion, Vertrauensmodell
- [../rag/CITATION_STANDARD.md](../rag/CITATION_STANDARD.md) — Zitier-Konventionen und Quellenmanagement
- [../adr/0005-orm-drizzle.md](../adr/0005-orm-drizzle.md) — Migrations- und ORM-Strategie
- [../security/DATA_PROTECTION.md](../security/DATA_PROTECTION.md) — Verschlüsselung, Pseudonymisierung, Retention, DSGVO
