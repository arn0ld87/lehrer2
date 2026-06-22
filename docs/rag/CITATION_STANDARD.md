# Zitationsstandard für Unterrichtsassistenz LSA

## Grundsatz

Jede fachliche oder curriculare Aussage in der Unterrichtsassistenz LSA muss durch eine dokumentierte Quelle belegt sein. Das Zitationssystem ermöglicht Transparenz, Nachvollziehbarkeit und Qualitätskontrolle von Lehrinhalten und stellt sicher, dass Lehrkräfte und Schüler verstehen, auf welcher Grundlage Empfehlungen und Aussagen basieren.

## Pflichtfelder einer Zitation

Jede Zitation (SourceRef) muss folgende Metadaten enthalten:

| Feld | Typ | Beschreibung | Beispiel |
|------|-----|-------------|---------|
| `source_document_id` | UUID | Eindeutige ID des Quelldokuments im System | `550e8400-e29b-41d4-a716-446655440000` |
| `title` | String | Offizieller Titel des Quelldokuments | `Lehrplan Mathematik für das Land Bayern (2021)` |
| `publisher` | String | Herausgeber oder Institution | `Bayrisches Staatsministerium für Unterricht und Kultus` |
| `official_url` | URL | Permanente, öffentliche URL (wenn verfügbar) | `https://www.lehrplanplus.bayern.de/lehrplan/realschule/mathematik` |
| `trust_level` | Enum | Vertrauensstufe der Quelle (s.u.) | `OFFICIAL_BINDING` |
| `page_or_section` | String | Spezifischer Verweis (Seite, Kapitel, Abschnitt) | `Kapitel 3.2 Funktionen, S. 45–47` |
| `source_version` | String | Versionsnummer oder Datum der Quelle | `2021-09-01` oder `v1.2` |
| `license` | String | Lizenzangabe (insbes. für OER-Inhalte) | `CC-BY-4.0` oder `Public Domain` |
| `retrieved_at` | ISO8601 DateTime | Abrufdatum für Web-Quellen | `2026-06-22T14:30:00Z` |
| `content_hash` | String | SHA-256-Hash des Inhalts (Veränderungserkennung) | `a3f5d4c2b1e8f9...` |
| `subject` | String | Fachbereich oder Thema | `Mathematik`, `Deutsch`, `Religion (evangelisch)` |
| `confession_context` | Enum | Konfessioneller Kontext (falls relevant) | `EVANGELICAL`, `CATHOLIC`, `CONFESSIONALLY_OPEN`, `RELIGIOUS_STUDIES`, `ETHICS`, `NONE` |

### Vertrauensstufen (trust_level)

- **`OFFICIAL_BINDING`** — Offizieller Lehrplan, staatlich verbindlich (z.B. Lehrplan Plus Bayern). Aussagen mit Lehrplan-Anspruch MÜSSEN diese Stufe haben.
- **`OFFICIAL_GUIDANCE`** — Offizielle Richtlinien, Handreichungen von Kultusministerien oder akkreditierten Institutionen (z.B. KMK-Empfehlungen).
- **`OPEN_CURATED`** — Fachlich geprüfte offene Ressourcen (Schulbücher, Fachverbandsmaterialien, Hochschul-Skripte mit Peer-Review).
- **`USER_APPROVED`** — Von der Lehrkraft oder Admin explizit freigegebene lokale Materialien.
- **`UNVERIFIED`** — Nicht geprüfte Quellen (z.B. Web-Schnipsel, automatisch ingested). **Nie in Produktion verwenden.**

Vgl. [RAG_ARCHITECTURE](../architecture/RAG_ARCHITECTURE.md#trust-levels) und [INGESTION_POLICY](./INGESTION_POLICY.md).

## Confidence-Zustände

Jede outputting Aussage (z.B. Korrekturvorschlag, Lernempfehlung, Lehrplanbezug) wird als `GROUNDED` oder `UNSUPPORTED_DRAFT` klassifiziert:

### GROUNDED
- Die Aussage ist durch mindestens eine Quelle mit `trust_level` ∈ {`OFFICIAL_BINDING`, `OFFICIAL_GUIDANCE`} belegt.
- Sämtliche belastende Fachbehauptungen (Definitionen, Methoden, Zuordnungen zu Lernstufen) haben eine solche Quelle.
- **UI-Konsequenz:** Volle Darstellung, explizite Quellenangabe ohne Warnung.

### UNSUPPORTED_DRAFT
- Die Aussage hat keine `OFFICIAL_BINDING`- oder `OFFICIAL_GUIDANCE`-Quelle.
- Beispiele: Generierte Übungsvorschläge, hypothetische Beispiele, Aussagen ohne Lehrplan-Beleg.
- **UI-Konsequenz:**
  - Deutlich gekennzeichnet mit Badge/Fußnote: *"Entwurf ohne Lehrplan-Bindung"* oder *"Vorschlag – bitte prüfen"*
  - Quellenangabe(n) angezeigt (falls vorhanden), aber mit Hinweis auf Vertrauenslücke.
  - Keine Verwendung in automatischen Grades/Assessments ohne Lehrkraft-Bestätigung.

Vgl. [DATA_PROTECTION](../security/DATA_PROTECTION.md#confidence-states-and-guardrails).

## Darstellungsformat im Produkt

### Beispiel: Fußnote mit Quellenbeleg

```
Mathematik, Klasse 7: Der Begriff "Funktionaler Zusammenhang" bezieht sich auf 
die Beziehung zwischen zwei Größen [^1].

[^1]: Lehrplan Mathematik Bayern (2021), Kapitel 3.2, S. 45–47. 
      Quelle: Bayrisches Staatsministerium für Unterricht und Kultus.
      Abrufdatum: 2026-06-22. Version: 2021-09-01.
      Vertrauensstufe: OFFICIAL_BINDING.
      Lizenz: Public Domain.
```

### Beispiel: Quellenlist-Modul

```json
{
  "statement": "Der Katechismus wird in katholischem Unterricht als Orientierungstext verwendet.",
  "citations": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Lehrplan Katholische Religionslehre Bayern (2019)",
      "publisher": "Bayrisches Staatsministerium für Unterricht und Kultus",
      "official_url": "https://www.lehrplanplus.bayern.de/...",
      "trust_level": "OFFICIAL_BINDING",
      "page_or_section": "Kapitel 2.1",
      "source_version": "2019-06-15",
      "license": "Public Domain",
      "retrieved_at": "2026-06-22T09:45:00Z",
      "content_hash": "a3f5d4c2b1e8f9a4d7e2c5f8a1b4e7d0c3f6a9b2e5c8f1a4d7e0c3f6a9b2",
      "subject": "Religion (katholisch)",
      "confession_context": "CATHOLIC"
    }
  ],
  "confidence": "GROUNDED"
}
```

### Darstellungsregeln für Schüleransicht

- Alle `GROUNDED`-Aussagen zeigen Quellenangabe mit Seite/Abschnitt + Version + Abrufdatum.
- Alle `UNSUPPORTED_DRAFT`-Aussagen erhalten zusätzliche visuelle Kennzeichnung (z.B. gestrichelter Rand, "Entwurf"-Badge).
- Confession_context wird in der UI nur angezeigt, wenn relevant für das konfessionelle Verständnis oder für Filterung.
- Bei mehreren Quellen: Primäre Quelle prominent, weitere Quellen in Akkordeon oder "Weitere Belege".

## Regel: Aussagen mit Lehrplan-Anspruch

**Kritische Regel:** Jede Aussage, die einen Bezug zu Lehrplan, Curriculum oder Kompetenzzielen herstellt, muss durch mindestens einen Beleg mit `trust_level` ∈ {`OFFICIAL_BINDING`, `OFFICIAL_GUIDANCE`} unterstützt sein. Fehlt dieser Beleg, wird die Aussage automatisch als `UNSUPPORTED_DRAFT` klassifiziert und kann nicht als verbindliche Lehrplanempfehlung gelten.

Beispiele für Aussagen mit Lehrplan-Anspruch:
- "Funktionen sind Inhalt der Klasse 7 in Bayern."
- "Die Kompetenz C4 fordert Textanalyse von literarischen Werken."
- "Paragrafen im Grundgesetz werden in Klasse 9 Sozialkunde behandelt."

Beispiele für Aussagen OHNE Lehrplan-Anspruch:
- "Das könnte eine interessante Übungsaufgabe sein."
- "Schüler lernen oft besser mit visuellen Beispielen."
- "Ein Gedicht von Goethe ist Goethe zugeordnet." (Faktische Zuordnung, keine Curriculum-Aussage)

## Verweise

- [RAG_ARCHITECTURE](../architecture/RAG_ARCHITECTURE.md) — System-Architektur für Quellen-Management und Ranking.
- [SOURCE_REGISTRY](./SOURCE_REGISTRY.md) — Katalog aller ingesten Quellen, Versionen und Compliance-Status.
- [INGESTION_POLICY](./INGESTION_POLICY.md) — Regeln für Aufnahme neuer Quellen und Versionierung.
