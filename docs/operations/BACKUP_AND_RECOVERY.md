# Backup und Wiederherstellung

Dieses Dokument definiert die Backup- und Wiederherstellungsstrategie für das Unterrichtsassistenz-LSA-System.

## Schutzobjekte

Das System verwaltet vier kritische Datenkategorien, die regelmäßig gesichert werden müssen:

### 1. PostgreSQL-Datenbank

Enthält:

- Benutzerkonten und Authentifizierung
- Unterrichtskontext (Klassen, Schüler, Lerngruppen)
- Anfragemetadaten (Timestamps, User-IDs, Session-IDs)
- Konfigurationen und Systemzustände

**Kritikalität**: HOCH – Datenverlust führt zu Funktionsverlust des Systems.

### 2. Qdrant-Vektordatenbank

Enthält:

- Embedding-Vektoren für Dokumente und Lernmaterialien
- Metadaten für semantische Suche
- Indexstrukturen für schnelle Ähnlichkeitssuche

**Kritikalität**: HOCH – Indizes müssen konsistent mit PostgreSQL-Metadaten sein.

### 3. Object Store (MinIO)

Enthält:

- Hochgeladene Dokumente (PDFs, Bilder, Arbeitsblätter)
- Generierte Artefakte (Lesson Plans, Quizzes)
- Temporäre OCR-Ergebnisse

**Kritikalität**: MITTEL-HOCH – Datenverlust beeinträchtigt Lehrmaterialien, aber nicht die Systemfunktion selbst.

### 4. Pseudonym-Mapping

Enthält:

- Zuordnungen zwischen echten Benutzernamen und pseudonymisierten IDs
- Erforderlich für Datenschutz und Anonymisierung

**Kritikalität**: KRITISCH – Datenverlust gefährdet die Einhaltung von DSGVO und datenschutzrechtlichen Verpflichtungen.

**Lagerung**: Getrennt von öffentlichen Backups, verschlüsselt mit separaten Schlüsseln.

## Backup-Strategie

### Automatische Backups

**Frequenz**: Täglich (empfohlen: 02:00 UTC, außerhalb von Unterrichtszeiten)

**Retention**: Mindestens 30 Tage; älter als 90 Tage müssen archiviert werden.

**Verschlüsselung**: AES-256-GCM mit Key Derivation (KDF).

### Manuelle Backups

Vor größeren Systemänderungen oder Migrationen:

```bash
# PostgreSQL-Dump
docker compose exec postgres pg_dump -U postgres lsa_db > backup_$(date +%Y%m%d_%H%M%S).sql

# MinIO-Sicherung
mc mirror minio/lsa-bucket ./backup/minio/

# Qdrant-Snapshot
docker compose exec qdrant curl -X POST http://localhost:6333/snapshots
```

### Sichere Aufbewahrung

- **Primary**: Lokaler NFS/SMB-Share oder Cloud-Objektspeicher (z. B. AWS S3, Backblaze B2)
- **Secondary**: Geografisch entfernte Region (mindestens 500 km entfernt)
- **Archiv**: Kryptographisch signierte, langfristige Verwaltung (optionally Glacier/Coldline)

## Recovery Point Objective (RPO) und Recovery Time Objective (RTO)

Für den Pilotbetrieb (M4) sind folgende Ziele definiert:

- **Recovery Point Objective (RPO)**: **24 Stunden**
  - Ein tägliches Backup (02:00 UTC) ist ausreichend. Im Falle eines Desasters gehen maximal die Daten eines Arbeitstages verloren.
- **Recovery Time Objective (RTO)**: **4 Stunden**
  - Innerhalb von vier Stunden nach Feststellung eines Ausfalls muss das System in einer separaten Umgebung wiederhergestellt sein.

Diese Werte werden nach der Pilotphase evaluiert und ggf. verschärft.

## Wiederherstellungstests

Detaillierte Prozeduren für die Wiederherstellung und regelmäßige Tests finden sich im [Wiederherstellungs-Testplan (RECOVERY_TEST_PLAN.md)](RECOVERY_TEST_PLAN.md).

### Häufigkeit

Mindestens **monatlich** ein vollständiger oder Partial-Restore-Test durchführen.

### Prozedur

1. **Testumgebung vorbereiten**

   ```bash
   # Separate PostgreSQL-Instanz starten
   docker run -d --name postgres-test \
     -e POSTGRES_PASSWORD=testpass \
     -v backup_vol:/backup \
     postgres:15
   ```

2. **Backup wiederherstellen**

   ```bash
   # SQL-Dump laden
   docker exec postgres-test psql -U postgres -d lsa_db < backup_latest.sql
   ```

3. **Integrität prüfen**
   - Kontrollsummen (SHA256) gegen Original-Backup vergleichen
   - Datenbankzeilenzahl mit Produktionszahl vergleichen
   - Qdrant-Vektor-Count verifizieren
   - MinIO-Objekt-Count verifizieren

4. **Funktionale Tests**
   - Benutzer-Login prüfen
   - Semantische Suche (Embedding-Abruf) testen
   - Dokumenten-Download testen

5. **Dokumentation**
   - Test-Ergebnis in Log-Datei festhalten
   - Zeitdauer bis vollständiger Restore notieren
   - Probleme und Resolutions dokumentieren

### Synthetische Testdaten

Restore-Tests nutzen **synthetische Daten** (Dummy-Benutzer, gemeine Texte), nicht echte Unterrichtsdaten.

## Konsistenz zwischen PostgreSQL und Qdrant

### Herausforderung

PostgreSQL enthält Metadaten (Datei-ID, Upload-Zeit, Owner), während Qdrant die entsprechenden Vektoren speichert. Ein verwaister Eintrag in einem System beeinträchtigt die Suche.

### Konsistenz-Prüfung

Regelmäßig (täglich oder wöchentlich):

```python
# Pseudocode
pg_files = SELECT id FROM documents
qdrant_vectors = qdrant.scroll(collection="documents")

orphaned_pg = pg_files - qdrant_vectors
orphaned_qdrant = qdrant_vectors - pg_files

if orphaned_pg or orphaned_qdrant:
    log_alert("Inconsistency detected: orphaned entries exist")
    # Automatisch reparieren oder manuelles Review
```

### Reparaturstrategie

- **Verwaiste Qdrant-Vektoren**: Löschen (keine korrespondierende Metadaten)
- **Verwaiste PostgreSQL-Einträge**: Löschen oder neu indexieren (je nach Fehlerursache)

Reparaturschritte müssen dokumentiert und genehmigt sein.

## Bezug zu Lösch- und Aufbewahrungskonzept

Backups müssen mit der Datenschutz- und Aufbewahrungspolitik (../security/RETENTION_AND_DELETION.md) koordiniert werden:

- **Löschanforderungen**: Wenn ein Benutzer sein Konto löscht oder ein Recht auf Vergessenwerden geltend macht, müssen alle Backups, die ihre Daten enthalten, innerhalb der Aufbewahrungsfrist gelöscht oder überschrieben werden.
- **Aufbewahrungsfrist**: Backups sollten nicht länger als die dokumentierte Aufbewahrungsfrist aufbewahrt werden.
- **Verifizierung**: Nach Löschung eines Benutzers muss ein Restore-Test bestätigen, dass die Löschung rückgängig gemacht wurde.

## Automatisierungstools

### Empfohlene Tools

- **Backup**: pg_dump, Velero (für Kubernetes, falls später relevant), MinIO mc (Mirror-Sync)
- **Monitoring**: Prometheus + Alertmanager für fehlgeschlagene Backups
- **Encryption**: openssl, HashiCorp Vault (für Key-Management)

### Geplante Implementierung

Tool-Auswahl und Automatisierungsskripte (systemd Timer, CronJobs, Kubernetes CronJobs) werden in [../../PLAN.md](../../PLAN.md) festgehalten.

## Checkliste für Disaster Recovery

- [ ] Backup-Jobs sind konfiguriert und laufen täglich
- [ ] Backup-Verschlüsselungsschlüssel sind sicher verwahrt (z. B. in Vault)
- [ ] Wöchentliche Backup-Integrität wird überprüft (Size, Checksum)
- [ ] Monatliche Restore-Tests werden durchgeführt (synthetische Daten)
- [ ] Test-Ergebnisse werden dokumentiert
- [ ] Konsistenz-Checks zwischen PostgreSQL und Qdrant werden durchgeführt
- [ ] Alert-Benachrichtigungen sind konfiguriert (fehlgeschlagene Backups, Disk-Space)
- [ ] Aufbewahrungsfristen werden eingehalten
- [ ] Datenschutz-Löschanforderungen werden mit Backup-Löschung koordiniert

## Weitere Ressourcen

- [Projektplan](../../PLAN.md) – Architektur und operative Roadmap
- [Retention and Deletion Policy](../security/RETENTION_AND_DELETION.md) – Datenschutz und Löschpolitik
- [Docker Compose Infrastruktur](../../compose.yaml) – Service-Definitionen für Backups
