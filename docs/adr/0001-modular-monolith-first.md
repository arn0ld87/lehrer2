# 0001: Modularer Monolith als Startarchitektur

## Status

Akzeptiert, 2026-06-22

## Kontext

Das Projekt "Unterrichtsassistenz LSA" ist ein Greenfield-Projekt für eine kleine bis mittlere Lehrkraft/Admin-Gruppe in Deutschland. Die Anforderungen:
- Schnelle Marktreife (MVP in 2–3 Monaten)
- Kleines Team (1–2 Backend-Entwickler, 1 Frontend)
- Kostenoptimiert, primär Self-Hosted
- Hohe Anforderungen an Datenschutz und Wartbarkeit
- Evolvierbarkeit: Die Systemgrenzen sind heute noch nicht vollständig stabil

Architekturoptionen:
1. **Monolith** (einfachste Datenbankabstraktion, höchstes Coupling)
2. **Modularer Monolith** (logische Module mit klaren Grenzen, eine Deployable, später aufteilbar)
3. **Microservices** (hohe Komplexität, hohe Ops-Last, für MVP überdimensioniert)
4. **Serverless** (Lock-in zu Cloud-Provider, Kostenunsicherheit, nicht Self-Host-kompatibel)

## Optionen

### Option A: Klassischer Monolith (Next.js + PostgreSQL)
- **Pro**: Absolute Einfachheit, schnellste Implementierung, minimale Infrastruktur
- **Contra**: Später schwer zu modularisieren, keine sauberen Schnittstellen, OCR/Worker-Isolation unklar

### Option B: Modularer Monolith (Next.js + PostgreSQL, + separater Worker-Prozess)
- **Pro**: Logische Modulgrenzen auch ohne Micro-Services, OCR-Workload isoliert, später einfach zu Microservices migrierbar, eine Deployable pro Modul
- **Contra**: Erfordert disziplinierten Code-Hygiene (kein Cross-Cutting), API-Grenzen müssen eingehalten werden

### Option C: Microservices von Tag 1
- **Pro**: Saubere, unabhängige Services
- **Contra**: Overhead in Development/Ops, Netzwerk-Latenz, Deployment-Komplexität, für MVP unrealistisch

### Option D: Serverless (AWS Lambda / Google Cloud Run)
- **Pro**: Pay-per-use, keine Ops
- **Contra**: Vendor Lock-in, Cold Starts, teuer bei dauerhafter Last, Self-Host-Anforderung nicht erfüllbar

## Entscheidung

**Modularer Monolith mit separatem Worker** (Option B)

Implementierung:
- **Produktions-App**: Next.js App Router + TypeScript, Single Deployable
- **Logische Module**: 
  - `api/` (core, Datenbankzugriff über Drizzle ORM)
  - `rag/` (RAG-Orchestrierung, Vektorabfrage, keine Student-Daten!)
  - `auth/` (Rollenprüfung, Session)
  - `redaction/` (Guard-Middleware für LLM-Calls)
- **Separater Prozess**: OCR-Worker (BullMQ + Bullmq-job-scheduler) für Long-Running-Tasks, läuft ggf. im selben Container oder dediziertem Worker-Pod
- **Modul-API**: Explizite Import-Grenzen; keine zirkulären Dependencies
- **Datenbankschema**: Drizzle Migrations sichern Modul-Grenzen

**Migration-Pfad zu Microservices**: Jedes Modul kann später als separater Service deployed werden, wenn Skalierung nötig wird (z.B. RAG-Service bei hoher Vektorsuch-Last).

## Konsequenzen

### Positiv
- **Schnelle MVP-Fertigstellung**: Keine Infrastruktur-Komplexität, lokal mit Docker Compose entwickelbar
- **Self-Hosting-freundlich**: Eine App, ein Datenbankverbindung, minimale Netzwerk-Overhead
- **Modulgrenzen durchsetzbar**: Disziplinierte Code-Struktur verhindert Spaghetti-Code
- **Evolvierbar**: Wenn einzelne Module (z.B. OCR, RAG) zu Hot-Spots werden, können sie gezielt extracted werden

### Negativ/Managebar
- **Disziplin erforderlich**: Code-Reviews müssen Modul-Grenzen durchsetzen; kein automatischer Isolation wie bei Microservices
- **Skalierung**: Monolith-Resize ist für große Schulnetze nicht optimal (alle Module skalieren zusammen); aber für MVP ausreichend
- **OCR-Workload**: Worker-Prozess muss asynchron sein (BullMQ); synchrone Calls sind nicht erlaubt

### Maßnahmen
- Import-Guards in ESLint (keine zirkulären Imports)
- Separate `worker/` Entrypoint für OCR-Jobs
- Drizzle Migrations als Checkpoint pro Modul
- API-Boundary Tests (z.B. `api/__tests__/module-boundaries.test.ts`)

## Verweise

- [../architecture/ARCHITECTURE.md](../architecture/ARCHITECTURE.md) — Detaillierte Modul-Struktur
- [../../PLAN.md](../../PLAN.md) — MVP-Timeline und Phasen
- [0004-local-first-student-data.md](0004-local-first-student-data.md) — Datenschutz-Konsequenzen für Modul-Grenzen
