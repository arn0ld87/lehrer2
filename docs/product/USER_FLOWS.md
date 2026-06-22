# User Flows

## Flow 1: Lehrplangebundene Unterrichtsplanung

**Rolle**: Lehrkraft (Deutsch oder Religion)  
**Ziel**: Lehrplan-konforme Stundenplanung mit quellengestützten Materialempfehlungen  
**Datenschutz-Touchpoints**: Keine direkten Schülerdaten; Klassenstufe+Lehrplanbereich sind PUBLIC

### Schritte

1. Lehrkraft öffnet LSA, navigiert zu »Unterrichtsplanung«
2. Wählt aus:
   - Klassenstufe (z.B. Klasse 7)
   - Fach (Deutsch | Religion)
   - Lehrplanbereich (z.B. »Deutsch: Textanalyse Epik« oder »Evangelische Religion: Reformationsgeschichte«)
   - Falls Religion: Konfessions-Scope (evangelisch | katholisch | übergreifend | Ethik) — Warnung vor Vermischung bei übergreifender Abfrage
3. LSA fragt ab: »Weitere Kontextinformationen? (z.B. Unterrichtsumfang, Zusatzschwerpunkt)«
4. RAG-Abfrage erfolgt auf OFFICIAL_BINDING Quellen:
   - Sächsisch-anhaltinischer Lehrplan (offizielle Fassung)
   - Optional: Schulbuch-Index der Schule (OFFICIAL_GUIDANCE)
   - Keine UNVERIFIED Quellen in der RAG-Response
5. System generiert:
   - Stundenverlauf mit Lernzielen (SMART-Format)
   - Methodische Vorschläge (Quellenreferenz: »Siehe Lehrplan § 3.2.1: Dialogische Unterrichtsmethoden«)
   - Material-Checkliste (Arbeitsblätter, Medien, Zeitbudget)
6. Quellenketten sichtbar: Jede Empfehlung hat Fußnote »Quelle: Lehrplan Kapitel X / Schulbuch Seite Y«
7. Lehrkraft editiert/speichert oder exportiert als DOCX
8. **Audit-Log**: Abfrage protokolliert (Klassenstufe, Lehrplanbereich, gewählte Quellen), keine Schülernamen

---

## Flow 2: Arbeitsblatt- und Aufgabengenerierung mit Differenzierung und Export

**Rolle**: Lehrkraft (Deutsch oder Religion)  
**Ziel**: Schnelle Erstellung differenzierter Aufgabensätze; Export für Klasse  
**Datenschutz-Touchpoints**: Keine Schülernamen in Generator; optional Niveaustufen basierend auf schulinterner Klassifikation (PUBLIC)

### Schritte

1. Lehrkraft öffnet »Aufgabengenerator«
2. Eingabeformular:
   - Titel/Thema (z.B. »Erörterung von Klimapolitik«)
   - Klassenstufe, Fach, Fachbereich
   - Falls Religion: Konfessions-Scope (**Pflicht**; System blockiert Vermischung)
   - Zielkompetenz (z.B. »Analyse literarischer Techniken«)
   - Differenzierungsstufen gewünscht (Basis/Erweiterung/Förder: ja/nein)
3. **Optional**: Lehrkraft lädt Quellenmaterial hoch (PDF, Textauszug)
   - Upload-Redaction-Check: System warnt vor erkannten Schülernamen
   - Material wird in schulinterner Vektorbank indexiert (Trust-Level: USER_APPROVED)
4. Generierung mit Ollama:
   - Basis-Aufgabe: »Analysiere den vorliegenden Text nach …«
   - Erweiterung: »Vergleiche mit …«
   - Förder-Aufgabe: »Beantworte Leitfragen: 1. … 2. …«
   - Jede Aufgabe hat Lösungshinweise (interne Notiz, nicht für Schüler sichtbar)
5. System zeigt:
   - Aufgaben-Preview
   - Quellenreferenzen (falls Material hochgeladen: »Basiert auf hochgeladenem Material [Ihrem Schulbuch]«)
   - Kriterien-Raster (implizit: »Kompetenz X wird überprüft durch Anforderung Y«)
6. Lehrkraft kann bearbeiten:
   - Formulierungen verfeinern
   - Aufgaben zusammenfassen/teilen
   - Quellenangaben hinzufügen (»Zusätzliche Quelle: Schulbuch S. 45–48«)
7. **Export** als DOCX/PDF:
   - Titel, Aufgaben (ggf. gruppiert nach Niveau)
   - Lernziele (oben)
   - Quellenangaben (unten) — verpflichtend
   - Bearbeitungszeit-Prognose
8. **Audit-Log**: Generierung protokolliert (Thema, Klassenstufe, Quellen, Export-Format), nicht die Schülerliste, der Material hochgeladen hat

---

## Flow 3: Korrekturassistenz (Pseudonymisierung → KI-Vorschlag → Menschliche Finalentscheidung)

**Rolle**: Lehrkraft  
**Ziel**: Objektive Feedback-Generierung für Schülertexte; Vorschlagscharakter transparent  
**Datenschutz-Touchpoints**: **CRITICAL** — Schülernamen und identifizierbarer Kontext werden vor KI-Call reduziert

### Schritte

1. Lehrkraft öffnet »Korrekturassistenz«
2. Abgabeverwaltung:
   - Wahl: Einzelne Datei hochladen | Batch-Upload (ZIP mit mehreren Schülertexten)
   - Dateiformat: DOCX, PDF, TXT
3. **Redactions-Scan** (automatisch):
   - System erkennt Schülernamen (aus konfigurierter Klassenliste)
   - Weitere erkannte Muster: Klassenname, Schülerkürzel, Geburtsdatum, Adresse
   - **Sichtbarer Warnschritt**: »Erkannte 23 Schülernamen in diesem Batch. Diese werden vor KI-Verarbeitung maskiert. Bestätigung erforderlich.«
   - Lehrkraft sieht vor/nach (»[SCHÜLER_23]« statt »Anna Schmidt«)
4. **Bestätigung durch Lehrkraft**:
   - »Ich bestätige, dass die Pseudonymisierung korrekt ist und ich die Korrektur durchführe.«
   - Checkbox: »Cloud-LLM verwenden?« (Standard: Nein/Lokal-Ollama)
     - Falls Ja: »WARNUNG: Daten werden an externe API gesendet. Schulfreigabe erforderlich (CloudReleaseGrant).« — Button »Freigabe überprüfen«
5. **KI-Feedback-Generierung**:
   - Eingabe (redacted): »[SCHÜLER_23] schreibt: ‚Der Waldboden besteht haupsächlich aus Laub.' Aufgabe war: Beschreiben Sie drei Schichten des Waldbodens.«
   - Prompt (intern): »Analysiere diesen Schülertext gegen das Kriterium ‚Fachliche Korrektheit nach Lehrplan Biologie Klasse 7'. Gib strukturiertes Feedback: [1] Was ist fachlich korrekt, [2] Was fehlt, [3] Lösungshinweis mit Belegen, [4] Unsicherheitsgrad (High/Medium/Low).«
   - Output:
     ```
     KRITERIUM: Fachliche Korrektheit
     ✓ Erkannt: Waldboden als Objekt (korrekt)
     ✗ Fehlend: Schichtung (Streu-, Humus-, Mineralbodenschicht)
     
     LÖSUNGSHINWEIS: 
     Der Waldboden hat drei Schichten. Die oberste ist die Streu-, bestehend aus frischem Laub (Quelle: Lehrplan Biologie § 4.3; Schulbuch »Natur und Technik 7« S. 89).
     
     UNSICHERHEIT: High (»Haupsächlich« — eventuell meint SchülerIn strukturelle Zusammensetzung, nicht Entstehung; Interpretation kann klarer abgegrenzt werden)
     ```
6. **Vorschlag-Finalisierung durch Lehrkraft**:
   - Sichtbar: »Dies ist ein VORSCHLAG der KI. Sie entscheiden die endgültige Bewertung und das Feedback.«
   - Lehrkraft kann:
     - Feedback wortgleich übernehmen
     - Kürzen/Ergänzen (z.B. »Stimmt, aber die Begriffe sind noch nicht präzise genug«)
     - Ablehnen (z.B. »Das ist zu kritisch; Schüler hat Kern verstanden«)
     - Unsicherheitsmetriken anpassen
   - Finale Version speichern oder als Kommentar in Schulplattform einfügen
7. **Speicherung**:
   - Original (redacted) + KI-Vorschlag + Lehrkraft-Endversion werden mit Audit-Trail gespeichert
   - Schülername bleibt lokal (nur Schuladmin/Lehrkraft sichtbar)
   - Cloud-Export: Nur Lehrkraft-Endversion mit [SCHÜLER_ID], keine Klarnamen
8. **Audit-Log**:
   - Wer (Lehrkraft), Wann, Wie viele Texte, Welche LLM (Ollama | Cloud), Redaction-Ergebnis (»23 Namen maskiert«)
   - Keine Schülertextinhalte, keine Feedback-Freitexte (nur Metadaten: Fach, Klassenstufe, Einschätzung Cloud/Lokal)

---

## Gemeinsame Datenschutz-Invarianten in allen Flows

- **Pseudonymisierung-by-default**: Schülernamen/Klassenzusammensetzung werden VOR LLM-Call maskuliniert
- **Quellenketten transparent**: Jede Empfehlung hat nachvollziehbare Referenzen; keine ungebundenen KI-Outputs
- **Menschliche Letztentscheidung**: System erzeugt Vorschläge; Lehrkraft finalisiert
- **Konfessions-Scope-Treue** (Religion): Keine unbeabsichtigte Vermischung; System warnt aktiv
- **Audit-Trail**: Alle Abfragen protokolliert; Cloud-API-Nutzung dokumentiert; Redaction-Ergebnisse archiviert
- **Fail-Closed**: Erkannte Redaction-Fehler → Abfrage stoppt, Lehrkraft wird benachrichtigt

Siehe [../security/DATA_PROTECTION.md](../security/DATA_PROTECTION.md) für technische Implementierungsdetails.  
Quellen-Standard: [../rag/CITATION_STANDARD.md](../rag/CITATION_STANDARD.md)
