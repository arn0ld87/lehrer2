# Spezifikation: Lehrplanorientierter Planungsassistent

## 1. Zielsetzung und Charakteristik

Der Planungsassistent unterstützt Lehrkräfte bei der Erstellung lehrplankonformer Unterrichtseinheiten und Lektionen. Sein Alleinstellungsmerkmal ist die strikte **Quellenpflicht** und der Fokus auf **Local-first**-Verarbeitung. Jede generierte curriculare Aussage muss durch offizielle Quellen (Lehrpläne des Landes Sachsen-Anhalt) belegt sein.

## 2. Planungsflow (User Flow)

Der Flow ist in vier Phasen unterteilt, um Transparenz und menschliche Kontrolle sicherzustellen:

### Phase 1: Rahmendatenerfassung (Input)

Die Lehrkraft erfasst die Basiselemente der Planung:

- **Fach & Konfession** (Deutsch, Religion ev./kath./übergreifend, Ethik).
- **Klassenstufe & Schulform** (z.B. Klasse 8, Gemeinschaftsschule).
- **Thema & Grobziel** (Freitext der Lehrkraft).
- **Zeitrahmen** (Anzahl der Unterrichtsstunden).

### Phase 2: RAG-gestützter Strukturvorschlag

Das System führt eine Retrieval-Augmented Generation (RAG) durch:

1. **Retrieval**: Suche nach relevanten Kompetenzen und Inhalten in `OFFICIAL_BINDING` Quellen (Landeslehrpläne LSA).
2. **Filterung**: Strikte Einhaltung des Fach- und Konfessions-Scopes (kein Cross-Strang-Retrieval).
3. **Generierung**: Erstellung eines Entwurfs (Stundenverlauf, Lernziele, Kompetenzbezug).

### Phase 3: Zitationsprüfung und Kennzeichnung (Verification)

Jede generierte Aussage wird nach [CITATION_STANDARD](../rag/CITATION_STANDARD.md) klassifiziert:

- **GROUNDED**: Belegt durch mindestens eine `OFFICIAL_BINDING` oder `OFFICIAL_GUIDANCE` Quelle.
- **UNSUPPORTED_DRAFT**: Fehlender oder unzureichender Beleg.
- **Visualisierung**: Aussagen ohne festen Lehrplanbezug werden als "Vorschlag - bitte prüfen" markiert.

### Phase 4: Finalisierung und Export

Die Lehrkraft prüft, editiert und finalisiert die Planung.

- Speicherung in der persistenten Datenbank (`TeachingUnit`, `Lesson`).
- Export als DOCX oder PDF mit verpflichtendem Quellen-Footer.

## 3. Quellenpflicht pro Aussage

Eine Aussage gilt nur dann als lehrplanorientiert, wenn sie folgende Bedingungen erfüllt:

- **Identifizierbarkeit**: Verweis auf Kapitel/Seite/Paragraph des Lehrplans.
- **Aktualität**: Nutzung der in der `SOURCE_REGISTRY` hinterlegten aktuellsten Version (z.B. RdErl. 2025/2026).
- **Transparenz**: Der Beleg muss für die Lehrkraft direkt einsehbar sein (Tooltip oder Fußnote).

### Beispiel für eine belegte Aussage

> "Die Schülerinnen und Schüler analysieren die Erzählstruktur in epischen Kurzformen [1]."
>
> [1] Fachlehrplan Sekundarschule Deutsch (2012, Anp. 2019), Kap. 3.2, S. 24.

## 4. Local-first Provider Anforderungen

Um den Datenschutzvorgaben (ADR 0004) zu entsprechen:

- **Default-Modell**: Die Generierung erfolgt standardmäßig über einen lokalen Ollama-Server.
- **Cloud-Einsatz**: Cloud-LLMs sind nur zulässig, wenn ein `CloudReleaseGrant` vorliegt und keine Schülerdaten (SENSITIVE_STUDENT) Teil des Prompts sind.
- **Latenz vs. Qualität**: Bei lokaler Ausführung wird ein Modell mit mindestens 14B Parametern (z.B. Qwen2.5-14b) empfohlen, um die Zitationsgenauigkeit zu gewährleisten.

## 5. Umgang mit Risiken: Unvollständige Quellen

Speziell im Bereich Religion (ev./kath.) besteht das Risiko lückenhafter digitaler Quellen für bestimmte Jahrgänge.

- **Fail-Safe**: Findet das RAG-System keine passenden `OFFICIAL_BINDING` Chunks, darf es keine fiktiven Lehrplan-Codes erfinden.
- **Hinweispflicht**: Das System muss die Lehrkraft explizit informieren: "Keine direkten Lehrplanbelege für dieses Thema in der Datenbank gefunden. Der Vorschlag basiert auf allgemeinem Modellwissen."
- **Manuelle Ergänzung**: Die Lehrkraft muss die Möglichkeit haben, eigene `USER_APPROVED` Quellen für diese Lücken hochzuladen.

## 6. UI/UX Anforderungen

- **Zitations-Badges**: Kleine Indikatoren (z.B. [LP]) neben Textstellen, die beim Hover die Quelle einblenden.
- **Konfidenz-Warnungen**: Farblich abgestufte Rahmen (Gelb für `UNSUPPORTED_DRAFT`).
- **Quellen-Sidebar**: Eine Übersicht aller in der aktuellen Planung verwendeten Quellen.

## Verweise

- [CITATION_STANDARD](../rag/CITATION_STANDARD.md)
- [USER_FLOWS](./USER_FLOWS.md)
- [DATA_PROTECTION](../security/DATA_PROTECTION.md)
