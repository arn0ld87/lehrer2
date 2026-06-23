# 0004: Local-First-Verarbeitung von Schülerdaten

## Status

Akzeptiert, 2026-06-22

## Kontext

Das Projekt verarbeitet Daten von Schülerinnen und Schülern im Kontext von Religionsunterricht an deutschen Schulen. Dies führt zu mehreren Datenschutz-Besonderheiten:

- **DSGVO-Anwendbarkeit**: Schülerinnen und Schüler sind überwiegend Minderjährige; Art. 8 DSGVO setzt strengere Anforderungen an deren Einwilligung.
- **Art.-9-Daten**: Konfession und Weltanschauung fallen unter Art. 9 DSGVO (Besondere Kategorien personenbezogener Daten) und erfordern verstärkte Schutzmaßnahmen.
- **Schulisches Umfeld**: Die Einbindung an Schulserver und Netzwerk-Richtlinien erfordert vertrauenswürdige, lokal betreibbare Technologie.
- **Pseudonymisierung als Mittel**: Der Standard-Datenschutz-Ansatz besteht darin, sensitive Daten vor Cloud-Verarbeitung zu anonymisieren oder zu pseudonymisieren — dies ist technisch möglich und geboten.

**Auftraggeber-Kontext**: Auftraggeber äußerte initial den Wunsch, Schülernamen (Klartext) an Cloud-LLMs (z. B. OpenAI, Google) zur Verarbeitung zu übermitteln. Nach Präsentation des Spec-Widerspruchs (Pseudonymisierung-by-default im Entwurf) und der Rechtsrisiken (DSGVO Art. 32, DSFA-Anforderungen, schulische Genehmigungspraxis) wurde die Variante "pseudonymisiert + gegated" vereinbart.

## Optionen

### (a) Gar keine Schülerdaten in der Cloud

- **Vorteil**: Maximale Datensicherheit; keine Cloud-Abhängigkeit für Kernfunktion.
- **Nachteil**: Zukünftige Cloud-Modelle sind de facto ausgeschlossen; lokale Kapazität muss alle Usecases decken; Maintenance-Overhead für selbstgehostete Infrastruktur.
- **Bewertung**: Zu restriktiv für mittelfristige Skalierung, aber als Fallback akzeptabel.

### (b) Pseudonymisiert + gegated (GEWÄHLT)

- **Standard**: Schülerdaten werden lokal in pseudonymisierter Form verarbeitet (Ollama Default-Provider).
- **Cloud-Freigabe**: Ein Klartext-Cloud-Modus ist ausschließlich OFF-BY-DEFAULT; nur bei expliziter schulischer Genehmigung (CloudReleaseGrant) mit Rechtsgrundlage + Datenschutz-Folgenabschätzung + Provider-Dokumentation + Landesdatenschutzbeauftragten-Absprache aktivierbar.
- **Guard**: Fail-closed: Vor jedem LLM-Call wird geprüft, ob der Datenkontext SENSITIVE_STUDENT enthält; ggf. Redaction + Pseudonymisierung; keine Daten übermitteln, wenn Guard nicht erfüllt.
- **Vorteil**: Erfüllt DSGVO; flexible Aufskalierung bei Bedarf (mit Genehmigung); default-sicher; transparente Entscheidungsfindung für Schulleitung + Datenschutz.
- **Nachteil**: Zwei Code-Pfade (lokal vs. cloud); Redaction kann Kontextqualität beeinträchtigen; Aufwand für Compliance-Dokumentation pro Cloud-Release.

### (c) Klarnamen-Cloud-Default (VERWORFEN)

- **Ansatz**: Schülernamen standardmäßig an Cloud-Provider übermitteln.
- **Warum verworfen**:
  - **Spec-Widerspruch**: "Pseudonymisierung-by-default" ist Projektziel (Invarianten-Defintion).
  - **Rechtliches Risiko**: DSGVO Art. 32 (Sicherheit), Art. 33/34 (Meldepflicht bei Verletzung), Art. 82 (Schadensersatz); schulische Genehmigungspraxis verlangt explizite Datenschutz-Freigabe; bloße AGB eines Cloud-Providers deckt Schulanforderungen nicht ab.
  - **Kein funktionaler Nutzen**: LLM-Qualität für Feedback/Analyse verschlechtert sich _nicht_ durch Pseudonymisierung (z. B. „Schüler_123" statt „Max Müller"); Kontext bleibt erhalten.
  - **Haftungsrisiko**: Schulleitung trägt letztlich die Verantwortung; unkontrolliertes Cloud-Tracking von Minderjaehrigen ist nicht mehr zeitgemäß.

## Entscheidung

**Standard-Verarbeitung: Lokal + Pseudonymisiert**

1. **Default-Provider: Ollama** (lokal, selbstgehostet). Sämtliche SENSITIVE_STUDENT-Daten werden mit Ollama verarbeitet.
2. **Pseudonymisierung-Pflicht**: Vor jedem LLM-Aufruf erfolgt ein Guard-Check:
   - Ist der Input PUBLIC oder INTERNAL? → Direkt an LLM.
   - Ist der Input PERSONAL_TEACHER oder SENSITIVE_STUDENT? → Redaction + Pseudonymisierung; nur Metadaten (Klassenstufe, Fach, Kompetenzbereich) + anonymisierte/pseudonymisierte Textfragmente.
   - Ist der Guard nicht erfüllt? → Fail-closed: Anfrage ablehnen mit nutzerfreundlicher Fehlermeldung.
3. **Klartext-Cloud-Modus: OFF-BY-DEFAULT + Gegated**
   - Nur Schulen, die eine explizite CloudReleaseGrant eingereicht haben, können diesen Modus aktivieren.
   - CloudReleaseGrant-Anforderungen:
     - Rechtsgrundlage dokumentiert (z. B. Dienst-Anweisung der Schulleitung, Elterneinwilligung).
     - Datenschutz-Folgeabschätzung (DSFA) für den Cloud-Provider + Region.
     - AV-Vertrag (Auftragsverarbeitungsvertrag) mit dem Provider.
     - Bestätigung: Schulleitung + Datenschutzverantwortlicher.
     - Empfehlung: Rücksprache mit Landesdatenschutzbeauftragtem vor Freigabe.
   - UI-Warnung: Deutlicher Hinweis beim Aktivieren und bei jedem Cloudcall ("Schülerdaten werden an [Provider, Region] übermittelt").
   - Audit-Log: Jeder Cloud-Call wird mit Timestamp, User, Provider, Datenklass-Level geloggt.
4. **Dokumentationspflicht**: CloudReleaseGrant-Einträge müssen im System persistent gespeichert sein (nicht löschbar, nur archivierbar); prüfbar für Datenschutz-Audits.

## Konsequenzen

### Positiv

- **DSGVO-Konformität**: Datenschutz-Prinzipien (Artikel 5: Rechtmäßigkeit, Fairness, Transparenz, Datenminimierung, Integrität, Vertrauchlichkeit) sind auf Systemdesign-Ebene verankert.
- **Rechtssicherheit für Schulen**: Explizite Genehmigung + DSFA + AV-Vertrag schützen vor regressiven Ansprüchen.
- **Vertrauen**: Schulleitung und Eltern können dem System vertrauen, weil die Default-Richtung sicher ist.
- **Technische Auditierbarkeit**: Guard-Checks und Cloud-Calls sind loggbar und reviewbar.

### Risiken

- **Re-Identifikation aus Pseudo-Freitext**: Selbst wenn Schülernamen redacted sind, kann ein Freitext-Fragment ("arbeitet langsam, mathematisch begabt, kommt aus [Ort]") möglicherweise re-identifizieren.
  - **Mitigation**: Zusätzliche Entfernung von Ortsnamen, extremen Charakteristika; Token-Budget für redacted Prompts beschränken; DSFA-dokumentieren.
- **Ollama-Qualität**: Lokale Ollama-Modelle können schwächer sein als Cloud-Modelle (z. B. gpt-4-turbo).
  - **Mitigation**: Regelmäßige Modell-Updates; Feedback-Loop für Lehrer (Iterative Prompt-Verbesserung); evtl. Migrationsroute zu qualitativ besseren lokalen Modellen (LLaMA 3, Mixtral).
- **Cloud-Modus: Missbrauch durch falsche Genehmigung**: Schule gibt falsch oder unvollständig CloudReleaseGrant ab.
  - **Mitigation**: Starre Validierung im System (Feld-Checker für DSFA-ID, AV-Datum); Admin-Review vor Aktivierung; Quartal-Audit der aktiven Grants.
- **Compliance-Dokumentation: Zeitaufwand**: DSFA-Erstellung ist manuell aufwendig.
  - **Mitigation**: Template bereitstellen; Leitfaden für Datenschutzverantwortliche; opt. SaaS-Partner für DSFA-Vorprüfung.

### Restrisiken (Explizit zu Führen)

- **Datenleck auf lokalem Server**: Selbstgehostete Infrastruktur kann kompromittiert werden.
  - **Kontrolle**: Netzwerk-Segmentierung, regelmäßige Security-Updates, Firewall, SSH-Key-Management.
- **Unerwartete Re-Identifikation**: Fortgeschrittene NLP-Techniken könnten Pseudo-Daten re-identifizieren.
  - **Kontrolle**: Defensive Redaction-Logik; Evaluationen mit Sicherheitsforscher:innen; DSFA-Update alle 18 Monate.
- **Vendor-Lock-in bei Cloud-Release**: Sobald Schule Klartext-Modus nutzt, ist Wechsel des Cloud-Providers schwierig.
  - **Kontrolle**: AV-Verträge mit kurzen Kündigungsfristen (max. 12 Monate); Import/Export von Daten standardisiert dokumentieren.

## Verweise

- [../security/DATA_PROTECTION.md](../security/DATA_PROTECTION.md) — Datenschutz-Implementierungsrichtlinien (Guard-Logik, Redaction-Algorithmen).
- [../security/REDACTION_AND_GUARD_SPEC.md](../security/REDACTION_AND_GUARD_SPEC.md) — Technische Spezifikation für Pseudonymisierung, Redaction und fail-closed Guards.
- [../security/THREAT_MODEL.md](../security/THREAT_MODEL.md) — Bedrohungsanalyse, Annahmen über Angreifer-Modelle.
- [../architecture/DATA_MODEL.md](../architecture/DATA_MODEL.md) — Datenklassen-Taxonomie (PUBLIC, INTERNAL, PERSONAL_TEACHER, SENSITIVE_STUDENT).
- [../decisions/OPEN_QUESTIONS.md](../decisions/OPEN_QUESTIONS.md) — Offene Frage: "Wer entscheidet über Cloud-Release-Grants auf Schulträgerebeene?".
- DSGVO Art. 5 (Grundprinzipien), Art. 8 (Kinder), Art. 9 (Besondere Kategorien), Art. 32 (Sicherheit), Art. 33/34 (Meldepflicht).
- Empfehlung: [Landesdatenschutzbeauftragter Baden-Württemberg — Verarbeitung von Schülerdaten](https://www.datenschutz.de/) (Beispiel, je Bundesland anpassen).
