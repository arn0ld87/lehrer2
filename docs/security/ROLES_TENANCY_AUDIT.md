# Rollenmodell, Mandantentrennung und Audit Log

Dieses Dokument spezifiziert die Zugriffssteuerung, die Isolation von Mandanten (Schulen) und die Protokollierung sicherheitsrelevanter Ereignisse in der Unterrichtsassistenz LSA.

## 1. Rollenmodell (RBAC)

Das Rollenmodell folgt dem Prinzip des _Least Privilege_. Berechtigungen werden auf Basis der funktionalen Notwendigkeit vergeben.

| Rolle                                 | Beschreibung                                    | Kernkompetenzen / Berechtigungen                                                                                                                     |
| :------------------------------------ | :---------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lehrkraft** (`TEACHER`)             | Standard-Nutzer des Systems.                    | Erstellen/Verwalten eigener Unterrichtsmaterialien; Zugriff auf eigene Klassen; Durchführung von Korrekturen (pseudonymisiert).                      |
| **Fachkonferenz** (`DEPARTMENT_HEAD`) | Fachspezifische Aufsicht (spätere Ausbaustufe). | Freigabe von schulinternen Material-Pools; Einsicht in aggregierte Fachstatistiken; Erteilung von `CurriculumRelease`.                               |
| **Schuladmin** (`SCHOOL_ADMIN`)       | Administrative Leitung der Einzelschule.        | Benutzerverwaltung der Schule; Erteilung von `CloudReleaseGrant` (nach rechtlicher Prüfung); Einsicht in Audit-Logs der Schule.                      |
| **Admin** (`SYS_ADMIN`)               | Systemadministrator (Technischer Betrieb).      | Systemkonfiguration; Wartung; Backup-Management; Globales Monitoring. Kein Zugriff auf pädagogische Inhalte oder Schülerdaten ohne explizites Audit. |

### Übergangsregel (MVP)

Im MVP existieren produktiv nur die Rollen `TEACHER` und `SYS_ADMIN`.

- Fachspezifische Freigaben (`DEPARTMENT_HEAD`) sind im MVP nicht aktiv (Default: nur eigene Materialien).
- Die Rolle `SYS_ADMIN` übernimmt notwendige technische Konfigurationen, erhält aber **keine** unbegrenzte Override-Macht über pädagogische Freigaben oder Cloud-LLM-Grants.
- `CloudReleaseGrant` bleibt deaktiviert, solange die Rollen `DEPARTMENT_HEAD` und `SCHOOL_ADMIN` nicht implementiert sind (siehe ADR 0002/0004 und [OPEN_QUESTIONS](../decisions/OPEN_QUESTIONS.md)).
- Der Zugriff auf Cloud-LLMs ist somit im MVP technisch ausgeschlossen (Local-only via Ollama).

## 2. Mandantentrennung (Multi-Tenancy)

Das System ist mandantenfähig ausgelegt, wobei eine **Schule** den primären Mandanten darstellt.

### Isolationsebenen

1. **Datenbank-Ebene (Row-Level Security):**
   - Jede mandantenrelevante Tabelle enthält eine `school_id`.
   - Datenbankabfragen werden durch Middleware oder Row-Level Security auf die `school_id` des angemeldeten Benutzers gefiltert.
   - Ein "Übergreifen" auf Daten anderer Schulen ist auf Query-Ebene technisch ausgeschlossen.

2. **API-Ebene:**
   - Der Tenant-Kontext wird aus der verifizierten Session (Auth-Token) abgeleitet.
   - Backend-Services akzeptieren nur Anfragen, die innerhalb ihres validierten Tenant-Scopes liegen.

3. **Dateisystem / Object Storage:**
   - Dokumente und Scans werden in Präfixen oder Buckets gespeichert, die nach `school_id` getrennt sind.
   - Zugriffsschlüssel (z. B. Presigned URLs) werden nur für Ressourcen innerhalb des eigenen Mandanten ausgestellt.

4. **KI-Modelle & Vektorbank:**
   - RAG-Indizes sind mandantenspezifisch getrennt (Filterung auf `school_id`).
   - Gemeinsame `OFFICIAL_BINDING` Quellen sind mandantenübergreifend lesbar, aber schuleigene Materialien (`USER_APPROVED`) bleiben strikt isoliert.

## 3. Audit Log

Das Audit Log dient der Nachvollziehbarkeit sicherheitskritischer Aktionen und der Erfüllung von Dokumentationspflichten gemäß DSGVO.

### Geloggte Ereignisse

| Kategorie             | Ereignistypen                                                                                     |
| :-------------------- | :------------------------------------------------------------------------------------------------ |
| **Authentifizierung** | Login, Logout, Fehlgeschlagene Anmeldeversuche, Passwortänderungen.                               |
| **Autorisierung**     | Rollenänderungen, Vergabe von Berechtigungen, Ablehnung von Zugriffen.                            |
| **Datenzugriff**      | Zugriff auf `SENSITIVE_STUDENT` Daten, Exporte von Klassenlisten, Löschvorgänge.                  |
| **KI-Aktionen**       | LLM-Calls (mit Metadaten: Modell, Provider, Redaction-Status), Erteilung von `CloudReleaseGrant`. |
| **System**            | Konfigurationsänderungen, Backup-Status, kritische Fehler.                                        |

### Datenstruktur

Jeder Audit-Eintrag umfasst mindestens:

- `timestamp`: UTC-Zeitstempel der Aktion.
- `actor_id`: Eindeutige ID des handelnden Nutzers oder Systems.
- `school_id`: Mandanten-Kontext, in dem die Aktion stattfand.
- `event_type`: Identifikator des Ereignisses (z. B. `auth.login`, `data.access.student`).
- `resource_id`: ID der betroffenen Ressource (z. B. Arbeitsblatt-ID, Pseudonym-ID).
- `action`: Die ausgeführte Operation (`CREATE`, `READ`, `UPDATE`, `DELETE`, `EXECUTE`).
- `status`: Resultat der Aktion (`SUCCESS` oder `FAILURE`).
- `metadata`: Kontextbezogene Informationen (Hinweis: Enthält **keine** sensiblen Inhalte wie Klarnamen oder Prompt-Inhalte).
- `ip_address`: Gekürzte/pseudonymisierte IP-Adresse (gemäß lokaler Datenschutzrichtlinie).

### Aufbewahrung & Integrität

- **Unveränderlichkeit:** Audit-Logs sind _append-only_. Bestehende Einträge können nicht modifiziert oder gelöscht werden.
- **Aufbewahrung:** Gemäß [RETENTION_AND_DELETION.md](./RETENTION_AND_DELETION.md) (i. d. R. laufendes Schuljahr + 2 Jahre für Revisionszwecke).
- **Zugriff:** Audit-Logs sind nur für Nutzer mit der Rolle `SCHOOL_ADMIN` (bezogen auf den eigenen Mandanten) oder `SYS_ADMIN` (technisches Monitoring) einsehbar. Jede Einsichtnahme in das Audit Log wird selbst wiederum protokolliert.

## Verweise

- **Data Model:** [../architecture/DATA_MODEL.md](../architecture/DATA_MODEL.md) — Struktur der Audit- und Tenant-Felder.
- **Security Policy:** [./SECURITY.md](./SECURITY.md) — Allgemeine Sicherheitsgrundsätze.
- **Retention Policy:** [./RETENTION_AND_DELETION.md](./RETENTION_AND_DELETION.md) — Aufbewahrungsfristen.
- **Auth ADR:** [../adr/0007-auth-solution.md](../adr/0007-auth-solution.md) — Technische Basis der Authentifizierung.
