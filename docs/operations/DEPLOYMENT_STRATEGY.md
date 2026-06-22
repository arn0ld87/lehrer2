# Deployment-Strategie

Dieses Dokument beschreibt die Deployment-Strategie für die Unterrichtsassistenz LSA. Ziel ist ein robuster, sicherer und datenschutzkonformer Betrieb, der sowohl zentrale Instanzen als auch lokale Installationen in Schulnetzen (Local-first) unterstützt.

## Strategische Ziele

1.  **Local-first Integrität**: Unterstützung von On-Premise-Installationen in Schulen bei minimalem Wartungsaufwand.
2.  **Container-basierte Konsistenz**: Identische Laufzeitumgebungen von Entwicklung bis Produktion.
3.  **Automatisierung**: CI/CD-getriebene Deployments zur Reduzierung manueller Fehler.
4.  **Security-by-Design**: Gehärtete Images und sichere Standardkonfigurationen.

## Deployment-Umgebungen

| Umgebung        | Zweck                                   | Hosting                | Update-Frequenz |
| --------------- | --------------------------------------- | ---------------------- | --------------- |
| **Development** | Lokale Entwicklung                      | Docker Compose (lokal) | Ad-hoc          |
| **Staging**     | Abnahme, QA, Sicherheits-Reviews        | Zentral (Cloud/VM)     | Per Commit      |
| **Production**  | Echte Lehrkräfte-Nutzung (Pilotbetrieb) | Zentral oder Schul-VM  | Release-basiert |

## Container-Modell

Die Anwendung ist als Set von Microservices/Modulen konzipiert, die über Docker orchestriert werden.

### Komponenten (Stack)

- **App**: Next.js App Router (Standalone Build)
- **DB**: PostgreSQL (mit Drizzle-Migrationen)
- **Vector Store**: Qdrant
- **Storage**: MinIO (S3-kompatibel)
- **Cache/Queue**: Redis + BullMQ
- **Worker**: Separater Node.js Prozess für OCR/Extraktion
- **LLM Runtime**: Ollama (lokal im Stack)

### Orchestrierung

- **Lokal/Einfach**: Docker Compose (identisch mit `compose.yaml` im Root).
- **Produktion**: Docker Swarm (Docker Stack) oder gehärtetes Docker Compose.
- **Skalierung**: Vertikale Skalierung der Container-Ressourcen (CPU/RAM für Ollama).

## Deployment-Flow (CI/CD)

1.  **Build**: GitHub Actions baut Docker Images (Multi-Arch: `amd64`, ggf. `arm64` für Macs/Edge).
2.  **Registry**: Images werden in einer privaten GitHub Container Registry (GHCR) abgelegt.
3.  **Deploy**:
    - **Zentral**: GitHub Action triggert Webhook oder SSH-Deploy auf Ziel-Server.
    - **Lokal (Schule)**: Manueller oder automatisierter Pull des neuen Images via `docker compose pull`.

## Local-first & On-Premise (Schul-Server)

Für Installationen innerhalb von Schulnetzen gelten besondere Anforderungen:

- **Air-gapped Betrieb**: Der Stack muss (nach initialem Image-Pull) ohne Internetverbindung lauffähig sein (lokales Ollama).
- **Auto-Updates**: Optionaler Pull-basierter Mechanismus auf dem Host (z. B. via Cronjob), um den Docker-Socket nicht über Watchtower exponieren zu müssen (inkompatibel mit Air-gapped Betrieb).
- **Resilienz**: Automatischer Restart der Services bei Server-Reboot.

## Infrastruktur-Anforderungen

| Dienst      | Empfohlene Ressourcen (MVP)  | Hinweis                                     |
| ----------- | ---------------------------- | ------------------------------------------- |
| Gesamt-Host | 4 vCPU, 16 GB RAM, 50 GB SSD | Minimum für Ollama + Basis-Services         |
| Ollama      | 8 GB RAM dediziert           | Abhängig vom Modell (z.B. Llama 3, Mistral) |
| PostgreSQL  | 1 GB RAM, Backup-Volume      | Persistenz für Metadaten                    |

## Rollback-Strategie

- **Image-Tagging**: Jedes Deployment nutzt eindeutige Tags (Commit-SHA oder Version). `latest` wird nur als Alias genutzt.
- **Quick Rollback**: Ändern des Tags in der `compose.yaml` / im Stack-File und erneutes `docker stack deploy` / `docker compose up -d`.
- **Datenbank**: Migrationen sind so zu gestalten, dass sie idealerweise abwärtskompatibel sind (Add-only).

## Verweise

- [../../compose.yaml](../../compose.yaml) — Basis-Infrastruktur
- [CI_CD.md](./CI_CD.md) — Pipeline-Details
- [SECRET_MANAGEMENT.md](./SECRET_MANAGEMENT.md) — Sicherung der Credentials
- [BACKUP_AND_RECOVERY.md](./BACKUP_AND_RECOVERY.md) — Datensicherung
- [../adr/0004-local-first-student-data.md](../adr/0004-local-first-student-data.md) — Local-first Entscheidung
