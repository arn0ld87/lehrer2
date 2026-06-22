# Lizenzentscheidung — Unterrichtsassistenz LSA

**Status:** Entscheidung offen  
**Zuletzt aktualisiert:** 2026-06-22

---

## Aktuelle Situation

Das Projekt ist derzeit **nicht unter Lizenz gestellt.** Das Repoitory ist privat (`arn0ld87/lehrer2`). Vor der Veröffentlichung oder Weitergabe an Schulen und Partner muss eine passende Lizenz gewählt werden.

---

## Optionen

### 1. Proprietär / All-Rights-Reserved

**Modell:** Keine öffentliche Lizenz; Nutzung nur mit schriftlicher Erlaubnis.

**Bewertung:**
- ✅ Maximale Kontrolle über Weitergabe, Modifikation und kommerzielle Nutzung
- ✅ Einfaches Lizenzmodell für einzelne Schulen oder Schulträger
- ❌ Keine Förderung von Wiederverwendung oder Community-Beitrag
- ❌ Hürden für Publikation von Forschungsergebnissen
- ❌ Schwerer zu handhaben bei mehreren Schulträgern

**Eignung:** Wenn das System nur als Hosted Service unter strikter Kontrolle ausgegeben wird oder an eine einzelne Schuleinrichtung gebunden bleibt.

---

### 2. EUPL-1.2 (European Union Public Licence)

**Modell:** Copyleft; für EU-Kontexte optimiert; Weitergabe nur unter EUPL-1.2.

**Bewertung:**
- ✅ EU-rechtliche Auslegung (DSGVO-kompatibel, deutsche Jurisdiktion)
- ✅ Starke Copyleft (Modifikationen müssen veröffentlicht werden)
- ✅ Vereinbar mit anderen Open-Source-Lizenzen (GNU, AGPL)
- ✅ Transparenz für Schulen und Datenschutzbehörden
- ❌ Wirtschaftlich: Copyleft hindert kommerzielle Anwendungen (SaaS)
- ❌ Weniger weit verbreitet als GPL/MIT
- ❌ Komplexe Versionskombinationen mit Dependencies

**Eignung:** Wenn Quellcodeoffenheit und europäische Transparenz im Schulkontext gewünscht sind, und kommerzielle Weitergabe bewusst ausgeschlossen sein soll.

---

### 3. AGPL-3.0 (GNU Affero General Public Licence)

**Modell:** Starker Copyleft; erzwingt Offenlegung auch für SaaS/Hosted Nutzung.

**Bewertung:**
- ✅ Copyleft auch für Netzwerk-Services (SaaS-Klausel)
- ✅ Zwingt Modifikationen auf den Tisch, auch wenn nicht weitergegeben
- ✅ Passt zu "Local-first"-Prinzip (Schulen kontrollieren Instanz)
- ❌ Extrem restriktiv für Cloud-Anbieter und Plugins
- ❌ Hohe rechtliche Unsicherheit in proprietären Ökosystemen
- ❌ Dependencies unter permissiver Lizenz erzeugen Konflikte

**Eignung:** Wenn das System bewusst quelloffen gestaltet werden soll, Schulen die Kontrolle über ihre Instanz haben und Modifikationen transparent bleiben müssen.

---

### 4. MIT oder Apache-2.0 (Permissiv)

**Modell:** Minimal Restrictions; Weitergabe, Modifikation und kommerzielle Nutzung erlaubt.

**Bewertung:**
- ✅ Maximal flexibel für Schulen, Forschung und kommerzielle Anpassungen
- ✅ Einfach zu verstehen und zu kombinieren
- ✅ Industriestandard; geringes rechtliches Risiko
- ✅ Fördert Ökosystem und Forks
- ❌ Keine Verpflichtung zur Offenlegung von Modifikationen
- ❌ Kommerzielle Konkurrenten können System nutzen und geschlossen halten
- ❌ Weniger Transparenz für Schulen, wenn Anbieter modifiziert haben

**Eignung:** Wenn maximale Adoption und akademische Freiheit das Ziel sind, und Kontroll-/Transparenz-Anforderungen kleiner sind.

---

## Entscheidungskriterien

| Kriterium | Ausprägung | Konsequenz |
|---|---|---|
| **Self-Hosting oder Cloud-Service?** | Schulen betreiben lokal oder selbst gehostet | → AGPL/EUPL (Local-first erzwingt Transparenz) |
| | Zentraler SaaS-Betrieb durch Anbieter | → Proprietär oder MIT (Copyleft zu restriktiv) |
| **Weiterverbreitung an andere Schulen geplant?** | Ja; Quelloffenheit gewünscht | → AGPL/EUPL |
| | Nein; oder geschlossen halten | → Proprietär oder MIT |
| **Datenschutz und Transparenz** | Schulbehörden/Datenschutzbehörden verlangen Einsicht | → AGPL/EUPL |
| | Intern zwischen Schulträger und Anbieter geklärt | → Proprietär oder MIT |
| **Kommerzielle Spielräume** | Angebot an Schulträger gegen Gebühr OK | → MIT/Apache (permissiv für Dienstleister) |
| | Kein kommerzieller Mehrwert geplant | → AGPL/EUPL oder Proprietär |
| **Abhängigkeiten und Stack** | Node.js/Python/Go mit vielen AGPL-Dependencies | → AGPL/EUPL (ohnehin kompatibel) |
| | Proprietäre oder streng lizenzierte Dependencies | → MIT/Apache (weniger Konflikte) |

---

## Nächste Schritte

1. **Stakeholder-Abstimmung** (Schulen, Schulträger, Datenschutz)  
   - Wünschen sich Schulen Quelloffenung und Recht auf Änderung?
   - Gibt es Datenschutzbehörden-Anforderungen?

2. **Rechtsabteilung / DSFA-Konsultation**  
   - Passt die Lizenz zur geplanten Betriebsform (SaaS vs. Self-Hosted)?
   - Welche Auswirkungen auf AVV (Auftragsverarbeitungsvertrag)?

3. **Implementierungspfad definieren**  
   - Wenn AGPL/EUPL: Dependencies prüfen, Copyleft-Compliance dokumentieren.
   - Wenn Proprietär: Lizenztext und Nutzungsbedingungen vorbereiten.
   - Wenn MIT/Apache: Lizenzheader in alle Quellen eintragen.

4. **Entscheidung und Dokumentation**  
   - Diese Datei aktualisieren mit finaler Entscheidung, Datum und Rationale.
   - LICENSE-Datei ins Repository committen.
   - Hinweis in [README.md](README.md) aktualisieren.

---

## Verweise

- **[README.md](README.md)** — Projektübersicht
- **[PLAN.md](PLAN.md)** — Scope und Roadmap
- **[docs/security/DATA_PROTECTION.md](docs/security/DATA_PROTECTION.md)** — Datenschutzvorkehrungen und Rechtsgrundlagen
- **[docs/operations/GITHUB_SETUP.md](docs/operations/GITHUB_SETUP.md)** — Prozesse und Governance
