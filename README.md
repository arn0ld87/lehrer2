# Unterrichtsassistenz LSA

> Datenschutzsensibler, quellengebundener KI-Assistent für Lehrkräfte an Gesamtschulen und Gemeinschaftsschulen in Sachsen-Anhalt.

**Status:** Projektgrundlage und Architekturplanung
**Fächer im ersten Ausbauschritt:** Deutsch und Religion
**Jahrgänge:** 5 bis 12
**Betriebsprinzip:** Local-first, nachvollziehbar, quellengebunden

---

## Ziel

**Unterrichtsassistenz LSA** soll Lehrkräfte bei der Planung, Materialerstellung und Korrekturvorbereitung unterstützen, ohne fachliche oder pädagogische Verantwortung zu automatisieren.

Die Anwendung wird später unter anderem dabei helfen:

* Unterrichtsreihen und Einzelstunden lehrplanorientiert zu planen
* Arbeitsblätter, Aufgaben und Differenzierte Materialien zu entwerfen
* Erwartungshorizonte und Bewertungsraster vorzubereiten
* Schülerarbeiten strukturiert auszuwerten
* KI-generierte Ergebnisse mit nachvollziehbaren Quellen, Versionen und Fundstellen zu belegen

Das Projekt ist ausdrücklich **kein automatisches Benotungssystem**. Die finale Bewertung und jede pädagogische Entscheidung bleiben bei der Lehrkraft.

---

## Warum dieses Projekt?

Generische KI-Tools sind schnell, aber für schulische Arbeit oft zu ungenau, nicht nachvollziehbar und datenschutzrechtlich problematisch. Besonders unerquicklich wird es, sobald Lehrpläne, Schülerarbeiten oder personenbezogene Daten beteiligt sind.

Dieses Projekt setzt daher auf fünf verbindliche Grundsätze:

1. **Lehrplanbezug statt allgemeiner KI-Antworten**
   Curriculare Aussagen müssen sich auf überprüfbare Quellen stützen.

2. **Quellenpflicht statt Halluzinationen**
   Jede fachliche oder curriculare Aussage soll später Quelle, Version, Abschnitt oder Seite sowie Abrufdatum ausweisen.

3. **Local-first statt blindem Cloud-Zwang**
   Lokale oder selbst gehostete Komponenten sind der Standard. Externe KI-Anbieter bleiben optional und kontrollierbar.

4. **Datensparsamkeit statt Volltext-Upload**
   Schülerdaten werden pseudonymisiert, minimiert und vor externen KI-Anfragen technisch reduziert.

5. **Menschliche Entscheidung statt automatischer Bewertung**
   Die Anwendung liefert Vorschläge, Begründungen und Unsicherheiten. Sie vergibt keine verbindlichen Noten.

---

## Geplanter Funktionsumfang

### 1. Unterrichtsplanung

* Lehrplanorientierte Unterrichtsreihen
* Stundenentwürfe mit Lernzielen, Kompetenzen und Methoden
* Differenzierung nach Niveau, Sozialform und Zeitbudget
* Quellenbelegte Vorschläge für Inhalte und Kompetenzen
* Exportierbare Planungen für Dokumentation und Weiterarbeit

### 2. Arbeitsblatt- und Aufgabenassistent

* Arbeitsblätter für Deutsch und Religion
* Aufgaben in unterschiedlichen Anforderungsniveaus
* Hilfekarten, Operatoren, Musterlösungen und Erwartungshorizonte
* Anpassung an Klassenstufe, Bildungsgang und Fachkontext
* DOCX- und PDF-Export als späterer Ausbauschritt

### 3. Quellen-RAG

* Verwaltung und Versionierung freigegebener Quellen
* Recherche nach offiziellen Lehrplänen und Handreichungen
* Kontrollierte Ingestion statt unkontrolliertem Web-Scraping
* Retrieval mit Fach-, Schulform-, Klassen- und Versionsfiltern
* Quellenangaben bis auf Seiten- oder Abschnittsebene

### 4. Korrekturassistenz

* Strukturierte Auswertung anhand definierter Bewertungsraster
* Begründete Punktvorschläge statt automatischer Endnoten
* Feedbackentwürfe mit Stärken, Schwächen und Verbesserungsimpulsen
* Kennzeichnung von Unsicherheiten und fehlenden Nachweisen
* Pseudonymisierung und Redaction vor KI-Verarbeitung

### 5. Administration und Governance

* Rollenmodell für Lehrkräfte und Administratoren
* Auditierbare Quellenfreigabe
* Versionshistorie für Lehrpläne und Materialien
* Datenlösch- und Aufbewahrungskonzept
* Kontrollierte Provider- und Modellkonfiguration

---

## Zielgruppe und Geltungsbereich

| Bereich           | Startumfang                                               |
| ----------------- | --------------------------------------------------------- |
| Bundesland        | Sachsen-Anhalt                                            |
| Schulformen       | Gesamtschule und Gemeinschaftsschule                      |
| Klassenstufen     | 5 bis 12                                                  |
| Fächer            | Deutsch, Religion                                         |
| Religionskontexte | evangelisch, katholisch, konfessionssensibel/übergreifend |
| Datenverarbeitung | Local-first, datensparsam, nachvollziehbar                |

Für die Sekundarstufe I und II werden Lehrpläne, Bildungswege und Kompetenzmodelle getrennt modelliert. Religion wird nicht pauschal behandelt: evangelischer, katholischer und konfessionssensibler Unterricht müssen fachlich und curricular unterscheidbar bleiben.

---

## Nicht-Ziele des MVP

Der erste produktive Ausbauschritt umfasst bewusst **nicht**:

* automatische Endnotenvergabe
* öffentliche Schülerkonten oder eine Schülerplattform
* unkontrollierte Websuche ohne Quellenprüfung
* automatische Übernahme von Quellen mit unklarer Lizenz
* Upload echter Schülerarbeiten an externe KI-Anbieter
* Scraping urheberrechtlich geschützter Schulbücher oder Verlagsmaterialien

---

## Architekturüberblick

Die Anwendung wird zunächst als modularer Monolith geplant. Das reduziert Betriebsaufwand, Komplexität und Fehlerflächen, die sich bei frühen Microservice-Landschaften bekanntermaßen vermehren, weil Menschen offenbar gerne verteilte Probleme erzeugen.

```text
┌─────────────────────────────────────────────────────────────────┐
│                           Web-App                               │
│                  Next.js · TypeScript · Tailwind                │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                        Application Layer                        │
│ Unterrichtsplanung · Arbeitsblätter · Korrekturassistenz · Auth │
└───────────────┬───────────────────────┬─────────────────────────┘
                │                       │
┌───────────────▼──────────────┐ ┌──────▼─────────────────────────┐
│        PostgreSQL            │ │         Qdrant                 │
│ Metadaten · Nutzer · Audit   │ │ Vektorsuche · Chunk-Metadaten │
└───────────────┬──────────────┘ └──────┬─────────────────────────┘
                │                       │
┌───────────────▼───────────────────────▼─────────────────────────┐
│                        RAG- und Job-Layer                       │
│ Quellenprüfung · Ingestion · Extraktion · Redaction · Retrieval │
└───────────────┬─────────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────────┐
│              LLM-Provider-Abstraktion                           │
│       Ollama · lokale OpenAI-kompatible APIs · Freigaben         │
└─────────────────────────────────────────────────────────────────┘
```

### Geplanter Stack

| Bereich           | Technologie                                  | Zweck                                    |
| ----------------- | -------------------------------------------- | ---------------------------------------- |
| Frontend          | Next.js App Router, TypeScript, Tailwind CSS | Web-Anwendung                            |
| Relationale Daten | PostgreSQL                                   | Nutzer-, Projekt-, Audit- und Metadaten  |
| Vektorsuche       | Qdrant                                       | Quellen-Retrieval und semantische Suche  |
| Dokumente         | S3-kompatibler Storage, lokal MinIO          | Originaldateien und Exporte              |
| Hintergrundjobs   | Redis + BullMQ                               | Ingestion, OCR, Chunking, Re-Indexierung |
| Lokale KI         | Ollama / OpenAI-kompatible lokale APIs       | Datensparsamer Standardbetrieb           |
| Qualität          | ESLint, Prettier, TypeScript strict, Tests   | Reproduzierbarkeit und Stabilität        |
| Betrieb           | Docker Compose                               | Lokale Entwicklung und Self-Hosting      |

Die konkrete Auswahl von ORM, Auth-Lösung und Export-Stack wird über dokumentierte Architecture Decision Records entschieden.

---

## Quellen- und RAG-Governance

Der RAG-Bestand darf nicht zu einem unkontrollierten Dokumentmüllhaufen werden. Jede Quelle erhält eine Vertrauensstufe, Metadaten und einen nachvollziehbaren Freigabestatus.

### Vertrauensstufen

| Stufe               | Bedeutung                                                                | Produktiver RAG-Einsatz |
| ------------------- | ------------------------------------------------------------------------ | ----------------------- |
| `OFFICIAL_BINDING`  | Amtliche Lehrpläne, Rechtsquellen, verbindliche Curricula                | Ja                      |
| `OFFICIAL_GUIDANCE` | LISA-/Ministeriums-Handreichungen, offizielle Aufgaben und Publikationen | Ja, nach Prüfung        |
| `OPEN_CURATED`      | Offen lizenzierte und redaktionell geprüfte Bildungsressourcen           | Ja, nach Freigabe       |
| `USER_APPROVED`     | Von Schule oder Lehrkraft hochgeladene und freigegebene Materialien      | Ja, mandantenbezogen    |
| `UNVERIFIED`        | Recherchekandidaten ohne abgeschlossene Prüfung                          | Nein                    |

### RAG-Lebenszyklus

```text
Quelle entdecken
    ↓
Lizenz, Aktualität und Relevanz prüfen
    ↓
Quelle registrieren
    ↓
Freigabe durch verantwortliche Person
    ↓
Ingestion und Metadatenanreicherung
    ↓
Chunking und Indexierung
    ↓
Retrieval mit Quellenangaben
    ↓
Evaluation, Versionskontrolle, Widerruf oder Löschung
```

Jeder spätere RAG-Chunk soll mindestens diese Informationen tragen:

```yaml
source_id:
title:
publisher:
official_url:
trust_level:
subject:
school_form:
grade_range:
version_or_date:
license_or_terms:
retrieved_at:
content_hash:
page_or_section:
ingestion_status:
```

---

## Datenschutz und Sicherheit

Schülerarbeiten und Leistungsbewertungen sind besonders schützenswert. Deshalb gilt für die spätere Umsetzung:

* Keine echten Schülernamen an externe KI-Provider.
* Pseudonymisierung und Redaction vor jeder KI-Anfrage.
* Cloud-LLMs nur bei dokumentierter Freigabe, Rechtsgrundlage, Auftragsverarbeitung und expliziter Konfiguration.
* Lokale Modelle als Standardmodus für sensible Daten.
* Rollenmodell, Mandantentrennung und Audit Logs von Beginn an mitplanen.
* Verschlüsselte Speicherung, Secret Management und dokumentierte Löschprozesse.
* Menschliche Finalentscheidung bei jeder Korrektur und Bewertung.

---

## Roadmap

| Milestone                           | Schwerpunkt                                                   |
| ----------------------------------- | ------------------------------------------------------------- |
| **M0 – Foundations & Governance**   | Produktgrundlage, Quellenpolicy, Datenschutz, Architektur, CI |
| **M1 – Unterrichtsplanung MVP**     | Planungsassistent, Arbeitsblattkonzept, Bewertungsraster      |
| **M2 – Quellen-RAG mit Nachweisen** | Quellenverwaltung, Ingestion, Retrieval, Evaluation           |
| **M3 – Korrekturassistenz MVP**     | Pseudonymisierung, Feedback, Korrekturworkflow                |
| **M4 – Security, Pilot & Betrieb**  | Rollen, Audit, Backups, Pilotierung, Security-Review          |

Der vollständige Arbeitsplan steht in [`PLAN.md`](PLAN.md).

---

## Lokale Entwicklung

> Die Anwendung ist in dieser Projektphase noch nicht implementiert. Die folgenden Schritte beschreiben die vorgesehene Entwicklungsumgebung, nicht einen bereits fertigen Produktstart.

### Voraussetzungen

* Git
* Docker Engine mit Docker Compose
* Node.js LTS
* `pnpm`
* GitHub CLI (`gh`)
* optional: Ollama für lokale Modelle

```bash
git clone https://github.com/DEIN-GITHUB-NAME/unterrichtsassistenz-lsa.git
cd unterrichtsassistenz-lsa

cp .env.example .env
pnpm install
docker compose up -d
```

### Qualität prüfen

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
```

---

## Beitragen

1. Keine unklar lizenzierten Materialien oder Schulbuchkopien einchecken.
2. Keine echten Schülerdaten, personenbezogenen Testdaten oder API-Schlüssel committen.
3. Änderungen an Quellen, Datenschutz oder Bewertungslogik nachvollziehbar dokumentieren.
4. Neue Features mit überprüfbaren Akzeptanzkriterien und Tests anlegen.
5. Sicherheitsrelevante Änderungen als `type: security` Issue dokumentieren.

```bash
git diff --check
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
```

---

## Lizenz

Die Lizenzentscheidung ist noch offen und wird in [`LICENSE-DECISION.md`](LICENSE-DECISION.md) dokumentiert.

Die Repository-Lizenz gilt nicht automatisch für eingebundene Lehrpläne, Handreichungen, Quellen oder Nutzermaterialien. Diese behalten jeweils ihre eigenen Nutzungsbedingungen.

---

## Projektstatus

| Bereich               | Status                   |
| --------------------- | ------------------------ |
| Produktvision         | geplant                  |
| Architektur           | geplant                  |
| Quellen-Governance    | geplant                  |
| Datenschutzkonzept    | geplant                  |
| GitHub-Roadmap        | geplant                  |
| RAG-Ingestion         | noch nicht implementiert |
| Lehrplanimport        | noch nicht implementiert |
| Arbeitsblattgenerator | noch nicht implementiert |
| Korrekturassistenz    | noch nicht implementiert |
| Pilotbetrieb          | noch nicht gestartet     |

---

## Nächste Schritte

1. Offizielle Lehrplan- und Handreichungsquellen für Deutsch und Religion in eine prüfbare Quellenregistry aufnehmen.
2. Curriculummodell für Schulform, Klassenstufe, Fach, Konfession und Gültigkeitszeitraum festlegen.
3. MVP-Workflow für lehrplanorientierte Unterrichtsplanung mit Quellenpflicht implementierbar spezifizieren.

