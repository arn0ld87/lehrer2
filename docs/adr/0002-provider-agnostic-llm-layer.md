# 0002: Provider-agnostische LLM-Abstraktionsschicht

## Status

Akzeptiert, 2026-06-22

## Kontext

Das System muss Sprachmodelle einsetzen (Verfügbarmachung von RAG, Korrekturvorschläge, automatische Kategorisierung). Die Anforderungen sind:
- **Kosteneffizienz**: Lokale Ausführung (Ollama) ist Default
- **Datenschutz**: Schüler-Klarnamen verlassen das System nie; alle LLM-Calls gehen durch Redaction+Guard
- **Flexibilität**: Wechsel zwischen lokaler und Cloud-LLM ist konfigurierbar
- **Haftung**: Nur freigegebene Cloud-Provider (mit Schulfreigabe, AVV, DSFA) dürfen produktiv mit pseudonymisierten Daten arbeiten
- **Austauschbarkeit**: Lock-in zu einzelnem Provider vermeiden

Die Problemstellung:
- Diferentes LLM-Provider haben unterschiedliche APIs (OpenAI, Anthropic, local Ollama, etc.)
- Jeder Aufruf erfordert Datenschutz-Checks (Redaction, Guard)
- Cloud-LLM erfordert dokumentierte Schulfreigabe (CloudReleaseGrant: Rechtsgrundlage, AVV, DSFA, Provider/Region)
- Lokale Modelle haben unterschiedliche Capabilities (Embedding, Chat, etc.)

## Optionen

### Option A: Direkter Provider-Code (z.B. `openai` Bibliothek überall)
- **Pro**: Einfach, keine Abstraktionsschicht
- **Contra**: Redaction/Guard muss überall wiederholt werden, Provider-Wechsel kostet viel Refactoring, kein Fallback auf lokale Modelle

### Option B: Provider-agnostische Adapter (Langchain/LlamaIndex)
- **Pro**: Etabliert, viele Integrationen
- **Contra**: Overhead, Dependency-Hell, nicht alle Features sichtbar, schwierig für hochspezialisierten Datenschutz-Code

### Option C: Custom Abstraktionsschicht (LLMProvider Interface + konkrete Adapter)
- **Pro**: Volle Kontrolle über Redaction/Guard, minimal Dependencies, leicht zu testen
- **Contra**: Custom Code, wartungsaufwendig

### Option D: Hybrid (Custom für kritische Datenschutz-Calls, Langchain für unkritische Tasks)
- **Pro**: Pragmatisch, Best-of-Both
- **Contra**: Zwei Systeme zu lernen, inkonsistente Error-Handling möglich

## Entscheidung

**Custom Abstraktionsschicht (Option C)** mit folgender Struktur:

```
lib/
├── llm/
│   ├── types.ts                 # LLMProvider Interface, RequestContext
│   ├── redaction.ts             # Redaction-Engine (remove Student-Names, etc.)
│   ├── guard.ts                 # Guard: fail-closed Checks
│   ├── providers/
│   │   ├── ollama.ts            # Lokaler Default (OpenAI-kompatibel)
│   │   ├── openai.ts            # Wenn CloudReleaseGrant vorliegt
│   │   ├── anthropic.ts         # Alternativ, wenn freigebeben
│   │   └── local-api.ts         # Beliebige OpenAI-kompatible API
│   └── factory.ts               # Provider-Selection via Env/Config
└── rag/
    └── citation.ts              # RAG-Zitationen kommen auch durch Guard
```

### LLMProvider Interface

```typescript
interface LLMProvider {
  id: string; // "ollama" | "openai" | "anthropic"
  models: string[];
  requiresCloudGrant: boolean; // true => muss CloudReleaseGrant geprüft sein
  
  chat(params: ChatParams): Promise<ChatResponse>;
  embed(params: EmbedParams): Promise<Embedding[]>;
}

interface ChatParams {
  model: string;
  messages: Message[];
  context: RequestContext; // userId, dataClass, studentIds
}

interface RequestContext {
  userId: string;
  userRole: 'teacher' | 'admin';
  dataClass: 'PUBLIC' | 'INTERNAL' | 'PERSONAL_TEACHER' | 'SENSITIVE_STUDENT';
  studentIds?: string[]; // für Audit-Trail
}
```

### Redaction-Engine

1. **Input-Redaction** (vor LLM-Call):
   - Student-Klarnamen → `[STUDENT_PSEUDONYM]`
   - Telefonnummern, Adressen → `[REDACTED]`
   - Sensible Leistungsdaten → Zusammenfassung statt Rohdaten

2. **Output-Guard** (nach LLM-Response):
   - Response muss re-checked werden, ob neue Student-Namen hinzugekommen sind
   - Bei `SENSITIVE_STUDENT`: fail-closed (kein Response, statt unsicherer Fallback)

3. **Provider-Policy**:
   - `PUBLIC`: Alle Provider erlaubt
   - `INTERNAL`: Nur Ollama oder freigegebene OpenAI-kompatible lokale APIs
   - `PERSONAL_TEACHER`: Nur Ollama
   - `SENSITIVE_STUDENT`: Verboten (Guard lehnt ab), außer ausdrückliche dokumentierte Schulfreigabe

### CloudReleaseGrant

Nur wenn vorhanden:
```typescript
interface CloudReleaseGrant {
  providerId: string;        // "openai" | "anthropic"
  region: string;            // "eu" | "us"
  dataClasses: string[];     // ["PUBLIC", "INTERNAL"] (SENSITIVE_STUDENT nicht erlaubt)
  rechtsgrundlage: string;   // z.B. "Art. 6 Abs. 1 Buchstabe f DSGVO"
  avvUrl?: string;           // Auftragsverarbeitungsvertrag
  dsfaUrl?: string;          // Datenschutzfolgenabschätzung
  approvedAt: Date;
  approvedBy: string;        // Schulleitung Email
  expiresAt?: Date;          // optional, automatische Ablauf
}
```

Ist `CloudReleaseGrant` nicht vorhanden für einen Provider: **fail-closed** (Guard lehnt Call ab, loggt Event).

## Konsequenzen

### Positiv
- **Datenschutz-Enforcement**: Redaction+Guard können zentralisiert durchgesetzt werden, unabhängig von Provider-Wechsel
- **Lokaler Default**: Keine Netzwerk-Abhängigkeit, keine Cloud-Kosten, keine Latenz
- **Audit-Trail**: Jeder LLM-Call geht durch dieselbe Request-Context, nicht zu nachzuverfolgen
- **Provider-Wechsel**: Nur neuer Adapter nötig, keinen Redaction-Code berühren
- **Testing**: Redaction/Guard können unabhängig von Provider-Implementierung getestet werden (Mock-Provider)

### Negativ/Managebar
- **Custom Code**: Mehr Zeilen Code zu warten
- **Provider-Capabilities**: Nicht alle Provider haben alle Features (z.B. Embedding); Fallback nötig (z.B. Ollama hat `embed`, OpenAI auch, aber API unterscheidet sich)
- **Latenz**: Redaction (NER für Student-Name-Maskierung) hat CPU-Overhead; muss gemessen/optimiert werden

### Maßnahmen
- **Redaction-Cache**: Häufig maskierte Schlüsselwörter (z.B. Klassennamen) cachen
- **Provider-Fallback**: Wenn Cloud-Grant abgelaufen, automatisch auf Ollama zurückfallen
- **Testabdeckung**: Mock-Provider mit Fuzzing für Redaction-Robustheit
- **Monitoring**: Jeder LLM-Call geloggt mit `context.dataClass` und erfolgter Redaction
- **Dokumentation**: README.md > `LLM_CONFIGURATION` mit Beispielen für neue Provider

## Verweise

- [../architecture/INTEGRATION_BOUNDARIES.md](../architecture/INTEGRATION_BOUNDARIES.md) — LLM-Module im Kontext
- [../security/DATA_PROTECTION.md](../security/DATA_PROTECTION.md) — Redaction-Standards, Guard-Regeln
- [0001-modular-monolith-first.md](0001-modular-monolith-first.md) — Modul-Isolation, Worker-Prozess
- [0004-local-first-student-data.md](0004-local-first-student-data.md) — Datenfluss durch die Redaction-Schicht
