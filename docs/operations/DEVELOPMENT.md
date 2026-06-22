# Entwicklungsumgebung

Dieses Dokument beschreibt die Einrichtung der lokalen Entwicklungsumgebung für das Unterrichtsassistenz-LSA-Projekt.

## Voraussetzungen

### Node.js

Die erforderliche Node.js-Version ist in [../../.nvmrc](../../.nvmrc) definiert. Nutze einen Node-Version-Manager (nvm, asdf oder ähnlich) zum Wechsel auf die richtige Version:

```bash
nvm use
# oder
asdf install
```

### Docker und Docker Compose

Das Projekt nutzt Docker Compose zur Orchestrierung der Infrastruktur-Services. Installiere:

- **Docker** (empfohlen: Docker Desktop für macOS/Windows oder Docker Engine + Compose Plugin für Linux)
- **Docker Compose** v2+

Überprüfe die Installation:

```bash
docker --version
docker compose version
```

### Optional: Ollama (lokal)

Für lokale LLM-Entwicklung kann Ollama installiert werden. Dies ist optional; in der Standard-Konfiguration lädt das System das Ollama-Image über Docker Compose.

- [ollama.ai](https://ollama.ai)
- Nach Installation: `ollama pull` für gewünschte Modelle ausführen (falls nicht über Docker bereitgestellt)

## Erststart

### 1. Repository klonen

```bash
git clone https://github.com/arn0ld87/lehrer2.git
cd lehrer2
```

### 2. Umgebungsvariablen konfigurieren

Kopiere die Beispielkonfiguration:

```bash
cp .env.example .env
```

Passe [.env](../../.env.example) bei Bedarf an (z. B. Datenbank-Passwörter, MinIO-Credentials). Die lokale `.env` wird durch `cp .env.example .env` erzeugt und ist gitignored.

### 3. Services starten

Starte alle erforderlichen Services über Docker Compose (siehe [../../compose.yaml](../../compose.yaml)):

```bash
docker compose up -d
```

Dies startet folgende Container:

- **PostgreSQL**: Datenbank für Metadaten und Benutzerkonten
- **Qdrant**: Vektor-Datenbank für Embedding-basierte Suche
- **MinIO**: Object Store für Dokumente und Artefakte
- **Redis**: In-Memory-Store für Sessions und Caching
- **Ollama**: LLM-Runtime (optional, lokal)

Überprüfe den Status:

```bash
docker compose ps
```

### 4. Abhängigkeiten installieren

```bash
npm install
```

## Qualitätsbefehle

Führe vor jedem Commit folgende Checks aus:

### Dokumentation verifizieren

```bash
npm run verify:docs
```

Dies prüft die Konsistenz und Vollständigkeit aller Markdown-Dateien. Das Skript nutzt [../../scripts/verify-docs.sh](../../scripts/verify-docs.sh).

### Code-Formatierung prüfen

```bash
npm run format:check
```

Um Formatierungsfehler automatisch zu beheben:

```bash
npm run format
```

## Status der Anwendung

**WICHTIG**: Die Anwendung existiert derzeit nur als Fundament. Es gibt noch keinen App-Code zu bauen oder zu testen.

Folgende Komponenten sind vorhanden:

- Projektstruktur und Dokumentation
- Docker Compose-Konfiguration für Services
- Package.json mit npm-Scripts für Dokumentation und Formatierung
- Qualitätswerkzeuge (Prettier, Verifizierungsskripte)

App-Entwicklung und Unit/Integrationstests folgen in späteren Phasen.

## Verzeichnisstruktur

```
lehrer2/
├── docs/                      # Dokumentation
│   ├── operations/            # Betriebsdoku
│   │   ├── DEVELOPMENT.md    # (diese Datei)
│   │   ├── CI_CD.md
│   │   └── BACKUP_AND_RECOVERY.md
│   ├── security/              # Sicherheitsdoku
│   └── ...
├── data/                       # Test- und Beispieldaten
├── scripts/                    # Hilfsskripte (verify-docs.sh, etc.)
├── .github/
│   └── workflows/
│       └── ci.yml             # GitHub Actions
├── compose.yaml               # Docker Compose-Konfiguration
├── .env.example               # Umgebungsvariablen-Template
├── package.json               # npm-Scripts und Dependencies
├── .nvmrc                      # Node.js-Version
└── PLAN.md                     # Projektplan (Quelle der Wahrheit)
```

## Weitere Ressourcen

- [CI/CD-Pipeline](./CI_CD.md) – GitHub Actions und Gating
- [Projektplan](../../PLAN.md) – Roadmap und Architektur
- [Docker Compose](../../compose.yaml) – Infrastruktur-Definitionen
- [Package-Scripts](../../package.json) – Verfügbare npm-Befehle
