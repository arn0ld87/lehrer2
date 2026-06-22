# OWASP ASVS Compliance Report — LSA (Unterrichtsassistenz)

Dieses Dokument dokumentiert den Security-Review gegen den **OWASP Application Security Verification Standard (ASVS) v4.0.3**.

**Ziel-Level:** Level 2 (Standard) — Angemessen für Anwendungen, die sensible personenbezogene Daten (Art. 9 DSGVO, z. B. Religion) verarbeiten.

---

## Status-Zusammenfassung

| Kategorie | Bezeichnung              | Status         | Bemerkung                                                                     |
| :-------- | :----------------------- | :------------- | :---------------------------------------------------------------------------- |
| **V1**    | **Architecture**         | 🟢 Compliant   | Design-first, ADRs für Kernentscheidungen vorhanden.                          |
| **V2**    | **Authentication**       | 🟡 Planned     | ADR 0007 (Better Auth) ist im Status _Proposed_.                              |
| **V3**    | **Session Management**   | 🟢 Compliant   | Policies für Timeouts und Cookie-Sicherheit in SECURITY.md definiert.         |
| **V4**    | **Access Control**       | 🟢 Compliant   | Row-Level Security (RLS) als fundamentale Invariante.                         |
| **V5**    | **Input Validation**     | 🟡 In Progress | Standard-Validation via Drizzle; LLM-Guard-Assertion ist konzeptionell stark. |
| **V7**    | **Cryptography**         | 🟢 Compliant   | AES-256-GCM und TLS 1.3+ als Standard gesetzt.                                |
| **V8**    | **Logging & Monitoring** | 🟢 Compliant   | `generation_provenance` und Audit-Log-Struktur definiert.                     |
| **V12**   | **Data Protection**      | 🟢 Compliant   | Pseudonymisierung-by-default und Local-first sind Kern-Architektur.           |
| **V14**   | **Configuration**        | 🟡 In Progress | CI/CD-Pipelines und Secret-Management-Prozesse definiert.                     |

---

## Detaillierter Review (Auszug relevante Anforderungen)

### V1: Architecture, Design and Threat Modeling

| Ref    | Anforderung                                                 | Status | Nachweis / Umsetzung                                                            |
| :----- | :---------------------------------------------------------- | :----- | :------------------------------------------------------------------------------ |
| 1.1.1  | Benutzen Sie einen sicheren Software-Entwicklungszyklus?    | 🟢     | M0-M4 Phasenmodell, Git-basierter Workflow, PR-Reviews, CI-Gates.               |
| 1.2.1  | Sind alle Vertrauensgrenzen (Trust Boundaries) definiert?   | 🟢     | Dokumentiert in [THREAT_MODEL.md](./THREAT_MODEL.md).                           |
| 1.4.1  | Sind alle Sicherheitsanforderungen dokumentiert?            | 🟢     | In [SECURITY.md](./SECURITY.md) und [DATA_PROTECTION.md](./DATA_PROTECTION.md). |
| 1.11.1 | Gibt es einen Plan für Security-Updates der Abhängigkeiten? | 🟡     | `pnpm` im Einsatz; automatisierte Updates (Dependabot) für M4 geplant.          |

### V2: Authentication

| Ref   | Anforderung                           | Status | Nachweis / Umsetzung                                                |
| :---- | :------------------------------------ | :----- | :------------------------------------------------------------------ |
| 2.1.1 | Passwort-Komplexität und Hashing?     | 🟡     | Geplant via Better Auth (Argon2id). ADR 0007.                       |
| 2.8.1 | Multi-Faktor-Authentifizierung (MFA)? | 🟡     | In THREAT_MODEL.md als Gegenmaßnahme für Credential Theft gelistet. |

### V3: Session Management

| Ref   | Anforderung                                     | Status | Nachweis / Umsetzung                                 |
| :---- | :---------------------------------------------- | :----- | :--------------------------------------------------- |
| 3.2.1 | Session-Timeout nach Inaktivität?               | 🟢     | 15 Minuten Timeout in SECURITY.md spezifiziert.      |
| 3.4.1 | Cookie-Sicherheit (Secure, HttpOnly, SameSite)? | 🟢     | Mandatorische Flags in THREAT_MODEL.md dokumentiert. |

### V4: Access Control

| Ref   | Anforderung                                                    | Status | Nachweis / Umsetzung                                                         |
| :---- | :------------------------------------------------------------- | :----- | :--------------------------------------------------------------------------- |
| 4.1.1 | Erzwingen von Zugriffskontrollen auf vertrauenswürdiger Seite? | 🟢     | PostgreSQL Row-Level Security (RLS) erzwingt Mandantentrennung auf DB-Ebene. |
| 4.2.1 | Prinzip der geringsten Berechtigung (Least Privilege)?         | 🟢     | Rollenmodell (Lehrkraft, Admin) in DATA_PROTECTION.md definiert.             |

### V5: Stored Input and Output Validation

| Ref   | Anforderung                          | Status | Nachweis / Umsetzung                                                      |
| :---- | :----------------------------------- | :----- | :------------------------------------------------------------------------ |
| 5.1.3 | Input-Validierung gegen White-Lists? | 🟡     | Drizzle ORM für DB-Eingaben; LLM-Prompt-Validation (Guard) in M3 geplant. |
| 5.3.3 | Schutz gegen SQL-Injection?          | 🟢     | Prepared Statements via Drizzle ORM.                                      |

### V7: Cryptography

| Ref   | Anforderung                            | Status | Nachweis / Umsetzung                                                  |
| :---- | :------------------------------------- | :----- | :-------------------------------------------------------------------- |
| 7.1.1 | Verwendung von Standard-Kryptographie? | 🟢     | AES-256-GCM für At-Rest, TLS 1.3+ für In-Transit.                     |
| 7.4.1 | Sicherer Umgang mit Secrets?           | 🟢     | Verbot von Secrets im Repo; Nutzung von Vaultwarden / Secret Manager. |

### V8: Logging and Monitoring

| Ref   | Anforderung                                       | Status | Nachweis / Umsetzung                                                     |
| :---- | :------------------------------------------------ | :----- | :----------------------------------------------------------------------- |
| 8.1.1 | Protokollierung sicherheitsrelevanter Ereignisse? | 🟢     | Audit-Log-Tabelle mit `event_type`, `actor_id` und `severity` definiert. |
| 8.2.1 | Keine sensiblen Daten in Logs?                    | 🟢     | Invariante: Nur Metadaten, keine PII oder Schülertexte in Logs.          |

### V12: Data Protection

| Ref    | Anforderung                                           | Status | Nachweis / Umsetzung                                                                                             |
| :----- | :---------------------------------------------------- | :----- | :--------------------------------------------------------------------------------------------------------------- |
| 12.1.1 | Personenbezogene Daten werden nur bei Bedarf erhoben? | 🟢     | Grundsatz der Datensparsamkeit in DATA_PROTECTION.md.                                                            |
| 12.3.1 | Sensible Daten werden pseudonymisiert?                | 🟢     | Kern-Invariante: Klarnamen → Pseudonym vor jedem LLM-Call / Export.                                              |
| 12.4.1 | Definierte Löschfristen?                              | 🟢     | [RETENTION_AND_DELETION.md](./RETENTION_AND_DELETION.md) spezifiziert Fristen (z.B. 12 Monate nach Ausscheiden). |

---

## Identifizierte Lücken (Findings)

Die identifizierten Lücken werden im Dokument [SECURITY_FINDINGS.md](./SECURITY_FINDINGS.md) als `type: security` Issues geführt.

## Nächste Schritte

1. Finalisierung ADR 0007 (Auth) zur Erfüllung von V2.
2. Implementierung des `RedactionService` und `Guard-Assertion` zur Erfüllung von V5/V12.
3. Einrichtung automatisierter Dependency-Scans (V14).
