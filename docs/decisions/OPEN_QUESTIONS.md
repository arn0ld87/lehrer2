# Entscheidungen (Sek II, Konfessionalität, Ethik, Pseudonymie, Rollen, Lehrplankonflikte)

> **Stand 2026-06-22:** Alle sechs zuvor offenen Fragen sind im Zuge des M0-Abschlusses entschieden. Engineering-Defaults (Fragen 1, 2, 3, 6) sind verbindlich; die rechts-/governance-kritischen Festlegungen (Fragen 4, 5) gelten als konservative MVP-Defaults **vorbehaltlich Stakeholder-/DSFA-Bestätigung** und sind als solche markiert. Diese Datei dokumentiert die Herleitung; die architektonisch signifikanten Entscheidungen sind zusätzlich als ADR fixiert.

## Übersicht

| #   | Frage                           | Entscheidung (gewählte Option)                                              | Fixiert in      | Status                                |
| --- | ------------------------------- | --------------------------------------------------------------------------- | --------------- | ------------------------------------- |
| 1   | Sek-II-Modellierung / MVP-Scope | MVP nur Sek I (Kl. 5–10); Schema bleibt für Sek II vorwärtskompatibel       | ADR 0006        | Entschieden (Scope-Bestätigung offen) |
| 2   | Konfessionsstrang               | Dritter Strang `KONFESSIONSSENSIBEL_UEBERGREIFEND`, keine duale Indexierung | ADR 0006        | Entschieden                           |
| 3   | Ethik                           | Eigenes `Subject.ETHIK`, nicht Modus von Religion                           | ADR 0006        | Entschieden                           |
| 4   | Pseudonym-Retention             | Delayed Deletion (12-Monats-Fenster) + Vorrang Art.-17-Antrag               | ADR 0009        | Entschieden (DSFA-Vorbehalt)          |
| 5   | Freigaberolle / Cloud im MVP    | Kein Cloud-LLM im MVP (nur Ollama); keine unbegrenzte Admin-Override-Macht  | ADR 0002 + 0004 | Entschieden (MVP-Default)             |
| 6   | Lehrplan-Versionskonflikte      | Nicht raten — Konflikt dokumentieren (`SourceConflict` + Maintainer-Review) | ADR 0003        | Entschieden                           |

---

## 1. Sekundarstufe II: GradeBand-Modellierung und MVP-Umfang

### Frage

Wie sollen Klassen 11 und 12 (Sek II) im System modelliert werden — als `GradeBand`-Entität im Curriculum, oder als separate konzeptionelle Schicht (z.B. Kurshalbjahre mit Kurswahl)? Ist Sek II überhaupt MVP-relevant?

### Kontext

- **Spec**: "Schüler Klasse 5–12"
- **Curriculummodell** (DATA_MODEL): `SchoolStage` kennt `SEK_I` (5–10) und `SEK_II`; `GradeBand` hat `KS5`–`KS10` sowie Kurshalbjahre (z.B. `Q1_HJ1`) für Sek II.
- Sek II ist in Sachsen-Anhalt kurs-/halbjahresorganisiert, nicht jahrgangsbezogen.

### Optionen

1. **MVP nur Kl. 5–10** — Sek II später; Schema kennt `SEK_II`, MVP nutzt es nicht produktiv.
2. **Sek II ab MVP mit vereinfachtem Modell** — Kurshalbjahre nur für Read/Matching.
3. **Separate Sek-II-Schicht** — eigene Enrollment-Logik; doppelte Curriculum-Logik.

### Entscheidung

**Option 1 — MVP nur Sek I (Kl. 5–10); `SchoolStage.SEK_II` + Kurshalbjahres-Bänder bleiben im Schema vorgesehen, werden im MVP aber nicht befüllt/ausgewertet.** Fixiert in **ADR 0006**.

### Status

**Entschieden, 2026-06-22.** Nicht blockierend offen: Bestätigung des MVP-Schnitts mit der Pilotschule (Werden Sek-II-Schüler parallel unterrichtet?). Sek-II-Ausbau erhält ein eigenes ADR, sobald Lehrpläne kuratiert vorliegen.

---

## 2. Konfessionalität: KONFESSIONSSENSIBEL_UEBERGREIFEND als eigener dritter Strang

### Frage

Sollen "konfessionsübergreifend"/"ökumenisch" aufbereitete Materialien einen eigenen `confessionContext`-Wert bekommen, oder dual unter `EVANGELISCH` und `KATHOLISCH` indexiert werden?

### Kontext

- **Invariante**: Religion ist strikt getrennt (evangelisch/katholisch/konfessionssensibel-übergreifend/Ethik).
- `DATA_MODEL` führt `KONFESSIONSSENSIBEL_UEBERGREIFEND` bereits als eigenen `ConfessionContext`-Wert.

### Optionen

1. **Dritter Strang `KONFESSIONSSENSIBEL_UEBERGREIFEND`** — ein Dokument, ein Index-Eintrag.
2. **Duale Indexierung** — separate Einträge für ev. und kath.; redundant.
3. **Hybrid** — übergreifend als primär + `applicable_confessions`-Flag.

### Entscheidung

**Option 1 — dritter Strang, keine duale Indexierung.** Retrieval-Regel: ev./kath. Anfragen dürfen `KONFESSIONSSENSIBEL_UEBERGREIFEND` einbeziehen, aber nie direkt zwischen ev. und kath. aggregieren. Fixiert in **ADR 0006**.

### Status

**Entschieden, 2026-06-22.**

---

## 3. Ethik als eigenes Subject vs. Religion-Modus

### Frage

Ist Ethik ein eigenständiges Fach oder ein Modus/Perspektive von Religion?

### Kontext

- **DATA_MODEL**: `Subject` enthält `DEUTSCH`, `RELIGION`, `ETHIK`; CHECK-Constraint bindet `ETHIK` an `confessionContext ∈ {RELIGIONSKUNDLICH, NICHT_ANWENDBAR}`.
- In Sachsen-Anhalt ist Ethik die Wahlalternative zum konfessionellen Religionsunterricht.

### Optionen

1. **Ethik als eigenes Subject** — eigener Lehrplan, philosophisch statt theologisch.
2. **Ethik als Religion-Modus** — über `confessionContext`.
3. **Beide** — Subject + religionskundlicher Modus.

### Entscheidung

**Option 1 — `Subject.ETHIK` eigenständig.** Religionskundliche Betrachtung bleibt als `confessionContext = RELIGIONSKUNDLICH` abbildbar, ohne Ethik an Religion zu koppeln. Fixiert in **ADR 0006**.

### Status

**Entschieden, 2026-06-22.**

---

## 4. Pseudonym-Stabilität vs. Recht auf Vergessenwerden

### Frage

Wie lange bleibt das Mapping `pseudonym_id → Klarname` erhalten? Können Schüler die Pseudonymisierung zurücksetzen? Wie werden alte Mappings gelöscht?

### Kontext

- **Invariante**: Klarnamen verlassen das System im Normalbetrieb nie; Mapping nur in SecureEnclave/HSM (Schulleitung).
- DSGVO Art. 17; `SENSITIVE_STUDENT`-Retention in DATA_MODEL: „pro Schuljahr + 1 Jahr Archiv".

### Optionen

1. **Strict Forget** — sofortige, irreversible Löschung bei Austritt.
2. **Delayed Deletion** — Archivfenster (z.B. 12 Monate), dann Löschung.
3. **Stable Pseudonym** — irreversibel gebunden, kein Reset.

### Entscheidung

**Option 2 — Delayed Deletion mit 12-Monats-Archivfenster ab Austritt; ein expliziter Art.-17-Löschantrag hat Vorrang (sofortige, irreversible Löschung).** Pseudonym ist während der Zugehörigkeit stabil. Fixiert in **ADR 0009**.

### Status

**Entschieden als MVP-Default, 2026-06-22 — DSFA-Vorbehalt.** Finale Frist und Rechtsgrundlage sind durch Datenschutz-Folgenabschätzung/Datenschutzbeauftragte zu bestätigen, bevor mit echten Daten gearbeitet wird.

---

## 5. Freigaberolle Fachkonferenz/Schuladmin: Übergangsstrategie

### Frage

Spezifikation sieht später `Fachkonferenz` und `Schuladmin` vor. Wie wird bis dahin mit Freigaben (CloudReleaseGrant, Curriculumfreigabe) umgegangen?

### Kontext

- **MVP**: nur `Teacher` und `Admin`.
- **Frage**: Darf `Admin` automatisch Freigaben erteilen, oder braucht es ein explizites Schulleitungs-Signal?

### Optionen

1. **Admin overrides vorerst** — Admin erhält Fachkonferenz-/Schuladmin-Rechte bis Ausbau.
2. **Kein CloudReleaseGrant im MVP** — Cloud-LLM erst mit Fachkonferenz-Rollenmodell; MVP = nur Ollama.
3. **Hybrid** — Admin begrenzt; CloudReleaseGrant nur mit signiertem Schulleitungs-Mailflow.

### Entscheidung

**Option 2 — im MVP kein Cloud-LLM (nur lokales Ollama), keine unbegrenzte Admin-Override-Macht.** Sauberer Schnitt ohne Übergangskomplexität; deckt sich mit Local-first (ADR 0004) und der provider-agnostischen Schicht (ADR 0002). `CloudReleaseGrant` wird erst mit dem Fachkonferenz-/Schuladmin-Rollenmodell aktiviert.

### Status

**Entschieden als MVP-Default, 2026-06-22.** Geschäftsanforderung bei Bedarf mit Schulleitung verifizieren (ist lokales Ollama für den Pilot ausreichend?). Rollenausbau siehe Rollen-/Mandanten-Issue (M4).

---

## 6. Umgang mit widersprechenden/mehrfachen Lehrplanfassungen

### Frage

Was tun, wenn zwei Quellen/Versionen widersprüchliche curriculare Anforderungen für dasselbe Thema enthalten?

### Kontext

- **Invariante (RAG)**: curriculare Aussagen müssen `OFFICIAL_BINDING` belegt sein.
- Verschiedene Editionsjahre einer Lehrplanserie können Widersprüche enthalten.

### Optionen

1. **Nicht raten — Konflikt dokumentieren** — `SourceConflict`-Record + Maintainer-Issue; Aussage als unklar markieren, bis gelöst.
2. **Gewichtung nach Quelle/Aktualität** — neuere/höherrangige Quelle gewinnt automatisch.
3. **Permissive Mode** — beide Belege mit Hinweis anzeigen.

### Entscheidung

**Option 1 — Konflikt dokumentieren, nicht raten.** Erkannte Widersprüche zwischen `OFFICIAL_BINDING`-Quellen erzeugen einen `SourceConflict`-Record und ein Maintainer-Review; die betroffene Aussage wird nicht stillschweigend aufgelöst. Konsistent mit der Source-Governance aus **ADR 0003**; Umsetzungsdetails in der Ingestion-/Quellenpolicy.

### Status

**Entschieden, 2026-06-22.** Redaktioneller Prozess (Maintainer-Team priorisiert Konflikte) wird mit der Quellenverwaltung (M2) konkretisiert.

---

## Verweise

- [PLAN.md](../../PLAN.md) — Projekt-Meilensteine und Roadmap.
- [ADR 0006](../adr/0006-curriculum-modeling.md) — Curriculum-Modellierung (Fragen 1–3).
- [ADR 0009](../adr/0009-pseudonym-retention.md) — Pseudonym-Retention (Frage 4).
- [ADR 0002](../adr/0002-provider-agnostic-llm-layer.md), [ADR 0004](../adr/0004-local-first-student-data.md) — Cloud-/Local-first (Frage 5).
- [ADR 0003](../adr/0003-source-governance-before-ingestion.md) — Source-Governance (Frage 6).
- [DATA_PROTECTION.md](../security/DATA_PROTECTION.md) — Datenschutz, Pseudonymisierung, Retention.
- [CITATION_STANDARD.md](../rag/CITATION_STANDARD.md) — Zitationsstandard (Fragen 1, 6).
- [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) — System-Ebenenmodell und Rollen.
