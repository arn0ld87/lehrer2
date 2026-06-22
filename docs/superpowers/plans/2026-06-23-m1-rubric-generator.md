# M1 Rubric Generator Implementation Plan

**Goal:** Implementierung der Backend-Logik und UI-Komponenten für den Bewertungsraster- & Erwartungshorizont-Generator gemäß [RUBRIC_GENERATOR_SPEC.md](../../product/RUBRIC_GENERATOR_SPEC.md).

**Architecture:** Integration in den bestehenden `src/lib/rag` und `src/lib/db` Stack. LLM-Interaktion via Ollama (Local-first).

## Task 1: LLM-Prompting-Strategie & Service-Layer

**Files:**
- Create: `src/lib/artifacts/generator-service.ts`
- Create: `src/lib/artifacts/prompts.ts`

- [ ] **Step 1: Prompt-Templates definieren**
  - Definition von strukturierten Prompts für `ExpectationHorizon` und `Rubric`.
  - Anforderung an das Modell: Rückgabe von validem JSON, das direkt in die `jsonb`-Spalten passt.
  - Pflicht zur Quellen-Referenzierung im Prompt verankern.

- [ ] **Step 2: GeneratorService implementieren**
  - Methode `generateExpectationHorizon(taskId, context): Promise<PartialExpectationHorizon>`
  - Methode `generateRubric(taskId, context): Promise<PartialRubric>`
  - Integration mit dem RAG-System (Retrieval von Lehrplan-Kontext basierend auf `task.expectedCompetenceNodeId`).

## Task 2: UI-Komponenten für die Nachbearbeitung (Manual Review)

**Files:**
- Create: `src/components/correction/rubric-editor.tsx`
- Create: `src/components/correction/horizon-editor.tsx`

- [ ] **Step 1: RubricEditor Komponente**
  - Darstellung der Kriterien als Liste.
  - Inline-Editing für `label`, `weight` und `level_descriptors`.
  - Validierung: Summe der Gewichte muss 1.0 (oder 100%) ergeben.

- [ ] **Step 2: HorizonEditor Komponente**
  - Editor für die `model_solution`.
  - Tag-Input oder Liste für `acceptance_criteria`.
  - UI für `partial_credit_rules`.

- [ ] **Step 3: State-Management**
  - Handhabung der Draft-Zustände (KI-Vorschlag vs. Benutzereingabe).
  - "Finalisieren"-Button löst DB-Update und Statuswechsel aus.

## Task 3: Integration & API-Routes

**Files:**
- Create: `src/app/api/artifacts/generate-rubric/route.ts`
- Modify: `src/lib/db/repositories/artifacts.pg.ts` (falls Erweiterung nötig)

- [ ] **Step 1: API-Routes für die Generierung**
  - POST-Endpoints, die den `GeneratorService` aufrufen.
  - Absicherung durch `requireRole(teacher, "LEHRKRAFT")`.

- [ ] **Step 2: Repository-Methoden**
  - Sicherstellung, dass `saveRubric` und `saveExpectationHorizon` atomar und mit Audit-Log (Task 5 in M1 Step 2) funktionieren.

## Verifikation

- [ ] **Unit Tests:** Generierung von JSON-Strukturen aus Mock-LLM-Antworten prüfen.
- [ ] **UI-Tests:** Editierbarkeit der Felder und Validierung der Gewichte sicherstellen.
- [ ] **Integrationstest:** End-to-End Flow von Task-ID zu gespeichertem EH/Rubrik.
