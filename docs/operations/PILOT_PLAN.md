# Pilotplan (Synthetische Testphase)

Dieser Plan beschreibt die Durchführung der Pilotphase für die Unterrichtsassistenz LSA. Um maximale Datensicherheit zu gewährleisten, wird diese Phase ausschließlich mit **synthetischen Testdaten** durchgeführt.

---

## 1. Ziele und Scope

### Ziele

- Validierung der Kernfunktionen (Planung, Aufgabengenerierung, Korrekturassistenz) unter realitätsnahen Bedingungen.
- Überprüfung der RAG-Qualität und Zitationsgenauigkeit.
- Testen des Feedback-Workflows zwischen Lehrkräften und Entwicklungsteam.
- Sicherstellung der DSGVO-Konformität durch Verzicht auf Echtdaten.

### Scope

- **Teilnehmende:** Eine begrenzte Gruppe von Test-Lehrkräften (Pilot-Schulen).
- **Fächer:** Deutsch und Religion (evangelisch/katholisch/übergreifend).
- **Datenbasis:** Ausschließlich synthetische Profile und anonymisierte Lehrpläne/Materialien.
- **Dauer:** Voraussichtlich 4-6 Wochen.

---

## 2. Synthetische Testdaten (Mock-Factories)

Um den Schutz personenbezogener Daten (Art. 9 DSGVO) zu garantieren, werden alle für den Test notwendigen Entitäten synthetisch erzeugt.

### 2.1 Lehrer-Profile

- **Datenfelder:** `pseudonym_teacher_id`, `fach_fokus` (Deutsch/Religion), `schulform`, `konfession` (falls relevant).
- **Generierung:** Zufällige Zuweisung von Fachkombinationen ohne Bezug zu realen Personalnummern.

### 2.2 Schüler-Profile

- **Datenfelder:** `pseudonym_student_id`, `jahrgangsstufe` (5-12), `bildungsgang`.
- **Anforderung:** Keine Namen, Geburtsdaten oder Wohnorte. Nur strukturelle Merkmale für die Differenzierung.

### 2.3 Schülerarbeiten (Submissions)

- **Typen:**
  - Synthetisch generierte Aufsätze (LLM-erzeugt mit gezielten Fehlern).
  - Anonymisierte, "umgeschriebene" Beispielarbeiten (ohne jeglichen Personenbezug).
- **Mock-Szenarien:**
  - "Der perfekte Text" (Benchmark).
  - "Text mit vielen Rechtschreibfehlern" (Test für Korrektur-Modul).
  - "Themenverfehlung" (Test für inhaltliche RAG-Prüfung).

### 2.4 Klassenlisten

- Zuordnung von `pseudonym_teacher_id` zu einer Liste von `pseudonym_student_id`.

---

## 3. Feedbackprozess

Der Feedbackprozess ist zweistufig aufgebaut, um sowohl technische Bugs als auch pädagogische Qualität zu erfassen.

### 3.1 Feedback-Kanäle

- **In-App Feedback:** "Daumen hoch/runter" Button direkt an jeder KI-Antwort mit optionalem Textfeld.
- **Strukturierte Befragung:** Wöchentlicher Kurz-Fragebogen (z. B. via schulinternem Tool) zu Usability und fachlicher Korrektheit.
- **Bug-Reporting:** Zentrales Ticket-System für technische Fehler (ohne Upload von sensiblen Inhalten).

### 3.2 Feedback-Typen

| Typ             | Fokus                                | Beispiel                                          |
| :-------------- | :----------------------------------- | :------------------------------------------------ |
| **Technisch**   | Systemstabilität, Latenz             | "Seite lädt > 10 Sekunden"                        |
| **Fachlich**    | RAG-Genauigkeit, Lehrplanbezug       | "Zitierte Lehrplanstelle passt nicht zur Aufgabe" |
| **Pädagogisch** | Didaktischer Nutzen, Differenzierung | "Förder-Aufgaben sind zu komplex für Stufe 6"     |
| **Datenschutz** | Redaction-Qualität                   | "Pseudonymisierung hat Wort XY nicht erkannt"     |

### 3.3 Feedback-Schleife

1. **Erfassung:** Feedback wird anonymisiert gesammelt.
2. **Analyse:** Wöchentliches Review-Meeting (Devs + Fachexperten).
3. **Priorisierung:** Einordnung in Product Backlog (Bugfix vs. Feature).
4. **Closing the Loop:** Information an die Tester über behobene Fehler im nächsten Release-Cycle.

---

## 4. Go/No-Go-Kriterien

Vor dem Übergang von der Pilotphase in den (eingeschränkten) Wirkbetrieb müssen folgende Kriterien erfüllt sein:

### 4.1 Sicherheit & Datenschutz (Prio 1)

- [ ] **Redaction-Rate:** 100% der definierten PII-Muster in synthetischen Tests werden zuverlässig erkannt.
- [ ] **Fail-Closed:** Das System bricht bei Redaction-Fehlern nachweislich ab.
- [ ] **Audit-Log:** Alle relevanten Ereignisse werden ohne PII-Inhalte protokolliert.

### 4.2 Fachliche Qualität

- [ ] **Zitations-Genauigkeit:** > 90% der generierten Quellenangaben sind korrekt und existieren im RAG-Index.
- [ ] **Halluzinations-Rate:** < 5% ungestützte Behauptungen in den Golden Questions.
- [ ] **Konfessions-Treue:** Keine Vermischung von evangelischen/katholischen Inhalten bei expliziter Wahl.

### 4.3 Performance & Usability

- [ ] **Latenz:** P95 der Antwortzeit (lokales Modell) liegt unter 10 Sekunden.
- [ ] **UX-Zufriedenheit:** Durchschnittliche Bewertung der Pilot-Lehrkräfte > 3.5/5 Sternen.
- [ ] **Export:** Fehlerfreie Generierung von DOCX-Dateien mit allen Quellenangaben.

### 4.4 Rechtlich/Organisatorisch

- [ ] **CloudReleaseGrant:** Prozess für externe LLM-Nutzung ist technisch und organisatorisch abgenommen.
- [ ] **Löschkonzept:** Automatisierte Löschung nach 12 Monaten funktioniert im Testsystem.

---

## 5. Exit-Strategie

Sollten kritische Sicherheitslücken (z. B. Umgehung des Guards) oder massive fachliche Mängel (z. B. systematische Falschzitate) auftreten, wird der Pilot abgebrochen und das System in den Wartungsmodus versetzt, bis eine grundlegende Architekturänderung erfolgt.

---

**Status:** In Planung (M4)
**Verantwortlich:** Projektleitung / Architektur-Team
