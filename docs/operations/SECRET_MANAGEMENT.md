# Secret-Management-Konzept

Dieses Dokument beschreibt den Umgang mit sensiblen Daten (Secrets) in der Unterrichtsassistenz LSA. Gemäß dem Grundsatz „Keine Secrets im Repo“ definiert dieses Konzept die Speicherung, Injektion und Rotation von Anmeldedaten, Schlüsseln und Zertifikaten.

## Definitionen und Kategorien

Secrets sind alle Daten, die bei unbefugtem Zugriff die Vertraulichkeit, Integrität oder Verfügbarkeit des Systems gefährden.

### Kategorien

| Kategorie           | Beispiele                                     | Schutzbedarf |
| ------------------- | --------------------------------------------- | ------------ |
| **Infrastruktur**   | DB-Passwörter, MinIO-Keys, Redis-Passwörter   | Hoch         |
| **Anwendung**       | Auth-Secrets (JWT), API-Keys (optional Cloud) | Hoch         |
| **Verschlüsselung** | PII-Encryption-Keys, Pseudonym-Mapping-Keys   | Sehr Hoch    |
| **Zertifikate**     | TLS-Zertifikate, Private Keys                 | Hoch         |

## Grundregeln

1.  **Repo-Verbot**: Secrets werden niemals in Git eingecheckt (auch nicht verschlüsselt, sofern vermeidbar).
2.  **Exklusive Injektion**: Secrets gelangen ausschließlich über die Umgebung (Environment) oder dedizierte Secret-Mounts in die Container.
3.  **Minimalprinzip**: Container erhalten nur Zugriff auf die Secrets, die sie für ihre Funktion benötigen.
4.  **Klartext-Verbot**: In Logs, Fehlermeldungen oder UI-Elementen dürfen Secrets niemals im Klartext erscheinen.

## Secret-Handling je Umgebung

### 1. Entwicklung (lokal)

- **Werkzeug**: `.env`-Datei (basierend auf `.env.example`).
- **Schutz**: `.env` ist in `.gitignore` eingetragen.
- **Vorgehen**: Lehrkräfte/Entwickler kopieren `.env.example` zu `.env` und tragen lokale Dummy-Werte ein.

### 2. Produktion / Staging (Zentral oder Schule)

- **Werkzeug**: **Docker Secrets** (bevorzugt bei Docker Swarm) oder sicher gemountete Files/Environment-Variablen (bei Docker Compose).
- **Injektion**:
  - Bei Docker Swarm: Secrets werden verschlüsselt in der Raft-Datenbank des Managers gespeichert und nur im Memory des Ziel-Containers gemountet (`/run/secrets/`).
  - Bei Docker Compose: Nutzung von externen Environment-Files, die nicht Teil des Repos sind.
- **Storage**: Langfristige Aufbewahrung von Produktions-Secrets erfolgt in einem sicheren Passwort-Manager (z.B. Bitwarden, KeePassXC) oder einem Vault-System (HashiCorp Vault), auf das nur autorisierte IT-Administratoren Zugriff haben.

## Spezielle Secrets: PII-Verschlüsselung

Schlüssel für die Pseudonymisierung und die Verschlüsselung von Schülerdaten (`SENSITIVE_STUDENT`) unterliegen besonderen Sicherheitsvorkehrungen:

- **Trennung**: Diese Schlüssel sollten physisch oder logisch getrennt von den Infrastruktur-Secrets (wie DB-Passwörtern) verwaltet werden.
- **HSM/Enclave**: Perspektivisch (nach MVP) ist die Nutzung von Hardware-Sicherheitsmodulen oder Trusted Execution Environments (TEE) zur Schlüsselverwaltung geplant.

## Rotation und Widerruf

- **Intervall**: Infrastruktur-Secrets (DB-Passwörter etc.) werden alle 6 Monate rotiert.
- **Event-basiert**: Bei Ausscheiden eines Administrators oder Verdacht auf Kompromittierung erfolgt eine sofortige Rotation aller betroffenen Secrets.
- **Widerruf**: Kompromittierte API-Keys werden sofort beim Provider (z.B. OpenAI, falls genutzt) gesperrt.

## Präventionsmaßnahmen (Detection)

Um versehentliches Einchecken zu verhindern:

- **Pre-commit Hooks**: Lokale Prüfung auf Secret-Patterns vor jedem Commit (geplant: Integration von `gitleaks` oder `trufflehog`).
- **CI-Scanning**: GitHub Actions scannen jeden Push auf bekannte Secret-Formate.
- **Code-Reviews**: Manuelle Kontrolle im Vier-Augen-Prinzip.

## Beispiel: Secret-Nutzung in Docker Stack

```yaml
version: "3.8"
services:
  app:
    image: ghcr.io/arn0ld87/lehrer2-app:latest
    secrets:
      - db_password
      - auth_secret
    environment:
      DATABASE_PASSWORD_FILE: /run/secrets/db_password
      AUTH_SECRET_FILE: /run/secrets/auth_secret

secrets:
  db_password:
    external: true
  auth_secret:
    external: true
```

## Verweise

- [../security/SECURITY.md](../security/SECURITY.md) — Allgemeine Sicherheitsrichtlinien
- [../security/DATA_PROTECTION.md](../security/DATA_PROTECTION.md) — Schutz personenbezogener Daten
- [DEPLOYMENT_STRATEGY.md](./DEPLOYMENT_STRATEGY.md) — Deployment-Verfahren
- [../../.env.example](../../.env.example) — Vorlage für lokale Entwicklung
