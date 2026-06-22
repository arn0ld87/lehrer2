# Product Vision: Unterrichtsassistenz LSA

## Vision

Ein datenschutzsensibler KI-Assistent, der Lehrkräfte an Gesamt- und Gemeinschaftsschulen beim Unterrichtsdesign, bei der Materialerstellung und bei der Schülerunterstützung entlastet — ohne dabei Schülerdaten preiszugeben, ohne Entscheidungen zu zentralisieren und ohne versteckte Cloud-Abhängigkeiten.

## Problemstellung

Lehrkräfte investieren täglich Stunden in:

- Individuelle Lernmaterialien für heterogene Klassen (Differenzierung nach Niveau, Förderschwerpunkt, Lerntyp)
- Aufgabenvariationen für Religion/Ethik mit konfessioneller Sensibilität
- Korrektur und Feedback — konzeptuell korrekt, aber aufwandintensiv schriftlich zu belegen
- Recherche und Verifizierung von Unterrichtsmaterialien auf Lehrplantauglichkeit

Bestehende KI-Tools (ChatGPT, Gemini, Claude Web) bieten zwar schnelle Antworten, aber:

- **Datenschutzrisiken**: Schülernamen, Klassenkontext, sensible Inhalte landen in Cloud-Logs
- **Quellenproblem**: Antworten ohne nachvollziehbare Belege; ideal für Schnelligkeit, problematisch für pädagogische Verantwortung
- **Zuständigkeitsvermischung**: KI-Output wirkt oft wie Autorität statt wie Werkzeug-Vorschlag
- **Konfessionsvermischung**: Religion nicht strukturell von Ethik/Philosophie getrennt

## Zielgruppe

- **Primär**: Lehrkräfte Deutsch und Religion, Klassen 5–12, an sächsisch-anhaltinischen Gesamt- und Gemeinschaftsschulen
- **Sekundär**: Schuladministration (Freigaben, Reporting); später auch Fachkonferenzen
- **Ausschlusskriterium**: Schüler als Direktnutzer (keine öffentliche Schülerplattform)

## Produktversprechen

1. **Lokal und privat**: Schülerdaten verlassen das Schulnetzwerk nicht. Pseudonymisierung vor jedem KI-Call; Klarnamen nur für Schulserver-interne Workflows.
2. **Quellenpflicht**: Jede Empfehlung ist rückverfolgbar. Lehrplanreferenzen, Quellenangaben, Unsicherheitsmetriken — nicht versteckt, sondern sichtbar.
3. **Menschliche Letztentscheidung**: KI liefert Vorschläge (Aufgaben, Feedback, Korrekturhinweise), Lehrkraft trifft Entscheidung. Kein automatisiertes Grading, keine Notenvergabe durch System.
4. **Kostenkontrolle**: Lokal Ollama as Standard; optionale Cloud-LLMs (z.B. Claude API) nur mit expliziter Schulfreigabe und dokumentiertem Ausnahmestatus.
5. **Konfessionstrennung**: Religion (evangelisch, katholisch, interreligiös) strikt getrennt von Ethik/Religionskunde; keine ungewollte Vermischung.

## Leitprinzipien

### Local-First

- Standardmodell läuft auf Schulserver oder Lehrkraft-Workstation (Ollama)
- Offline-Funktionalität für Basisszenarien (Aufgabengenerierung, Feedback-Vorschlag)
- Cloud-LLMs nur dokumentierte Exceptions

### Quellenbindung mit Nachweis

- Jeder Output hat eine Vertrauenskette (OFFICIAL_BINDING / OFFICIAL_GUIDANCE / OPEN_CURATED / USER_APPROVED / UNVERIFIED)
- UNVERIFIED Quellen nie produktiv eingespeist
- Lehrplan, Schulbuch, Arbeitsblatt-Sammlung: Quellenebenen transparent und nachvollziehbar

### Menschliche Letztentscheidung

- KI-Output ist Entwurf, nicht Autorität
- Korrekturvorschläge zeigen: Kriterium, Beleg, Unsicherheitsmetriken
- Endnoten, Anerkennungen, Leistungsfeststellungen: ausschließlich menschlich

### Kostenkontrolle

- Ollama-Integration reduzeert Cloud-Kosten auf Null (für MVP)
- Token-Tracking für optionale Cloud-APIs (Budget + Audit-Trail)
- Batch-Verarbeitung (z.B. Stapelkorrektur) mit Kostenprognose

### Konfessionstrennung

- Religion: Denominationen explizit (ev./kath./interreligiös/Ethik)
- Workflow warnt vor Cross-Denomination Contamination
- Ethik: Religionkundlich, nicht theologisch

## Abgrenzung zu generischen KI-Tools

| Aspekt           | LSA                                      | ChatGPT/Gemini/Claude Web                                |
| ---------------- | ---------------------------------------- | -------------------------------------------------------- |
| **Datenschutz**  | Lokal; Pseudonymisierung Pflicht         | Cloud-Logs; keine Kontrolle                              |
| **Quellen**      | Unterrichtsmaterial-RAG mit Trust-Levels | Großes Sprachmodell, Quelle oft unklar                   |
| **Entscheidung** | Mensch final                             | Kann wie Autorität wirken                                |
| **Kostenmodell** | Lokal ≈ 0 €                              | Pay-per-Token; unbegrenzte Nutzung schwer kontrollierbar |
| **Konfession**   | Strukturell getrennt                     | Keine Struktur für Religionsdidaktik                     |
| **Zielgruppe**   | Schulen, DSGVO-bewusst                   | Masse, Datenschutz sekundär                              |

## Nächste Schritte

Siehe [MVP_SCOPE.md](./MVP_SCOPE.md) für erste Phase. Gesamtarchitektur und Datenschutzkonzept in [../../PLAN.md](../../PLAN.md).
