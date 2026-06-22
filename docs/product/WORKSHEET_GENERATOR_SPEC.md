# Spezifikation: Arbeitsblatt-Generator

**Status:** In Review
**Version:** 1.0.0 (2026-06-22)
**Bezug:** Roadmap-Issue #12, Milestone M1, ADR 0008, ADR 0010

---

## 1. Zielsetzung

Der Arbeitsblatt-Generator ermöglicht Lehrkräften die effiziente Erstellung von lehrplangebundenen und differenzierten Unterrichtsmaterialien. Er stellt sicher, dass alle Aufgaben auf offiziellen Quellen basieren, korrekt zitiert werden und den datenschutzrechtlichen Anforderungen des Landes Sachsen-Anhalt entsprechen.

## 2. Generator-Flow (Schritt für Schritt)

### Schritt 1: Konfiguration & Kontext

Die Lehrkraft definiert den Rahmen für das Arbeitsblatt:

- **Titel/Thema:** Freitext (z.B. "Einführung in die Argumentation").
- **Fach:** Deutsch, Religion (ev./kath./übergreifend), Ethik.
- **Klassenstufe:** KS5 bis KS10 (Sek I).
- **Konfessions-Scope (Pflicht bei Religion):** Filtert den Lehrplanstrang (`curriculum_strand`).
- **Zielkompetenz:** Auswahl aus dem `curriculum_node` (RAG-gestützt) oder Freitext.
- **Differenzierung:** Checkbox "Differenzierte Aufgaben generieren" (Standard: Ein).

### Schritt 2: Quellenwahl (RAG-Retrieval)

Das System schlägt relevante Quellen vor:

- **Automatisch:** `OFFICIAL_BINDING` (Lehrplan) und `OFFICIAL_GUIDANCE`.
- **Optional:** Hochgeladene Materialien der Lehrkraft (`USER_APPROVED`) oder der Schule (`OPEN_CURATED`).
- **Sicherheits-Check:** PII-Redaction bei Nutzer-Uploads; Blockierung von `UNVERIFIED`-Quellen für die Generierung.

### Schritt 3: KI-Generierung (Lokal-first)

- **Modell:** Ollama (Default: `qwen2.5-14b` oder äquivalent).
- **Prompting:** Strukturiertes Prompting basierend auf den gewählten Curriculum-Knoten und Quellen.
- **Output:** Drei Aufgabensätze (Basis, Erweiterung, Förder), Erwartungshorizont und Zitations-Metadaten.

### Schritt 4: Preview & Edit (Web-UI)

Die Lehrkraft kann:

- Aufgabentexte editieren.
- Schwierigkeitsgrade anpassen.
- Quellen manuell ergänzen oder verfeinern.
- Vorschau der Zitations-Fußnoten prüfen.

### Schritt 5: Export

- **Formate:** DOCX (bearbeitbar), PDF (druckfertig).
- **Inhalt:** Aufgaben, Platz für Schülernamen, Lernziele, Quellenverzeichnis im Footer.

---

## 3. Differenzierungs-Optionen

| Niveau          | Zielgruppe                       | Merkmale                                                                                               |
| :-------------- | :------------------------------- | :----------------------------------------------------------------------------------------------------- |
| **Basis**       | Regelschüler                     | Erwerb der Kernkompetenzen, Standard-Anforderungsniveau.                                               |
| **Erweiterung** | Leistungsstarke Schüler          | Komplexe Transferaufgaben, weniger Scaffolding, vertiefte Analyse.                                     |
| **Förder**      | Schüler mit Unterstützungsbedarf | Vereinfachte Sprache, viel Scaffolding (Hilfestellungen), Fokus auf Reproduktion und Grundverständnis. |

_Hinweis:_ Aufgaben können im Export entweder gemischt (mit Niveaumarkierung) oder in separaten Abschnitten ausgegeben werden.

---

## 4. Export-Spezifikationen (Issue 14 & ADR 0008)

### Formate & Tech-Stack

- **DOCX:** Generierung via `docx` (MIT-Lizenz). Fokus auf Bearbeitbarkeit.
- **PDF:** Generierung via `pdfkit` (MIT-Lizenz). Fokus auf Layout-Treue und Druckbarkeit.
- **Keine Cloud-Dienste:** Der Export erfolgt rein serverseitig (local-first).

### Layout-Anforderungen

1. **Kopfzeile:** Titel des Arbeitsblatts, Fach, Klassenstufe, Platz für Name/Datum.
2. **Lernziele:** Kurze Zusammenfassung der angestrebten Kompetenzen (optional einblendbar).
3. **Aufgabenteil:**
   - Nummerierte Liste.
   - Niveaustufe (Symbol oder Text wie `[Basis]`).
   - Angabe der maximalen Punktzahl (falls definiert).
4. **Footer (Quellen & Lizenzen):**
   - **Mandatorisch:** Alle verwendeten RAG-Quellen (Titel, Version, §/S.).
   - **Lizenz:** Anzeige der Blatt-Lizenz (z.B. "CC-BY-SA 4.0") und der `derivation_source`.
   - **Branding:** Dezentes "Generiert mit Unterrichtsassistenz LSA".

---

## 5. Lehrplanbezug & Governance

### Trust-Levels

Nur Quellen mit folgendem Status dürfen die Inhaltsgenerierung beeinflussen:

1. `OFFICIAL_BINDING` (Landeslehrpläne LSA)
2. `OFFICIAL_GUIDANCE` (Handreichungen des LISA)
3. `OPEN_CURATED` (Geprüfte OER-Materialien)
4. `USER_APPROVED` (Eigene, von der Lehrkraft geprüfte Dokumente)

### Konfessionstrennung (Religion)

- Das System erzwingt eine strikte Trennung.
- **Evangelisch:** Nutzt nur evangelische Lehrplanstränge.
- **Katholisch:** Nutzt nur katholische Lehrplanstränge.
- **Übergreifend:** Erlaubt explizit beide, markiert aber die Perspektiven in der Quelle.

---

## 6. Risiken & Abhängigkeiten

- **Export-Lizenzrisiken:** Durch die Beschränkung auf MIT-lizenzierte Bibliotheken (`docx`, `pdfkit`) wird das Risiko von Copyleft-Konflikten oder Lizenzkosten minimiert.
- **Modell-Halluzinationen:** Der Generator-Flow sieht zwingend ein "Human-in-the-loop"-Review vor dem Export vor.
- **Zitations-Vollständigkeit:** Das System muss sicherstellen, dass bei jeder KI-generierten Aufgabe die Herkunft der zugrunde liegenden Fakten/Methoden im Meta-Modell erhalten bleibt.

---

## 7. Akzeptanzkriterien für die Implementierung

- [ ] Vollständiger Generator-Flow in der UI abgebildet.
- [ ] Differenzierung (Basis/Erweiterung/Förder) im Prompting und Output-Modell realisiert.
- [ ] Export erzeugt valide DOCX- und PDF-Dateien ohne externe Abhängigkeiten.
- [ ] Quellenangaben im Export entsprechen dem `docs/rag/CITATION_STANDARD.md`.
- [ ] Konfessions-Checks blockieren fachfremde Lehrplaninhalte.
