# Aufbewahrung und Löschung — LSA (Unterrichtsassistenz)

Dieses Dokument definiert Aufbewahrungsgrundsätze, Aufbewahrungsfristen je Datenklasse und kaskadierende Löschungsmechanismen über PostgreSQL, Qdrant und Object Store (MinIO). Zweck: DSGVO-Compliance (Art. 5 Datensparsamkeit, Art. 17 Recht auf Vergessenwerden, Art. 35 DSFA) und Sicherheit durch Datenminimierung.

---

## Aufbewahrungsgrundsätze

### Datenminimierung

Nur Daten speichern, die unmittelbar sachlich notwendig sind:

- **Lehrkraft-Daten:** Name, E-Mail, Authentifizierung, Klassen-Zuordnung
- **Schülerarbeits-Daten:** Arbeits-Inhalt, Feedback, Bewertungen (für Unterrichtsdauer + eine Periode danach)
- **Metadaten:** Timestamps, Audit Logs (für Compliance-Kontrolle, begrenzte Dauer)
- **Keine:** Browsingverlauf, Fehler-Messages mit Kontext, Entwürfe

### Zweckbindung

Daten werden nur für den dokumentierten Zweck verarbeitet:

- Schülerarbeiten → Feedback + Bewertung im Unterricht
- Lehrplan-Quellen → Kontextualisierung in RAG
- Audit Logs → Sicherheits- und Compliance-Kontrolle
- **Kein Zweck:** Training von MLs (außer mit expliziter Schulfreigabe + AVV)

### Verarbeiter-Prinzip

- **Lehrkraft** = Verantwortlicher (Datenverantwortung)
- **LSA-Betreiber** (Schule / IT-Admin) = gemeinsam Verantwortlicher
- **Cloud-Provider** (falls CloudReleaseGrant) = Auftragsverarbeiter (mit DPA)
- **Ollama-Instanz** (lokal) = Werkzeug ohne separate Verantwortung

---

## Aufbewahrungsfristen (je Datenklasse)

| Datenklasse                                 | Inhalt                                      | Aufbewahrungsfrist                                | Begründung                                                                                                            | Status                                                                                     |
| ------------------------------------------- | ------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `PERSONAL_TEACHER`                          | Lehrkraft-Profil, Login-Daten, Credentials  | Während aktiver Nutzung + 1 Jahr nach Kündigungen | Arbeitsrecht, Audit                                                                                                   | ✓ Zu definieren: Aufbewahrung nach Schulaustritt                                           |
| `INTERNAL`                                  | Admin-Logs, Audit Trails, Metadaten         | 7 Jahre                                           | Handelsrecht (HGB § 257), steuerliche Aufbewahrung                                                                    | ✓ Standard-Gesetzesfristen                                                                 |
| `SENSITIVE_STUDENT` — Arbeits-/Test-Inhalte | Schülertexte, Arbeiten, Feedback            | Während Schuljahr + 2 Schuljahre danach           | Noten-Archivierung (Schulgesetz Sachsen-Anhalt: mind. 2 Jahre); Lernfortschritt-Tracking über Schuljahre              | ⚠️ **Zu definieren:** Verständigung mit Schulleitung (abhängig von Lehrplan-Anforderungen) |
| `SENSITIVE_STUDENT` — Religion-Daten        | Religiöse Zugehörigkeit, Konfessionskennung | Schuljahr der Verarbeitung + 1 Jahr               | Art. 9 DSGVO (besondere Kategorie); Religion darf nicht über Schulaustritt hinaus erfasst sein                        | ⚠️ **Zu definieren:** Explizite Zustimmung Schulleitung + Eltern                           |
| `PUBLIC`                                    | Lehrplan-Texte (offiziell)                  | Zeitlich unbegrenzt (solange Lehrplan gültig)     | Unterrichtsmaterial; Änderung dokumentieren, alte Versionen archivieren                                               | ✓ Standard                                                                                 |
| `INTERNAL` — RAG-Quellen (User-Uploads)     | Von Lehrkraft hochgeladene Materialien      | 3 Jahre oder bis Widerruf                         | Lernmaterial-Archiv; Widerruf erlaubt Löschung sofort                                                                 | ⚠️ **Zu definieren:** Widerrufsfristen und -mechanik                                       |
| `INTERNAL` — Qdrant Vectors                 | Vektorisierte Texte (Embeddings)            | Synchron mit Quelltexten                          | Qdrant ist Derivat der Original-Daten; Vektoren ohne Text sind identifikationsrisiko-arm aber sollten gelöscht werden | ✓ Kaskadierend (siehe unten)                                                               |
| `INTERNAL` — Object Store (MinIO)           | Uploaded Dateien, OCR-Output                | Synchron mit `SENSITIVE_STUDENT`                  | Ablage von Arbeitsdateien                                                                                             | ✓ Kaskadierend                                                                             |
| `INTERNAL` — Audit & System Logs            | Login-Events, Fehler, Warnung               | 1–7 Jahre (abhängig von Log-Typ)                  | Sicherheit + Compliance; Logs mit PII nach 1 Jahr, Metadaten-Logs nach 7 Jahren                                       | ⚠️ **Zu definieren:** Log-Klassifikation + Tier-System                                     |

**Status-Legende:**

- ✓ = Richtung klar, Implementierung möglich
- ⚠️ = Offen; erfordert Schulleitung-Abstimmung oder Rechtsprüfung

---

## Kaskadierende Löschung

### Anlass für Löschung

1. **Automatische Löschung nach Frist:** Cron-Job (`delete-retention-expired.sql`) läuft täglich um 02:00 UTC
2. **Widerruf (Art. 17 DSGVO):** Lehrkraft / Schüler / Eltern beantragen Vergessenwerden
3. **Fehlerhafte Verarbeitung:** Daten wurden ohne Autorisierung verarbeitet
4. **Schulaustritt:** Schüler / Lehrkraft tritt aus Schulleitung aus
5. **Policy-Änderung:** Schulleitung widerruft Cloud-LLM Freigabe

### Lösch-Workflow

```
Trigger: Lösch-Anforderung (automatisch oder manuell)
  ↓
[1. Pseudo-ID identifizieren]
  ↓ (falls Schüler)
[2. Alle Schülertexte in PostgreSQL markieren (is_deleted=true, deleted_at=now)]
  ↓
[3. Entsprechende Qdrant Vectors löschen (collection.delete(filter={pseudo_id}))]
  ↓
[4. Zugehörige Dateien in MinIO löschen (prefix=student/{pseudo_id})]
  ↓
[5. Pseudonym-Mapping-Eintrag anonymisieren/löschen (siehe Abschnitt 5)]
  ↓
[6. Audit Log: DELETE-Event schreiben (what=student_data, pseudo_id, reason, timestamp)]
  ↓
[7. DSB + Schulleitung benachrichtigen (falls manueller Widerruf)]
  ↓
Bestätigung an Lehrkraft / Schüler / Eltern
```

### Schritt-für-Schritt-Implementierung

#### (A) PostgreSQL — Soft-Delete

```sql
-- Schritt 1: Schülerdaten markieren
UPDATE student_work
SET is_deleted = true, deleted_at = NOW()
WHERE student_pseudo_id = ?
  AND is_deleted = false;

-- Schritt 2: Nach Aufbewahrungsfrist hard-delete (nach 30 Tagen grace period)
DELETE FROM student_work
WHERE is_deleted = true
  AND deleted_at < NOW() - INTERVAL '30 days';

-- Schritt 3: Audit Event
INSERT INTO audit_log (event_type, student_pseudo_id, deleted_at, reason)
VALUES ('STUDENT_DATA_DELETED', ?, NOW(), ?);
```

**Begründung:** Soft-Delete erlaubt Wiederherstellung in Grace Period; Hard-Delete nach 30 Tagen stellt sicher, dass Daten nicht wiederhergestellt werden können.

#### (B) Qdrant — Vektor-Löschung

```python
from qdrant_client import QdrantClient

# Schritt 1: Alle Vektoren mit dieser Pseudo-ID löschen
client = QdrantClient("localhost:6333")
client.delete(
    collection_name="student_embeddings",
    points_selector=models.FilterSelector(
        filter=models.Filter(
            must=[
                models.FieldCondition(
                    key="meta.student_pseudo_id",
                    match=models.MatchValue(value=pseudo_id),
                )
            ]
        )
    ),
)

# Schritt 2: Audit-Event
log_deletion("qdrant_deletion", pseudo_id, collection="student_embeddings")
```

#### (C) MinIO / Object Store — Datei-Löschung

```python
from minio import Minio

# Schritt 1: Alle Dateien mit prefix student/{pseudo_id} löschen
client = Minio("minio.local:9000", access_key, secret_key)
for obj in client.list_objects("student-uploads", prefix=f"student/{pseudo_id}"):
    client.remove_object("student-uploads", obj.object_name)

# Schritt 2: Audit-Event
log_deletion("minio_deletion", pseudo_id, bucket="student-uploads")
```

#### (D) Pseudonym-Mapping-Tabelle

```sql
-- PROBLEM: Pseudonym-Mapping (Klarname → Pseudonym) muss selbst gelöscht werden
-- aber darf nicht zu früh gelöscht werden (für Audit-Trails noch identifizierbar sein)

-- OPTION 1 (Empfohlen): Anonymisierung (kein echtes Löschen)
UPDATE pseudonym_mapping
SET student_name = '[ANONYMIZED]',
    anonymized_at = NOW()
WHERE student_pseudo_id = ?
  AND NOT anonymized;

-- OPTION 2 (Vollständig): Echtes Löschen nach Aufbewahrungsfrist
DELETE FROM pseudonym_mapping
WHERE student_pseudo_id = ?
  AND created_at < NOW() - INTERVAL '3 years';
```

**Offene Frage:** Siehe [../decisions/OPEN_QUESTIONS.md](../decisions/OPEN_QUESTIONS.md) — Wann genau wird Pseudonym-Mapping gelöscht? Aufbewahrungsfrist? Abhängig von Audit-Log-Dauer?

---

## Recht auf Vergessenwerden (Art. 17 DSGVO)

### Anfrage-Workflow

1. **Schüler oder Eltern oder Lehrkraft** sendet Lösch-Anfrage per Formular oder E-Mail
2. **Schulleitung / DSB** validiert:
   - Identität des Antragstellers
   - Berechtigung (Schüler selbst, Eltern, Lehrkraft)
   - Grund (Widerruf, Objekt, Fehler)
3. **Prüfung:** Gibt es zwingende Aufbewahrungsgründe? (z. B. "Noten müssen 2 Jahre archiviert sein")
4. **Entscheidung:** Ablehnung mit Begründung ODER Löschung genehmigen
5. **Implementierung:** Lösch-Job startet (siehe Abschnitt 3); Bestätigung an Antragsteller
6. **Audit:** Event in Audit Log dokumentiert

### Timeout

Anfrage muss innerhalb von **30 Tagen** bearbeitet werden (DSGVO Art. 12(3)).

---

## Quellenwiderruf in RAG (../rag/INGESTION_POLICY.md)

Wenn Lehrkraft eine RAG-Quelle widerruft:

1. Quelle wird im Index mit `is_revoked = true` markiert
2. Bei Retrieval: revoked Sources **nicht** zurückgeben
3. Alte Q&A-Pairs mit dieser Quelle werden markiert (for DSB review)
4. Qdrant Vektoren dieser Quelle werden **nicht** gelöscht (weil nicht für jeden Vektor die Quelle einzeln bekannt ist), sondern gekennzeichnet + manuell überprüft

**Offen:** Absprache mit Schulleitung, wie lange revoked Sources noch indexiert bleiben (Audit-Trail vs. Datensparsamkeit).

---

## Schulaustritt / Deprovisioning

### Lehrkraft tritt aus

1. Lehrkraft-Konto wird deaktiviert (nicht gelöscht)
2. Alle Zugriffe werden entzogen
3. Audit-Logs bleiben für 7 Jahre
4. Nach 7 Jahren: Konto + Personal Data gelöscht

### Schüler tritt aus (Schulaustritt, Abitur, Wechsel)

1. Sofort: Student-Data-Löschung (wenn nicht unter Aufbewahrungsfrist-Ausnahme)
2. Aufbewahrungspflicht: Noten werden bis zum Ende der Aufbewahrungsfrist archiviert (read-only)
3. Nach Frist: Hard-Delete aller Daten

---

## Backup und Wiederherstellung

### Backup-Policy

- Tägliches inkrementelles Backup (PostgreSQL WAL, MinIO versioning)
- Wöchentliches vollständiges Backup (encrypted, off-site)
- Aufbewahrung: 30 Tage

### Wiederherstellung

- Wenn Schüler zu Unrecht gelöscht wurde: Backup-Restore möglich bis zum Ende der Grace Period (30 Tage)
- Nach Grace Period: Daten sind unwiederbringlich (by design)
- DSB wird vor Backup-Restore benachrichtigt

---

## Monitoring und Compliance

### Tägliche Checks

```bash
# Cron: 02:00 UTC
/usr/local/bin/delete-retention-expired.sql
- Log: /var/log/lsa/deletion.log
- Alert: Wenn mehr als 100.000 Zeilen gelöscht → DSB benachrichtigen
```

### Wöchentliche Reports (Schulleitung + DSB)

- Anzahl gelöschter Datensätze (pro Datenklasse)
- Anzahl Vergessenwerden-Anfragen (genehmigt/abgelehnt)
- Außer Plane Löschungen (Fehler, Sicherheitsbreaches)

### Jährliche Compliance-Prüfung

- Aufbewahrungsfristen korrekt eingehalten? (Audit gegen DELETE-Logs)
- Alle CloudReleaseGrants noch gültig?
- Backup-Tests durchgeführt?
- Keine unerwarteten Datenlecks?

---

## Offene Fragen

Die folgenden Aufbewahrungsfristen und Lösch-Aspekte müssen mit Schulleitung und Datenschutzbeauftragter abgestimmt werden. Siehe [../decisions/OPEN_QUESTIONS.md](../decisions/OPEN_QUESTIONS.md):

1. **Aufbewahrungsfrist SENSITIVE_STUDENT (Arbeits-/Test-Inhalte):**
   - Derzeitig: Schuljahr + 2 Jahre danach
   - Offen: Stimmt das mit Lehrplan-Anforderungen überein? Vergleich: andere Schulen, Behörden

2. **Pseudonym-Mapping-Löschfrist:**
   - Option A: Anonymisierung statt Löschung (reversibel bis 3 Jahre)
   - Option B: Echtes Löschen nach 3 Jahren (unwiederbringlich)
   - Option C: Abhängig von Audit-Log-Fristen (max. 7 Jahre)

3. **Religion-Daten Spezialregelung:**
   - Art. 9 DSGVO (besondere Kategorie)
   - Offen: Explizites Opt-In von Eltern erforderlich?
   - Offen: Separate Aufbewahrungsfrist für Religion vs. andere Fächer?

4. **Log-Klassifikation:**
   - Welche Logs enthalten PII? (Login-Events: ja; System-Errors: nein)
   - Offen: Separate Aufbewahrungsfristen für PII vs. Metadaten-Logs

5. **Widerruf Cloud-LLM:**
   - Wenn Schulleitung CloudReleaseGrant widerruft: werden alte Daten zu Cloud gelöschte?
   - Offen: Vereinbarung mit Provider, dass Daten nicht länger in Logs / Training gespeichert sind

6. **Schülerarbeits-Vektoren in Qdrant:**
   - Vektoren sind schwer nachzuverfolgen zu Quelltexten (embeddings sind nicht reversibel)
   - Offen: Komplette Qdrant-Collection löschen bei Schüler-Widerruf oder selektiv?

---

## Verweise

- **Sicherheitsgrundsätze:** [./SECURITY.md](./SECURITY.md)
- **Threat Model:** [./THREAT_MODEL.md](./THREAT_MODEL.md) — Restrisiken (Re-Identifikation, Cloud-LLM, Prompt Injection)
- **Datenschutz & Rechtliche Grundlagen:** [./DATA_PROTECTION.md](./DATA_PROTECTION.md) — wird separat verfasst
- **Offen Fragen & Entscheidungspunkte:** [../decisions/OPEN_QUESTIONS.md](../decisions/OPEN_QUESTIONS.md)
- **RAG Ingestion & Quelle-Widerruf:** [../rag/INGESTION_POLICY.md](../rag/INGESTION_POLICY.md)
- **Local-First Design:** [../adr/0004-local-first-student-data.md](../adr/0004-local-first-student-data.md)
