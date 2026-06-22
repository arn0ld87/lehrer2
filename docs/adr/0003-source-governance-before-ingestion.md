# 0003: Source-Governance vor Ingestion in den produktiven RAG

## Status

Akzeptiert, 2026-06-22

## Kontext

Das System wird Ressourcen (Arbeitsmaterialien, Schulbücher, Lehrpläne, Curricula, Artikel, etc.) in einen RAG-Index ingestionieren, um Lehrkräften kontextbasierte Vorschläge zu geben. Jede Quelle hat aber folgende Anforderungen:

1. **Urheberrecht**: Material muss lizenziert oder gemeinfrei sein. Unbegrenzte Schulkopien sind nicht legal.
2. **Aktualität**: Lehrpläne, Standards, Kerncurricula veralten; veraltete Inhalte in RAG führen zu falschen Empfehlungen.
3. **Korrektheit**: Nur technisch/inhaltlich gepflüfte Ressourcen sollten Schüler-Feedback beeinflussen.
4. **Haftung**: Wenn das System falsche Empfehlungen gibt, weil veraltete/lizenzwidrige Quellen ingestioniert wurden, trägt die Schule das Risiko.
5. **Vertrauen**: Lehrkräfte müssen wissen, was im RAG ist und woher es kommt (Zitierbarkeit).

Das Problem:

- Es ist verlockend, schnell Tausende PDFs in den RAG zu laden ("more data = better results")
- Ohne Governance werden ungepflügte, veraltete, möglicherweise lizenzwidrige Quellen gemischt
- Später ist unklar, warum der RAG falsche Vorschläge macht
- Haftungsrisiko für die Schule/Institution

## Optionen

### Option A: Freie Ingestion, Nachbesserung später

- **Pro**: Schnell, wenig Overhead
- **Contra**: Veraltete/falsche Quellen im Produktions-RAG, Haftungsrisiken, später teuer zu bereinigen

### Option B: Manuelle Peer-Review vor Ingestion

- **Pro**: Hohe Qualität, Kontrolle
- **Contra**: Bottleneck, slow, nicht skalierbar (1 Reviewer pro 50 Dokumente?), subjektiv

### Option C: Automatisierte Checks + Manuelles Approval-Gate

- **Pro**: Schnell für häufige Fälle, explizites Approval-Gate, Audit-Trail
- **Contra**: Automation incomplete (Lizenz-Text ist nicht strukturiert), manuelles Gate bleibt

### Option D: Registrierung vor Ingestion (Governance-First)

- **Pro**: Explizit, rechtlich nachvollziehbar, nur gepflügte Quellen im RAG
- **Contra**: Verzögerung, administrative Last, setzt Discipline voraus

## Entscheidung

**Governance-First Workflow (Option D)** mit folgenden Stufen:

### Stufe 1: Source Registry (Zentrales Inventar)

Eine Registry speichert Metadaten jeder geplanten Quelle:

```typescript
interface SourceRegistryEntry {
  id: string; // UUID
  title: string;
  originalUrl?: string; // Wo kam es her?
  uploadedAt: Date;
  uploadedBy: string; // userId der Lehrkraft

  // Lizenz & Rechtliches
  licenseType: "CC0" | "CC_BY" | "CC_BY_SA" | "Public_Domain" | "Custom" | "Copyright";
  licenseUrl?: string;
  licenseNotes?: string; // z.B. "Download mit Nennung erlaubt"
  termsOfUseUrl?: string;

  // Inhaltliche Klassifizierung
  category: "Curriculum" | "Textbook" | "Worksheet" | "Article" | "Tool" | "Other";
  subject?: string; // Deutsch, Mathematik, ...
  gradeLevel?: string[]; // ['5', '6'] = Klasse 5-6

  // Aktualität
  contentDate?: Date; // Wann wurde das Material erstellt/aktualisiert?
  isCurrentCurriculum: boolean; // true = noch gültig in unsere BL/Schule

  // Governance Status
  status: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "DEPRECATED";
  rejectionReason?: string; // Warum REJECTED?
  approvedAt?: Date;
  approvedBy?: string; // userId der Prüfperson (Admin/Supervisor)

  // RAG Integration
  ingestionAttemptedAt?: Date; // Wann wurde ingestioniert?
  ingestionStatus?: "PENDING" | "SUCCESS" | "FAILED";
  errorLog?: string; // Falls FAILED: Fehlerdetails
  vectorStoreId?: string; // Referenz ins Qdrant
}
```

### Stufe 2: Screening + Approval Workflow

1. **Automatic Screening** (via cron/BullMQ):
   - Lizenz-URL prüfbar? → Flag wenn nein
   - Content-Date älter als 5 Jahre bei `category='Curriculum'`? → Flag
   - Größe >100MB? → Flag (OCR wird teuer)
   - Duplicate-Check vs. Registry → Flag Duplikate

2. **Manual Approval** (Admin/Supervisor-UI):
   - Alle PENDING_REVIEW gehen in ein Approval-Dashboard
   - Prüfer sieht Automatisierungs-Flags, lädt PDF vor, entscheidet:
     - ✅ APPROVED → wird ingestioniert (BullMQ-Job triggered)
     - ❌ REJECTED → mit Grund (z.B. "Lizenz unklar", "Inhalte veraltet")
     - 🔄 PENDING_CLARIFICATION → zurück an Uploader (Lehrkraft): "Bitte Lizenztext hochladen"

3. **No Bypass**: Keine Quelle geht in produktiven RAG, solange Status ≠ APPROVED

### Stufe 3: Ingestion Trigger

Nur wenn `status === 'APPROVED'`:

- OCR (falls PDF)
- Chunking + Embedding via Qdrant
- Citation-Link speichern (für LLM-Responses später)
- Flag in Registry: `ingestionStatus = 'SUCCESS'`

Bei Fehler: `ingestionStatus = 'FAILED'`, Prüfer benachrichtigt, Fehlerlog geloggt.

### Stufe 4: Deprecation + Archival

Wenn Lehrplan/Curriculum veraltet:

- Maintainer setzt manuell `status = 'DEPRECATED'` in Registry
- BullMQ-Job entfernt alte Vektoren aus Qdrant (soft-delete, nie hard-delete)
- RAG schließt DEPRECATED Sources aus, aber Audit-Trail bleibt erhalten

### Conflict Resolution

Wenn zwei Versionen einer Ressource existieren (z.B. zwei unterschiedliche "Lehrplan Deutsch Klasse 9") oder widersprüchliche Inhalte:

- **Nicht**: RAG rät wild
- **Sondern**: Maintainer erstellt Issue mit beiden Links, User-facing Note:
  ```
  Mehrere Versionen dieses Lehrplans sind registriert.
  Bitte klären Sie die Aktualität mit Ihrer Schulleitung.
  Siehe [Versions-Vergleich-Link].
  ```
- Führt zu expliziter Lehrkraft-Entscheidung, nicht zu LLM-Raten

## Konsequenzen

### Positiv

- **Rechtssicherheit**: Nur lizenzierte/gemeinfrei Inhalte im RAG, Audit-Trail vollständig
- **Inhaltliche Qualität**: Veraltete Materialien explizit gemarkiert, nicht "zufällig" im RAG
- **Vertrauen**: Lehrkräfte sehen, woher RAG-Vorschläge kommen (Zitationslink zur Source Registry)
- **Änderungsmanagement**: Wenn Lehrplan wechselt, einfach alte Sources deprecaten, neue approven
- **Haftung**: Schule kann nachweisen, dass ungepflügte Quellen bewusst ausgeschlossen wurden

### Negativ/Managebar

- **Eingangsverzögerung**: Nicht alle Quellen sind sofort verfügbar (Approval pending)
- **Admin-Last**: Jemand muss gescreente PDFs durchschauen, Lizenz prüfen
- **False Negatives**: Automatic Flags können zu strikten Ablehnungen führen ("Content >5 Jahre alt" — aber Klassiker sind gültig)

### Maßnahmen

- **Flag-Tuning**: Thresholds pro `category` justierbar (z.B. Curriculum: 5 Jahre, Klassiker: 50 Jahre)
- **Batch Approval**: Admin kann "alle diese 10 Arbeitsblätter da Lehrkraft XY trusted" massenpproven
- **Communication**: Lehrkraft sieht, warum PENDING/REJECTED (nicht: "nope"), kann Material nachbessern

## Prozess-Übersicht

```
Lehrkraft lädt PDF hoch
         ↓
Registry Entry (DRAFT)
         ↓
Automatic Screening (Lizenz-URL, Alter, Größe, Duplikate)
         ↓
PENDING_REVIEW (mit Flags)
         ↓
Admin prüft im Dashboard
         ↓
[APPROVED] → BullMQ Ingestion Job → Qdrant
[REJECTED] → Lehrkraft benachrichtigt (mit Grund)
[PENDING_CLARIFICATION] → Lehrkraft lädt Lizenz-Beleg hoch
         ↓
Status aktualisiert
         ↓
Neu bei PENDING_REVIEW? → Admin prüft erneut
```

## Verweise

- [../rag/SOURCE_REGISTRY.md](../rag/SOURCE_REGISTRY.md) — Registry-Schema, Queries, Backups
- [../rag/INGESTION_POLICY.md](../rag/INGESTION_POLICY.md) — Detaillierte Lizenz-Checks, OCR-Prozess
- [../security/DATA_PROTECTION.md](../security/DATA_PROTECTION.md) — Urheberrecht im Kontext DSGVO (getrennte Concerns)
- [0002-provider-agnostic-llm-layer.md](0002-provider-agnostic-llm-layer.md) — Citation-Standard: LLM nennt Source-ID aus Registry
- [../../PLAN.md](../../PLAN.md) — MVP-Scope: Registry-UI in Phase 2
