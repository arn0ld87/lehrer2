# Sicherheitsrichtlinien — LSA (Unterrichtsassistenz)

Dieses Dokument definiert Sicherheitsgrundsätze, Rollen, Verantwortlichkeiten und den Meldeweg für die Unterrichtsassistenz LSA.

## Sicherheitsgrundsätze

### Defense-in-Depth

Mehrschichtige Kontrollen schützen vor Ausfällen einzelner Maßnahmen:

- Authentifizierung (Lehrkraft + Session) + Autorisierung (Datenklasse-basiert)
- Lokale Validierung + fail-closed Guards vor jedem LLM-Call
- Verschlüsselung im Transit (TLS 1.3+) + Ruhe (AES-256-GCM oder äquivalent)
- Redaction-Schritt + Threat-Detektor vor Cloud-LLM-Nutzung
- Audit Logging + regelmäßige Intrusion Detection

### Least Privilege

- Jede Lehrkraft sieht nur ihre eigenen Daten und Klassenarbeiten ihrer Schüler
- Dienstkonten (OCR-Worker, LLM-Agent) erhalten minimale Permissions: nur erforderliche Datenklassen lesen/schreiben
- Keine Super-Admin-Accounts im Normalbetrieb; Admin-Zugriffe dokumentiert + zeitlich befristet
- RAG-Indexe granular: Religion-Quellen segregiert von Deutsch-Quellen

### Secure Defaults

- Pseudonymisierung ist Default, nicht Opt-in: Schüler-Klarnamen werden **sofort** durch stabile Pseudonyme ersetzt
- Lokale LLM (Ollama) ist Standard; Cloud-LLM nur mit expliziter Schulfreigabe (CloudReleaseGrant)
- Alle Anfragen an LLM erhalten vorher Redaction-Schritt; kein Klarname verlässt das System
- Logs enthalten kein Content (nur Metadaten wie Datenklasse, Länge, Timestamp)
- Datenretention ist Minimierungs-Default: automatische Löschung nach Aufbewahrungsfrist

### Fail-Closed

- Wenn der Redaction-Schritt oder der Guard fehlschlägt, wird die Anfrage blockiert (kein Fallback zu unsichererer Option)
- Wenn Cloud-LLM ohne gültiges CloudReleaseGrant angefragt wird, wird lokal zurückgewiesen
- Wenn Pseudonym-Mapping beschädigt ist, wird die Anfrage abgelehnt (nicht erraten, nicht reparieren)
- Wenn das Audit Log nicht geschrieben werden kann, wird die Operation blockiert
- Wenn die Identität der Lehrkraft nicht verifiziert wird, gibt es keinen Zugriff

## Verantwortlichkeiten und Rollen

| Rolle                            | Verantwortung                                                                                                                                        |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Schulleitung**                 | Freigabe für Cloud-LLM (CloudReleaseGrant mit Rechtsgrundlage, AVV, DSFA); Datenschutzrichtlinien definieren; Incident Response genehmigen           |
| **Datenschutzbeauftragte (DSB)** | Datenschutz-Impact-Assessments; Lieferantenpflege (Cloud-Provider); Datenschutzverletzungs-Benachrichtigung                                          |
| **IT-Administrator**             | Systembetrieb; Backup/Wiederherstellung; Sicherheits-Patches; Auditlogs prüfen                                                                       |
| **Lehrkräfte**                   | Gewährleisten, dass nur sachlich notwendige Daten verarbeitet werden; Widerruf einreichen falls Schüler/Eltern das Recht auf Vergessenwerden ausüben |
| **Schüler / Eltern**             | Auskunftsverlangen; Widerruf von Datenverarbeitung (Art. 17 DSGVO)                                                                                   |

## Umgang mit Secrets

### Umgang mit Secrets

Details zum Management von Secrets finden sich im [Secret-Management-Konzept](../operations/SECRET_MANAGEMENT.md).

- **Verbot:** Keine `.env`, API-Keys, Zertifikate, Private Keys, OAuth Tokens, Datenbank-Passwörter im Git-Repo.
- **Detektion:** Pre-commit Hooks und CI-Scanner blocken verdächtige Patterns.
- **Speicherort:** Secrets leben in Docker Secrets (Produktion) oder einer lokalen `.env` (Entwicklung, gitignored).
- **Rotation:** Infrastruktur-Secrets werden regelmäßig rotiert (siehe Konzept).
- **Injektion:** Secrets werden zur Laufzeit injiziert; niemals zur Buildzeit.
- **Logs:** Automatische Redaction von Secrets in allen Log-Outputs.

## Meldeweg für Sicherheitslücken

Sicherheitslücken werden **nicht** auf GitHub Issues oder öffentliche Kanäle gemeldet.

1. **Entdeckung:** Sicherheitslücke wird sofort der **Schulleitung + DSB** gemeldet (privat, nicht-öffentlich)
2. **Triaging:** Schulleitung + DSB + IT-Administrator bewerten Schweregrad (Kritisch / Hoch / Mittel / Niedrig) innerhalb von 24h
3. **Containment:** Ggf. sofortige Mitigationen (z. B. Isolation betroffener Module, Lehrkraft-Benachrichtigung)
4. **Remediation:** Patch wird entwickelt; Zeitrahmen hängt von Schweregrad ab:
   - **Kritisch:** Patch innerhalb 48h, sofortige Benachrichtigung betroffener Schulen
   - **Hoch:** Patch innerhalb 1 Woche
   - **Mittel/Niedrig:** Patch mit nächstem Release
5. **Dokumentation:** Incident wird im Sicherheits-Logbuch dokumentiert (nicht öffentlich)

**Kontakt:** Private Repo (arn0ld87/lehrer2) → Maintainer wird direkt kontaktiert (kein öffentliches Security Policy File im Public Repo, da Projekt privat ist)

## Sicherheits-Architektur-Überblick

### Datenfluss mit Guard-Stellen

```
Lehrkraft-Input
  ↓
[1. Authentifizierung + Session-Validierung]
  ↓
[2. Autorisierung: darf diese Lehrkraft auf diese Datenklasse zugreifen?]
  ↓
[3. Daten aus DB laden, Schüler-Klarnamen → Pseudonym]
  ↓
[4. Redaction-Schritt: alle potenziellen PII entfernen]
  ↓
[5. Threat-Detektor: Prompt-Injection, Re-Identifikation, verdächtige Muster]
  ↓
[6. CloudReleaseGrant-Check: wenn Cloud-LLM → Freigabe vorhanden?]
  ↓
[7. LLM-Call (lokal oder Cloud) mit redacted Data]
  ↓
[8. Response-Validation: keine Klarnamen im Output?]
  ↓
[9. Audit Log schreiben (Metadaten nur)]
  ↓
Lehrkraft-Output
```

Alle Stellen sind **fail-closed**: wenn Validierung fehlschlägt, wird kein Zugriff gewährt.

## Datenklassen und Sicherheitseinstufung

| Datenklasse         | Sicherheitseinstufung                 | Wer darf zugreifen             | Verschlüsselung erforderlich                              |
| ------------------- | ------------------------------------- | ------------------------------ | --------------------------------------------------------- |
| `PUBLIC`            | Unkritisch                            | Jeder                          | Empfohlen (TLS)                                           |
| `INTERNAL`          | Intern                                | Lehrkräfte, IT-Admin           | Ja (TLS + AES-256)                                        |
| `PERSONAL_TEACHER`  | Persönlich                            | nur Lehrkraft selbst           | Ja (AES-256)                                              |
| `SENSITIVE_STUDENT` | Hochsensibel (Art. 9 DSGVO, Religion) | nur Lehrkraft + Schüler selbst | Ja (AES-256-GCM), fail-closed bei Cloud-LLM ohne Freigabe |

## Verweise

- **Threat Model:** [./THREAT_MODEL.md](./THREAT_MODEL.md) — STRIDE-Analyse über drei Datenkreise
- **ASVS Compliance:** [./ASVS_COMPLIANCE.md](./ASVS_COMPLIANCE.md) — Review gegen OWASP ASVS v4.0.3 (Level 2)
- **Datenschutz:** [./DATA_PROTECTION.md](./DATA_PROTECTION.md) — Rechtliche Grundlagen, DSGVO-Compliance
- **Datenschutz-Checkliste:** [./DATA_PROTECTION_CHECKLIST.md](./DATA_PROTECTION_CHECKLIST.md) — DSGVO-Prüfschritte
- **Sicherheits-Findings:** [./SECURITY_FINDINGS.md](./SECURITY_FINDINGS.md) — Identifizierte Lücken aus dem Review
- **Aufbewahrung und Löschung:** [./RETENTION_AND_DELETION.md](./RETENTION_AND_DELETION.md) — Aufbewahrungsfristen, kaskadierende Löschung
- **Secret-Management:** [../operations/SECRET_MANAGEMENT.md](../operations/SECRET_MANAGEMENT.md) — Detailliertes Konzept zum Umgang mit Secrets
- **Local-First Architektur:** [../adr/0004-local-first-student-data.md](../adr/0004-local-first-student-data.md) — Design Decision für Pseudonymisierung und lokale Speicherung
- **RAG Ingestion:** [../rag/INGESTION_POLICY.md](../rag/INGESTION_POLICY.md) — Quelle-Validierung, Trust-Stufen, Widerruf

## Sicherheits-Checkliste vor Produktionsfreigabe

- [ ] Alle Secrets sind aus dem Repo entfernt
- [ ] Pre-commit Hooks für Secret Detection sind aktiviert
- [ ] TLS 1.3+ ist konfiguriert für alle Netzwerk-Kommunikation
- [ ] Pseudonymisierung läuft bei Ingest
- [ ] Redaction-Schritt ist implementiert und getestet
- [ ] CloudReleaseGrant-Validierung ist implementiert
- [ ] Audit Logging ist aktiv und testet werden
- [ ] Datenbank-Backups sind verschlüsselt und getestet
- [ ] OWASP ASVS Level 2 Review durchgeführt und Findings dokumentiert
- [ ] Penetrationstests wurden durchgeführt (mindestens STRIDE für Datenfluss)
- [ ] Datenschutzbeauftragte hat DSB-Stellungnahme abgegeben
- [ ] Schulleitung hat verbindliche Zustimmung gegeben
