# Wiederherstellungs-Testplan (Recovery Test Plan)

Dieses Dokument beschreibt die Prozeduren zur Wiederherstellung des Systems aus Backups sowie die Spezifikation für regelmäßige Wiederherstellungstests.

## 1. Wiederherstellungs-Strategie (Restore Plan)

Im Katastrophenfall (Datenverlust, Hardwaredefekt) erfolgt die Wiederherstellung in einer definierten Reihenfolge, um Konsistenz zwischen den Diensten zu gewährleisten.

### Voraussetzungen

- Zugriff auf die Backup-Dateien (PG-Dump, Qdrant-Snapshots, MinIO-Sicherung)
- Zugriff auf die Verschlüsselungsschlüssel (z. B. aus HashiCorp Vault oder sicherem Offline-Speicher)
- Bereitgestellte Infrastruktur (Docker Compose oder Docker Stack)

### Reihenfolge der Wiederherstellung

1.  **Infrastruktur-Dienste**: Starten von Redis und MinIO.
2.  **Datenbank (PostgreSQL)**: Einspielen des letzten SQL-Dumps. Dies bildet die Basis für alle Metadaten.
3.  **Vektor-Datenbank (Qdrant)**: Wiederherstellung der Snapshots.
4.  **Objektspeicher (MinIO)**: Synchronisation der Dateien aus der Sicherung.
5.  **Anwendungs-Container (Next.js)**: Starten der App erst nach erfolgreicher Datenwiederherstellung.
6.  **Konsistenzprüfung**: Ausführen der Skripte zur Prüfung der PG-Qdrant-Synchronität.

---

## 2. Spezifikation des Wiederherstellungstests

Ein Wiederherstellungstest dient dem Nachweis, dass die Backups funktionsfähig sind und die RTO-Ziele erreicht werden können.

### Test-Frequenz
- **Vollständiger Test**: Alle 3 Monate (Quartalsweise).
- **Integritätstest**: Monatlich (Stichprobenartige Wiederherstellung einzelner Tabellen/Objekte).

### Test-Umgebung
Tests werden **nie** in der Produktionsumgebung durchgeführt. Es wird eine isolierte `Recovery-Sandbox` genutzt:
- Getrenntes Docker-Netzwerk.
- Keine Verbindung zu Produktiv-Secrets.
- Verwendung von **synthetischen Testdaten**.

### Test-Szenarien

| Szenario | Beschreibung | Ziel |
| :--- | :--- | :--- |
| **S1: Datenbank-Fehler** | Drop der PostgreSQL-Datenbank `lsa_db`. | Wiederherstellung via `pg_restore`. |
| **S2: Speicher-Verlust** | Löschen des MinIO-Buckets `lsa-bucket`. | Wiederherstellung via `mc mirror`. |
| **S3: Totalverlust** | Löschen aller Volumes (PG, Qdrant, MinIO). | Vollständiger Neuaufbau des Systems. |

---

## 3. Durchführung (Schritt-für-Schritt)

1.  **Vorbereitung**: Identifikation des neuesten Backups.
2.  **Wiederherstellung**:
    ```bash
    # Beispiel PostgreSQL Restore
    cat backup_2024xx.sql | docker exec -i postgres-test psql -U postgres -d lsa_db

    # Beispiel Qdrant Snapshot Restore
    curl -X POST http://localhost:6333/collections/documents/snapshots/upload --data-binary @snapshot.qdrant
    ```
3.  **Verifikation**:
    - Abgleich der Zeilenanzahl kritischer Tabellen (`auth.user`, `curriculum.strand`).
    - Test-Login mit einem synthetischen Test-User.
    - Abruf eines bekannten Dokuments aus MinIO.
    - Durchführung einer semantischen Test-Suche.

---

## 4. Erfolgskriterien & Dokumentation

Ein Test gilt als **bestanden**, wenn:
- [ ] Alle Daten innerhalb der RTO (4h) wiederhergestellt wurden.
- [ ] Keine Integritätsfehler zwischen PG und Qdrant vorliegen.
- [ ] Die Kernfunktionen (Login, Suche, Export) in der Test-Umgebung funktionieren.
- [ ] Der Testbericht erstellt und archiviert wurde.

### Dokumentation des Ergebnisses
Jeder Test wird in einem kurzen Protokoll erfasst:
- Datum und Zeit des Tests.
- Dauer der Wiederherstellung.
- Identifizierte Probleme.
- Unterschrift/Freigabe durch den Sicherheitsbeauftragten.

---

## Bezug zu anderen Dokumenten
- [BACKUP_AND_RECOVERY.md](BACKUP_AND_RECOVERY.md) – Grundlegende Backup-Strategie
- [DATA_PROTECTION.md](../security/DATA_PROTECTION.md) – Schutzziele und Rechtsgrundlagen
- [PILOT_PLAN.md](PILOT_PLAN.md) – Nutzung synthetischer Daten
