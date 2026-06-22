# Acceptance Criteria

Überprüfbare Kriterien für MVP-Funktionsbereiche. Alle Kriterien müssen erfüllt sein, bevor MVP in Pilotschule geht.

## Funktionsbereich: Unterrichtsplanung

- [ ] System akzeptiert Eingabe (Klassenstufe, Fach: Deutsch/Religion, Lehrplanbereich)
- [ ] Falls Religion: Konfessions-Scope-Auswahlfeld (evangelisch/katholisch/übergreifend/Ethik) ist Pflicht; Abfrage wird blockiert, wenn nicht gesetzt
- [ ] RAG-Abfrage erfolgt ausschließlich auf OFFICIAL_BINDING + OFFICIAL_GUIDANCE Quellen; UNVERIFIED Quellen sind ausgeschlossen
- [ ] Stundenentwurf wird generiert mit Struktur: Lernziele (SMART), Methoden, Zeitbudget, Material-Checkliste
- [ ] **Quellenkette sichtbar**: Jede Empfehlung hat Fußnote mit Lehrplan-Kapitel/Schulbuch-Referenz oder explizitem »Quelle: Sächsisch-anhaltinischer Lehrplan § X.Y«
- [ ] Lehrkraft kann Stundenentwurf editieren (Titel, Lernziele, Methoden) in der Web-UI
- [ ] Export als DOCX mit Quellenangaben ist möglich
- [ ] Offline-Szenario: Falls RAG-Server kurzzeitig ausfällt, gibt System verständliche Fehlermeldung (»Quellenbibliothek momentan nicht verfügbar«) statt Crash
- [ ] Audit-Log protokolliert: Zeitstempel, Lehrkraft-ID, Klassenstufe, Lehrplanbereich, verwendete Quellen, keine Schülernamen

---

## Funktionsbereich: Aufgabengenerierung und -export

- [ ] Eingabeform akzeptiert: Titel, Klassenstufe, Fach (Deutsch/Religion), Zielkompetenz, Differenzierungsstufen (Basis/Erweiterung/Förder)
- [ ] Falls Religion: Konfessions-Scope-Feld ist Pflicht; System warnt aktiv vor Vermischung (»Sie haben ‚übergreifend' gewählt — System wird evangelische und katholische Perspektiven kombinieren. Fortfahren?«)
- [ ] Optional-Upload von Quellenmaterial (PDF/TXT):
  - [ ] Vor Upload: Redaction-Vorwarnung scannt auf Schülernamen aus konfigurierter Klassenliste
  - [ ] Falls erkannt: »Warnung: 5 Schülernamen erkannt. Diese werden bei Indizierung maskiert. OK?«
- [ ] Aufgabengenerierung läuft mit Ollama (Standard); kein Cloud-LLM ohne expliziter »Cloud-Freigabe vorhanden«-Check
- [ ] Output: Basis-, Erweiterungs-, Förder-Aufgabe jeweils als separater Block
- [ ] **Quellenangaben im Output**:
  - [ ] Falls hochgeladenem Material: »Basiert auf hochgeladenem Material«
  - [ ] Implizit: Lehrplan + Fachstandards sind erwähnt
- [ ] Lehrkraft sieht Kriterien-Matrix (implizit): »Diese Aufgabe überprüft Kompetenz X (Analyse / Synthese / …)«
- [ ] Export als DOCX/PDF mit Quellenangaben unten auf Seite
- [ ] Audit-Log: Generierung, Klassenstufe, Fach, Lehrplanbereich, hochgeladene Dateien (Name+Größe, nicht Inhalt), Export-Format

---

## Funktionsbereich: Korrekturassistenz

### Pseudonymisierung vor KI-Call

- [ ] Lehrkraft wählt Einzeldatei oder Batch-Upload (ZIP)
- [ ] System scannt Text auf Schülernamen (mittels konfigurierter Klassenliste, RegEx für »Vorname Nachname«-Muster)
- [ ] Erkannte Namen werden markiert und in Vorschau gezeigt: »Erkannte 3 Schülernamen: [Anna Schmidt] → [SCHÜLER_001], [Bora Müller] → [SCHÜLER_002], [Chris Neumann] → [SCHÜLER_003]«
- [ ] Lehrkraft muss explizit bestätigen: Checkbox »Ich bestätige, dass die Maskierung korrekt ist«
- [ ] Falls Lehrkraft Fehler erkennt (z.B. Name wurde übersehen), kann sie manuell weitere Wörter hinzufügen
- [ ] Redaction-Ergebnis wird in Audit-Log festgehalten: »3 Schülernamen maskiert; Lehrkraft hat Maskierung bestätigt«

### KI-Feedback-Generierung

- [ ] Redacted Text wird an LLM gesendet (Standard: lokal Ollama)
- [ ] Prompt ist strukturiert:
  - Kriterium (fachliche Korrektheit, Textstruktur, Argumentation, etc.)
  - Quelle/Referenz (»nach Lehrplan Deutsch § 4.2«)
  - Abfrage-Struktur: »[1] Was ist fachlich korrekt, [2] Was fehlt/ist ungenau, [3] Lösungshinweis mit Beleg, [4] Unsicherheitsgrad«
- [ ] Output hat folgende Struktur sichtbar:

  ```
  KRITERIUM: [Name]
  ✓ Erkannt: [positive Aspekte]
  ✗ Fehlend/Ungenau: [Lücken]

  LÖSUNGSHINWEIS: [mit Quellenreferenz]
  UNSICHERHEIT: High/Medium/Low [Begründung]
  ```

- [ ] Cloud-LLM ist OFF per Default; Checkbox »Cloud-LLM verwenden?« zeigt Warnung: »Redacted Daten werden an externe API übertragen. CloudReleaseGrant erforderlich. [Freigabe überprüfen]«

### Menschliche Letztentscheidung

- [ ] Lehrkraft sieht deutlich: »VORSCHLAG DER KI (unten) / IHRE ENDGÜLTIGE FASSUNG (oben)«
- [ ] Lehrkraft kann KI-Vorschlag:
  - [ ] Wortgleich annehmen
  - [ ] Kürzen/ergänzen
  - [ ] Komplett ablehnen (»Passt nicht, meine Rückmeldung: …«)
  - [ ] Unsicherheitsgrad anpassen (z.B. High → Low mit Begründung)
- [ ] Finale Version wird gespeichert mit Metadaten: »Manuell bearbeitet: ja, Änderung: Kürzung«
- [ ] Schülername bleibt lokal; Schuladmin/Lehrkraft sehen Klarname, Cloud-Export (falls aktiviert) hat weiterhin Pseudonym [SCHÜLER_ID]

### Audit & Datenschutz

- [ ] Audit-Log protokolliert:
  - [ ] Zeitstempel, Lehrkraft-ID
  - [ ] »Korrekturassistenz aufgerufen«
  - [ ] Batch-Größe (z.B. »3 Texte«)
  - [ ] Redaction-Ergebnis (»3 Schülernamen maskiert«)
  - [ ] LLM-Wahl (»lokal Ollama« | »Cloud-LLM [mit Freigabe]«)
  - [ ] Keine Schülertexte, keine Feedback-Freitexte, keine Klassenlisten
- [ ] Sicherungsziel: Original-Datei (redacted) + KI-Vorschlag + finale Lehrkraft-Version in schulinterner DB (PostgreSQL), nicht exportiert ohne Lehrkraft-Zustimmung

---

## Funktionsbereich: RAG und Quellenverwaltung

### Trust-Level-Klassifikation

- [ ] Lehrplan (sächsisch-anhaltinisch, offizielle Fassung): Trust-Level **OFFICIAL_BINDING** ist hartcodiert
- [ ] Schulbuch-Metadaten (von Schule hochgeladen, genehmigt): **OFFICIAL_GUIDANCE**
- [ ] Arbeitsblatt-Sammlungen (von Lehrkraft hochgeladen, von Schuladmin genehmigt): **OPEN_CURATED**
- [ ] Arbeitsblatt (von einzelner Lehrkraft ohne Genehmigung hochgeladen): **USER_APPROVED**
- [ ] Internet-Schnipsel, ungefiltert: **UNVERIFIED** (darf nicht in RAG produktiv eingespielt werden)
- [ ] RAG-Query-Response zeigt Trust-Level: »Quelle: Lehrplan Biologie (OFFICIAL_BINDING) — zuverlässig«

### Quellenredaction vor RAG

- [ ] Benutzer-Query: »Aufgaben zu Klimawandel für Klasse 8 Deutsch«
- [ ] System erkennt: Klassenstufe+Fach sind PUBLIC, keine Schülernamen erwähnt
- [ ] Query wird an RAG gestellt unverändert
- [ ] Benutzer-Query: »Anna Schmidts Rede zur Deutschen Einheit für Deutsch-LK«
  - [ ] System erkennt: Schülername »Anna Schmidt« in Query
  - [ ] Redaction: Query wird zu »[SCHÜLER_001]s Rede zur Deutschen Einheit für Deutsch-LK« oder abgelehnt mit Hinweis »Query enthält Schülernamen — bitte wiederholen ohne Namensnennungen«

### Quellenangabe im Export

- [ ] Jede generierte Aufgabe / Stundenplanung hat am Ende Sektion »Quellen«
- [ ] Format: »1. Sächsisch-anhaltinischer Lehrplan Deutsch Klasse 8, § 3.2.1; 2. Schulbuch ‚Deutsch 8' (Klett), Seite 45–50; 3. Materialsammlung ‚Argumentation' (schulintern, genehmigt)«
- [ ] Lehrkraft kann weitere Quellen manuell hinzufügen im Export

---

## Funktionsbereich: Administration & Freigaben

### User-Rollen

- [ ] System kennt Rollen: **Lehrkraft**, **Schuladmin**
- [ ] Lehrkraft: Darf Planungen, Aufgaben, Korrekturassistenz nutzen; darf keine Adminoberfläche sehen
- [ ] Schuladmin: Sieht Audit-Log, verwaltet CloudReleaseGrant, verwaltet RAG-Quellen (upload, Trust-Level setzen)

### CloudReleaseGrant-Flow

- [ ] Lehrkraft aktiviert Cloud-LLM (z.B. »Claude API wäre schneller«)
- [ ] System zeigt: »Cloud-LLM ist nicht freigegeben. Eine Anfrage wird an Schuladmin gesendet: ‚Lehrkraft XY möchte Cloud-LLM verwenden für [Aufgabengenerierung | Korrekturassistenz]. CloudReleaseGrant erforderlich.'«
- [ ] Schuladmin erhält Benachrichtigung (E-Mail, Dashboard-Hinweis)
- [ ] Schuladmin prüft Anfrage, setzt CloudReleaseGrant (»gültig bis [Datum]«) oder lehnt ab
- [ ] Falls genehmigt: Lehrkraft erhält Mitteilung und kann Cloud-LLM nutzen; Audit-Log zeigt »Cloud-LLM mit Freigabe verwendet«
- [ ] Falls abgelehnt: Lehrkraft wird benachrichtigt; Cloud-Optionen bleiben deaktiviert

### Audit-Log

- [ ] Schuladmin-Dashboard zeigt Abfrage-Statistiken (aggregiert, keine Schülernamen): »43 Planungen diese Woche, 12 Aufgabengenerierungen, 156 Korrekturcalls«
- [ ] Detailliertes Log pro Abfrage: Lehrkraft-ID, Zeitstempel, Funktion, Quellen, Cloud-Nutzung (ja/nein)
- [ ] Kein Logging von Schülertexten, kein Logging von Klarnamen (außer Lehrkraft-ID)
- [ ] Export-Option für Audit-Report (CSV) mit Datenschutz-Compliance-Statement

---

## Funktionsbereich: Konfessions-Scope (Religion)

- [ ] Eingabeformular für Religion hat Pflichtfeld »Konfessions-Scope«: evangelisch | katholisch | übergreifend | Ethik
- [ ] Wenn »evangelisch« gewählt:
  - [ ] RAG filtert UNBEABSICHTLICH katholische Inhalte heraus
  - [ ] Falls katholisches Material unbeabsichtigt gefunden: System warnt »Warnung: Quelle ist katholisch-gewidmet. Ihrer Auswahl ‚evangelisch' entspricht das nicht. Quelle ausschließen?«
- [ ] Wenn »übergreifend« gewählt:
  - [ ] System zeigt Warnung: »Sie haben ‚übergreifend' gewählt. System wird evangelische + katholische + ggf. islamische Perspektiven kombinieren. Passt das zu Ihrem Unterricht?«
  - [ ] Output zeigt Perspektive pro Block: »(evangelische Sicht) …«, »(katholische Sicht) …«
- [ ] Wenn »Ethik« gewählt:
  - [ ] RAG filtert auf religionskundliche, säkulare Perspektiven
  - [ ] Keine theologischen Dogmen; stattdessen »Religionen und ihre Positionen zu Ethik« als Fokus
- [ ] Quellen werden mit Konfessions-Tag versehen: »[Evangelische Perspektive]«, »[Säkular]«, »[Übergreifend]« sichtbar im Output

---

## Cross-Cutting: Datenschutz-Compliance

- [ ] Schülernamen verlassen das System lokal nie — nur Pseudonyme in Logs
- [ ] Cloud-Calls: Nur mit expliziter CloudReleaseGrant; Audit-Trail dokumentiert das
- [ ] Redaction-Fehler: Falls System Schülernamen übersehen könnte, wird Abfrage blockiert und Admin benachrichtigt (»manuelles Review erforderlich«)
- [ ] Fail-Closed-Prinzip: Im Zweifelsfall eher »nicht verfügbar« als »eventuell ein Datenschutz-Leck«
- [ ] Netzwerk-Isolation (optional): Falls Schulnetzwerk lokal Ollama hostet, erfolgen keine LLM-Inferenzen über Internet (außer Cloud-LLM mit Freigabe)

---

## Cross-Cutting: Quellenpflicht

- [ ] Keine generierte Antwort ohne Quellenreferenz
- [ ] Falls System unsicher ist (Quelle unklar): »Quelle kann nicht eindeutig zugeordnet werden — manuelles Review erforderlich«
- [ ] Lehrkraft kann Quellenangabe editieren/ergänzen vor Export

---

Siehe [../../PLAN.md](../../PLAN.md) für Entwicklungsplan und Priorisierungsreihenfolge.
