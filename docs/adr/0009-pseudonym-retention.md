# 0009: Pseudonym-Stabilität und Mapping-Löschung (DSGVO Art. 17)

## Status

Akzeptiert als MVP-Default, 2026-06-22 — **vorbehaltlich Bestätigung durch DSFA / schulischen Datenschutzbeauftragten**.

> Dieses ADR fixiert einen konservativen Engineering-Default, damit M3 (Korrektur/Pseudonymisierung) nicht blockiert. Die finalen Aufbewahrungsfristen und die Rechtsgrundlage sind durch die Datenschutz-Folgenabschätzung und die Schulleitung verbindlich festzulegen. Dies ist keine Rechtsberatung.

## Kontext

Konsolidiert [OPEN_QUESTIONS.md](../decisions/OPEN_QUESTIONS.md) Frage 4.

- **Invariante** (DATA_MODEL, AGENTS.md): Schülerklarnamen verlassen das System im Normalbetrieb nie; nur `pseudonym_id` wird persistiert und an LLMs übertragen. Das Mapping `pseudonym_id ↔ Klarname` liegt ausschließlich in einer SecureEnclave/HSM-Grenze unter Kontrolle der Schulleitung.
- **Spannungsfeld**: DSGVO Art. 17 (Recht auf Vergessenwerden) vs. legitimes Audit-Interesse (Nachvollziehbarkeit, wer welche Korrektur verantwortet) vs. Datensparsamkeit.
- DATA_MODEL klassifiziert Schülerdaten als `SENSITIVE_STUDENT` mit Retention „pro Schuljahr + 1 Jahr Archiv".

## Entscheidung

**Delayed Deletion mit 12-Monats-Archivfenster** (OPEN_QUESTIONS Frage 4, Option 2), mit fail-safe Vorrang des Löschantrags:

1. **Stabiles Pseudonym während Zugehörigkeit**: `pseudonym_id` bleibt für die Dauer der Schul-/Kurszugehörigkeit stabil (kein Reset im Normalbetrieb), damit Lernverläufe und Audit konsistent bleiben.
2. **Archivfenster nach Austritt**: Nach dokumentiertem Schul-/Kursaustritt wird das Mapping höchstens **12 Monate** aufbewahrt (Audit-Zweck) und danach automatisiert und unwiederbringlich gelöscht. Die Frist orientiert sich am Austrittsdatum, nicht am letzten Aktivitätszeitpunkt.
3. **Vorrang des Art.-17-Antrags (fail-safe)**: Ein expliziter Löschantrag löst die sofortige, irreversible Löschung des Mappings aus und hat **Vorrang** vor dem Archivfenster. Nach Löschung ist `pseudonym_id` nicht mehr auf einen Klarnamen rückführbar.
4. **Re-Pseudonymisierung nur bei Incident**: Ein Neu-Mapping erfolgt ausschließlich bei dokumentiertem Datenschutzvorfall, nicht als Routinevorgang.

## Wichtigste Gegenstimmen (dokumentiert)

- **Strict Forget (sofortige Löschung bei Austritt)**: maximal datensparsam, aber zerstört den Audit-Trail (z. B. Rückfragen zu vergangenen Korrekturen) und ist betrieblich fehleranfällig bei versehentlichen Austritten. Das Art-17-Recht bleibt über Punkt 3 dennoch vollständig gewahrt.
- **Stabiles Pseudonym ohne Löschung**: einfachste Implementierung, verstößt aber gegen Art. 17 — abgelehnt.

## Konsequenzen

### Positiv

- DSGVO-konformer Default mit erfüllbarem Audit-Interesse; Art-17-Antrag jederzeit fail-safe bedienbar.
- Klare, testbare Löschfristen — auditierbar über die SQL-transparenten Deletes aus ADR 0005.

### Umzusetzen / Folgepunkte

- **Automatisierter Löschjob** für abgelaufene Archivfenster; Lösch-Vorgänge protokolliert (Audit-Log, keine Klarnamen).
- Fristen und Rechtsgrundlage in [DATA_PROTECTION.md](../security/DATA_PROTECTION.md) und [RETENTION_AND_DELETION.md](../security/RETENTION_AND_DELETION.md) verbindlich verankern (Konsistenz mit „SENSITIVE_STUDENT: +1 Jahr Archiv").
- **DSFA-Vorbehalt**: finale Frist (12 Monate ist Vorschlag) und Rechtsgrundlage durch Datenschutzbeauftragte bestätigen, bevor produktiv mit echten Daten gearbeitet wird.

## Verweise

- [../decisions/OPEN_QUESTIONS.md](../decisions/OPEN_QUESTIONS.md) — Frage 4 (jetzt entschieden, mit Vorbehalt).
- [../security/DATA_PROTECTION.md](../security/DATA_PROTECTION.md) — Pseudonymisierung, Retention, DSGVO.
- [../security/RETENTION_AND_DELETION.md](../security/RETENTION_AND_DELETION.md) — Löschkonzept, Fristen.
- [../architecture/DATA_MODEL.md](../architecture/DATA_MODEL.md) — `pseudonym_id`, `SENSITIVE_STUDENT`, Fail-Closed-Redaction.
- [0004-local-first-student-data.md](./0004-local-first-student-data.md) — Local-first-Verarbeitung von Schülerdaten.
- DSGVO Art. 17 (Recht auf Vergessenwerden).
