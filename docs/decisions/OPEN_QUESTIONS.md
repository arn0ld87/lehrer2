# Offene Entscheidungen (Sekundärklasse II, Konfessionalität, Ethik, Pseudonymie, Rollen, Lehrplankonflikte)

## 1. Sekundarstufe II: GradeBand-Modellierung und MVP-Umfang

### Frage

Wie sollen Klassen 11 und 12 (Sek II) im System modelliert werden — als `GradeBand`-Entität im Curriculum, oder als separate konzeptionelle Schicht (z.B. Kurshalbjahre mit Kurswahl)? Ist Sek II überhaupt MVP-relevant?

### Kontext

- **Spec**: "Schüler Klasse 5–12"
- **Curriculummodell** (RAG_ARCHITECTURE): Lehrpläne liegen für Klassen 5–10 vor (bundeslandabhängig, z.B. Bayern 5-10 Realschule).
- Sek II ist in den meisten Bundesländern Kurs-organisiert (Halbjahrssystem, Wahlfachmodule), nicht Klassenstufen.
- Bisherige Annahme: MVP fokussiert auf Klasse 5–10.

### Optionen

1. **MVP nur Kl. 5–10** — Sek II später (z.B. v1.2). Curriculum sieht 11/12 als `grade_band: null` oder `excluded: true`.
2. **Sek II ab MVP mit vereinfachtem Modell** — Kurs-Halbjahrssystem in DATA_MODEL als optional abbilden, aber nur für Read/Matching, nicht für Zuordnung im Student.
3. **Separate Sek-II-Schicht** — Klasse 5–10 = `StudentEnrollment.grade_band`, Sek II = `StudentEnrollment.course_enrollment` (neuer Type). Erfordert doppelte Curriculum-Logik.

### Vorschlag

**Option 1 (MVP 5–10, Sek II später).** Einfacher, keine konzeptionellen Komplikationen für MVP. Curriculum sieht Lehrpläne 5–10 vor, grade_band 11–12 im System erlaubt, aber Funktionalität (Filter, Empfehlungen, Korrekturmodelle) nur für 5–10. Sek-II-Lehrpläne später ingesten wenn nachgelagerte Anforderung kommt.

### Status

**Offen.** Klärung mit Stakeholder Lehrkräfte (Schule vor Ort) erforderlich: Werden Sek-II-Schüler parallel mit 5–10 unterrichtet? Ist das System nur für Unterstufe gedacht oder vom Anfang schulübergreifend?

### Zugehöriges Issue

`#DECISION-001-sek-ii-scope` (Maintainer: zu öffnen)

---

## 2. Konfessionalität: CONFESSIONALLY_OPEN als eigener dritter Strang

### Frage

Sollen Materialien, die "konfessionsübergreifend" oder "ökumenisch" aufbereitet sind, einen eigenen `confession_context`-Wert bekommen (z.B. `CONFESSIONALLY_OPEN`), oder sollten sie dual unter `EVANGELICAL` und `CATHOLIC` indexiert werden?

### Kontext

- **Invariante**: Religion ist strikt getrennt (evangelisch/katholisch/konfessionsübergreifend/Ethik).
- Viele Materialien (z.B. ökumenisches Schulbuch, Gemeinschaftswerk) sind bewusst beide Konfessionen abdeckend.
- Frage: Werden diese als _ein_ Dokument mit `confession_context: CONFESSIONALLY_OPEN` indiziert, oder als zwei separate Indexierungen (eine für ev., eine für kath.)?

### Optionen

1. **Dritter Strang: `CONFESSIONALLY_OPEN`** — Ein Dokument, ein Index-Eintrag. Query für ev. UND kath. Schüler gibt es zurück. Klare konzeptionelle Trennung, kein Duplizieren.
2. **Duale Indexierung** — Dokument mit `EVANGELICAL` und `CATHOLIC` als separate `SourceRef`-Einträge. Ermöglicht granulare Kontrollierbarkeit, aber redundant.
3. **Hybrid**: `CONFESSIONALLY_OPEN` als primär, aber mit `applicable_confessions: ["EVANGELICAL", "CATHOLIC"]` Flag für explizite Aufzählung.

### Vorschlag

**Option 1 oder 3 (eher Option 1).** Dritter Strang ist semantisch klarer und verhindert "Vermischung" in der Invariante. Query-Layer muss aber sicherstellen, dass Lehrkraft ev./kath. auch `CONFESSIONALLY_OPEN`-Materialien sieht (nicht nur die je eigene Konfession).

### Status

**Offen.** Bestätigung mit Schuladmin erforderlich: Wird der Schulrahmen (Konfessionalität des Unterrichts) auf Kursebene vorgegeben, sodass ein System "weiß", dass hier ev. UND kath. Material relevant ist?

### Zugehöriges Issue

`#DECISION-002-confessional-strands` (Maintainer: zu öffnen)

---

## 3. Ethik als eigenes Subject vs. Religion-Modus

### Frage

Ist Ethik ein **eigenständiges Fach** (wie Mathematik, Deutsch) oder ein **Modus/Perspektive von Religion** (religionskundlich-ökumenisch)?

### Kontext

- **Aktuelles Modell**: `subject: Enum` mit Werten wie `MATHEMATICS`, `GERMAN`, `RELIGION_EVANGELICAL`, `RELIGION_CATHOLIC`, `ETHICS`.
- In vielen Bundesländern ist "Ethik" die Wahlalternative zu konfessionellem Religionsunterricht (KMK-Länderspiegel).
- Frage: Gehört Ethik zur `confession_context`-Dimension oder zu einer separaten `Subject`-Dimension?

### Optionen

1. **Ethik als eigenes Subject** — `subject: ETHICS`, `confession_context: NONE`. Lehrplan für Ethik ≠ Lehrplan für Religion.
2. **Ethik als Religion-Modus** — `subject: RELIGION`, `confession_context: ETHICS`. Kennzeichnet "konfessionslose" religiöse Bildung (Religionswissenschaft, Vergleich).
3. **Beide** — Ethik kann als own Subject _und_ als `RELIGIOUS_STUDIES` (separater confession_context) dienen.

### Vorschlag

**Option 1 (Ethik = eigenes Subject).** Ethik hat eigene Lehrpläne (meist KMK-harmonisiert), oft andere Inhalte (Philosophie statt Theologie). Praktisch einfacher zu queryin und zu filtern. `RELIGIOUS_STUDIES`-Modus für Material, das Religion wissenschaftlich behandelt (unabhängig von Fach).

### Status

**Offen.** Klärung mit Schuladmin/Schulleiter erforderlich: Werden Schüler _alternativ_ zu Religionsunterricht in Ethik unterrichtet, oder parallel als Philosophie-Ergänzung?

### Zugehöriges Issue

`#DECISION-003-ethics-subject` (Maintainer: zu öffnen)

---

## 4. Pseudonym-Stabilitäät vs. Recht auf Vergessenwerden

### Frage

Wie lange bleibt die Mapping-Tabelle `Student.anonymous_id → Student.first_name + Student.last_name` erhalten? Können Schüler ihre Pseudonymisierung "zurücksetzen" (neue ID bei Umschüler, Schulwechsel)? Wie werden alte Mappings gelöscht?

### Kontext

- **Invariante**: Schülernamen verlassen das System im Normalbetrieb nie; nur Pseudonym wird an LLM übertragen.
- `Student.created_at` und `Student.deleted_at` sind tracking-relevant für DSGVO (Löschfristen).
- **Frage**: Wenn ein Schüler die Schule verlässt oder das System verlässt, wird die Mapping-Tabelle sofort gelöscht (strict forget), oder nach X Monaten (Archivierungsfenster)?

### Optionen

1. **Strict Forget (DSGVO Art. 17)** — Bei Löschantrag (z.B. Schulaustritt) wird Mapping sofort gelöscht. Unmapping von pseudo_id zu Name ist irreversibel.
2. **Delayed Deletion (Archivierungsfenster)** — Mapping wird nach Schulaustritt archiviert (z.B. 12 Monate Aufbewahrung für Audit), dann gelöscht.
3. **Stable Pseudonym** — Mapping ist irreversibel an Student gebunden (kein Zurücksetzen); Re-Pseudonymisierung nur bei Datenschutz-Incident.

### Vorschlag

**Option 2 (Delayed Deletion mit 12-Monat-Fenster).** DSGVO-konform, erlaubt Audit-Trail für Lehrkräfte (z.B. "Wer hat X Schüler korrigiert?"), löscht aber dann komplett. Retention Policy in DATA_PROTECTION dokumentieren.

### Status

**Offen.** Klärung mit Datenschutzbeauftragter/Schulleitung erforderlich: Archivierungsfenster basiert auf Schul-Abmeldedatum oder auf Aktivitätsfenster?

### Zugehöriges Issue

`#DECISION-004-pseudonym-retention` (Maintainer: zu öffnen)

---

## 5. Freigaberolle Fachkonferenz/Schuladmin: Übergangsstrategie

### Frage

Spezifikation sieht Rollen `Lehrkraft`, `Admin` vor und später `Fachkonferenz` und `Schuladmin`. Wie wird bis dahin mit Freigaben (z.B. CloudReleaseGrant, Curriculumfreigabe) umgegangen?

### Kontext

- **MVP**: Nur `Teacher` und `Admin` sind implementiert.
- **Später**: `FachkonferenzVorsitz` (= Lehrkraft mit Entscheidungskompetenz auf Fachebene), `Schuladmin` (= Schulleitung mit System-Governance).
- **Frage**: Übergangsregel bis dahin — darf `Admin` automatisch Freigaben erteilen, oder braucht es vorher explizites "Signal" von Schulleiter?

### Optionen

1. **Admin overrides vorerst** — `Admin`-Role enthält Rechte für `FachkonferenzVorsitz` und `Schuladmin` bis MVP erweitert wird.
2. **No CloudReleaseGrant im MVP** — Cloud-LLM erst freischalten wenn Fachkonferenz-Rollenmodell implementiert ist; MVP = Ollama nur.
3. **Hybrid: Admin begrenzter Umfang** — `Admin` darf Freigaben für schulinterne Materialien erteilen, aber CloudReleaseGrant muss explizit vom Schulleiter signiert sein (Mailflow, manuell).

### Vorschlag

**Option 2 (Cloud-LLM im MVP nicht freigegeben).** Sauberer Schnitt: MVP = Ollama (lokal), CloudReleaseGrant erst mit Fachkonferenz-Rollup in v1.1. Keine Übergangs-Komplexität, keine unbegrenzte Admin-Macht.

### Status

**Offen.** Geschäftsanforderung mit Schulleitung klären: Ist lokale LLM (Ollama) für MVP ausreichend, oder ist Cloud-Anbindung Blockierungskriterium?

### Zugehöriges Issue

`#DECISION-005-freigabe-transition` (Maintainer: zu öffnen)

---

## 6. Umgang mit widersprechenden/mehrfachen Lehrplanfassungen

### Frage

Was tun, wenn zwei Bundesländer (oder Versionen einer Lehrplan-Serie) widersprüchliche Anforderungen für dasselbe Thema haben — z.B. "Funktionen ab Klasse 7" vs. "Funktionen ab Klasse 8"?

### Kontext

- **Invariante (RAG)**: Aussagen mit Lehrplan-Anspruch müssen `OFFICIAL_BINDING` belegt sein.
- Bundesländer haben unterschiedliche Lehrpläne; verschiedene Editions-Jahre eine Quelle können Widersprüche enthalten.
- **Frage**: Soll das System auf "beste Vermutung" (z.B. "meistens Klasse 7") hinarbeiten oder Konflikte dokumentieren und für Maintainer-Review blocken?

### Optionen

1. **Nicht raten — Konflikt dokumentieren** — Wenn Widerspruch erkannt wird (z.B. zwei `OFFICIAL_BINDING`-Quellen sagen unterschiedliches), wird ein `SourceConflict`-Record erstellt + Maintainer-Issue geöffnet. Aussage wird als `UNSUPPORTED_DRAFT` markiert bis Konflikt gelöst.
2. **Gewichtung nach Quelle/Aktualität** — Lehrplan Bayern 2021 > Bayern 2015 > Bundeszentralamt Vorlage. Beleg mit höherem Gewicht gewinnt.
3. **Permissive Mode: beide anzeigen** — System zeigt beide Belege mit Hinweis "Quelle A sagt X, Quelle B sagt Y".

### Vorschlag

**Option 1 (Konflikt dokumentieren).** Verhindert stille Fehler und erfordert explizite Entscheidung durch Experte (Fachkonferenz, Lehrplan-Autor). Mit SourceConflict-Tracking leicht zu Audit + Lösung.

### Status

**Offen.** Redaktionelle Strategie klären: Wird ein Maintainer-Team Konflikte knüpfen/priorisieren, oder soll es automatische Heuristik geben?

### Zugehöriges Issue

`#DECISION-006-lehrplan-conflicts` (Maintainer: zu öffnen)

---

## Verweise

- [PLAN.md](../../PLAN.md) — Projekt-Meilensteine und Roadmap.
- [DATA_PROTECTION.md](../security/DATA_PROTECTION.md) — Datenschutz, Pseudonymisierung, Retention.
- [CITATION_STANDARD.md](../rag/CITATION_STANDARD.md) — Zitationsstandard für Quellenbelege (Entscheidung 1, 6).
- [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) — System-Ebenenmodell und Rollen.
