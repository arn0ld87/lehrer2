/**
 * flow.test.ts — Unit-Tests für den LLM-Flow-Orchestrator (runFlow)
 *
 * Alle Abhängigkeiten sind injiziert (Fakes) — kein Docker, kein Netzwerk.
 *
 * Geprüft:
 *   - Guard greift VOR Provider-Call: FakeProvider wird NICHT aufgerufen wenn
 *     der Payload nach Redaction noch PII enthält.
 *   - Default-Pfad = lokal (kein Cloud-Provider ohne explizite Konfiguration).
 *   - Pseudonymisierung + Redaction werden angewendet bevor der Provider aufgerufen wird.
 *   - Provenienz-Record enthält redactionApplied=true nach Redaction.
 *   - Re-Identifikation findet NUR auf lokalem Pfad statt.
 *   - PolicyViolationError bei SENSITIVE_STUDENT ohne Grant.
 *   - Audit-Log enthält Security-Event bei Guard-Failure.
 */

import { describe, it, expect } from "vitest";
import { runFlow, FakeProvenanceWriter, FakeAuditLogger, type FlowDeps } from "../flow";
import { FakeLlmProvider } from "../provider";
import {
  ProviderPolicyGate,
  PolicyViolationError,
  FakeGrantRepository,
} from "../policy";
import { FakePseudonymRepository } from "@/lib/privacy/pseudonymize";
import { FakeEmbedder } from "@/lib/infra/ollama";
import { FakeVectorStore } from "@/lib/infra/qdrant";
import type { SourceRefReader } from "@/lib/rag/retrieve";
import type { SourceRefMeta } from "@/lib/rag/citation";
import { PiiGuardError } from "@/lib/privacy/guard";

// ─── Fake-SourceRefReader ─────────────────────────────────────────────────────

class FakeSourceRefReader implements SourceRefReader {
  private refs: Map<string, SourceRefMeta>;
  constructor(refs: SourceRefMeta[] = []) {
    this.refs = new Map(refs.map((r) => [r.id, r]));
  }
  async getById(id: string): Promise<SourceRefMeta | null> {
    return this.refs.get(id) ?? null;
  }
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

const LOCAL_ID = "ollama";
const CLOUD_ID = "openai";

function makeDeps(opts: {
  fixedReply?: string;
  cloudProvider?: FakeLlmProvider;
  grant?: import("../policy").CloudReleaseGrantRecord | null;
} = {}): { deps: FlowDeps; fakeProvider: FakeLlmProvider; provWriter: FakeProvenanceWriter; auditLogger: FakeAuditLogger } {
  const fakeProvider = new FakeLlmProvider(opts.fixedReply);
  // Patch id to "ollama" so it matches LOCAL_ID
  Object.defineProperty(fakeProvider, "id", { get: () => LOCAL_ID });

  const cloudMap = new Map<string, FakeLlmProvider>();
  if (opts.cloudProvider) {
    Object.defineProperty(opts.cloudProvider, "id", { get: () => CLOUD_ID });
    Object.defineProperty(opts.cloudProvider, "requiresCloudGrant", { get: () => true });
    cloudMap.set(CLOUD_ID, opts.cloudProvider);
  }

  const grantRepo = new FakeGrantRepository(opts.grant ?? undefined);
  const policyGate = new ProviderPolicyGate(fakeProvider, cloudMap, grantRepo);

  const pseudonymRepo = new FakePseudonymRepository();
  const pseudonymDeps = {
    repo: pseudonymRepo,
    schoolSecret: "test-secret",
    schoolId: "school-1",
  };

  const retrieveDeps = {
    embedder: new FakeEmbedder(8),
    store: new FakeVectorStore(),
    sourceRefReader: new FakeSourceRefReader(),
  };

  const provWriter = new FakeProvenanceWriter();
  const auditLogger = new FakeAuditLogger();

  return {
    deps: { policyGate, retrieveDeps, pseudonymDeps, provenanceWriter: provWriter, auditLogger },
    fakeProvider,
    provWriter,
    auditLogger,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("runFlow", () => {
  // ── Default-Pfad: lokal ─────────────────────────────────────────────────────

  it("Standard-Flow mit sauberem Text: Provider wird aufgerufen, gibt Antwort zurück", async () => {
    const { deps, fakeProvider } = makeDeps({ fixedReply: "Gute Erklärung!" });

    const result = await runFlow(deps, {
      messages: [{ role: "user", content: "Erkläre den Begriff Metapher." }],
      dataClass: "PUBLIC",
      userId: "teacher-1",
      userRole: "teacher",
    });

    expect(result.text).toBe("Gute Erklärung!");
    expect(result.provider).toBe(LOCAL_ID);
    expect(fakeProvider.calls.length).toBe(1);
  });

  it("Default requestedProviderId ist 'ollama'", async () => {
    const { deps, fakeProvider } = makeDeps();

    await runFlow(deps, {
      messages: [{ role: "user", content: "Frage ohne Provider-Angabe" }],
      dataClass: "INTERNAL",
      userId: "teacher-1",
      userRole: "teacher",
    });

    expect(fakeProvider.calls.length).toBe(1);
  });

  // ── Guard greift VOR Provider-Call ──────────────────────────────────────────

  it("Guard wirft PiiGuardError → Provider wird NICHT aufgerufen", async () => {
    const { deps, fakeProvider } = makeDeps();

    // redactFn wird als No-op injiziert: PII bleibt im Text → Guard soll anschlagen.
    // So testen wir den Guard isoliert, unabhängig von der Redaction-Qualität.
    const noopRedact = (text: string) => ({ redactedText: text, foundPii: [] as import("@/lib/privacy/redact").PiiMatch[] });
    const depsWithNoopRedact = { ...deps, redactFn: noopRedact };

    // ISO-Datum + PLZ: beide Guard-Patterns, aber kein Redaction-Override nötig
    const piiMessage = "Schüler wohnt in 06108 Halle, Geburtsdatum 2009-03-15.";

    await expect(
      runFlow(depsWithNoopRedact, {
        messages: [{ role: "user", content: piiMessage }],
        dataClass: "SENSITIVE_STUDENT",
        userId: "teacher-1",
        userRole: "teacher",
        schoolId: "school-1",
      }),
    ).rejects.toThrow(PiiGuardError);

    // Provider darf NICHT aufgerufen worden sein
    expect(fakeProvider.calls.length).toBe(0);
  });

  it("Guard-Failure: Audit-Log enthält PII_GUARD_FAILURE-Event mit critical severity", async () => {
    const { deps, auditLogger } = makeDeps();

    const noopRedact = (text: string) => ({ redactedText: text, foundPii: [] as import("@/lib/privacy/redact").PiiMatch[] });
    const depsWithNoopRedact = { ...deps, redactFn: noopRedact };

    try {
      await runFlow(depsWithNoopRedact, {
        messages: [{ role: "user", content: "Wohnhaft 06108 Halle, geboren 2009-03-15" }],
        dataClass: "SENSITIVE_STUDENT",
        userId: "teacher-1",
        userRole: "teacher",
        schoolId: "school-1",
      });
    } catch {
      // erwartet
    }

    const guardEvent = auditLogger.events.find((e) => e.eventType === "PII_GUARD_FAILURE");
    expect(guardEvent).toBeDefined();
    expect(guardEvent!.severity).toBe("critical");
  });

  // ── Redaction ───────────────────────────────────────────────────────────────

  it("Redaction wird angewendet: Provider erhält maskierten Text statt PII", async () => {
    const { deps, fakeProvider } = makeDeps();

    // Nachricht enthält E-Mail (wird redacted) — kein Namen-Pattern → Guard besteht
    const msgWithEmail = "Kontakt unter test@schule.de für Rückfragen.";

    await runFlow(deps, {
      messages: [{ role: "user", content: msgWithEmail }],
      dataClass: "INTERNAL",
      userId: "teacher-1",
      userRole: "teacher",
    });

    expect(fakeProvider.calls.length).toBe(1);
    const sentMsg = fakeProvider.calls[0]!.messages.find((m) => m.role === "user");
    expect(sentMsg!.content).not.toContain("@schule.de");
    expect(sentMsg!.content).toContain("[KONTAKT_REDACTED]");
  });

  it("redactionApplied = true wenn Redaction stattgefunden hat", async () => {
    const { deps, provWriter } = makeDeps();

    await runFlow(deps, {
      messages: [{ role: "user", content: "E-Mail: abc@test.de" }],
      dataClass: "INTERNAL",
      userId: "teacher-1",
      userRole: "teacher",
    });

    expect(provWriter.records.length).toBe(1);
    expect(provWriter.records[0]!.redactionApplied).toBe(true);
  });

  it("redactionApplied = false wenn kein PII vorhanden", async () => {
    const { deps, provWriter } = makeDeps();

    await runFlow(deps, {
      messages: [{ role: "user", content: "Erkläre den Begriff Metapher." }],
      dataClass: "PUBLIC",
      userId: "teacher-1",
      userRole: "teacher",
    });

    expect(provWriter.records.length).toBe(1);
    expect(provWriter.records[0]!.redactionApplied).toBe(false);
  });

  // ── Pseudonymisierung ───────────────────────────────────────────────────────

  it("studentRefs werden pseudonymisiert vor Provider-Call", async () => {
    const { deps, fakeProvider } = makeDeps();

    await runFlow(deps, {
      messages: [{ role: "user", content: "Notizen zu student-007 und student-008." }],
      dataClass: "SENSITIVE_STUDENT",
      userId: "teacher-1",
      userRole: "teacher",
      schoolId: "school-1",
      studentRefs: ["student-007", "student-008"],
    });

    expect(fakeProvider.calls.length).toBe(1);
    const sentMsg = fakeProvider.calls[0]!.messages.find((m) => m.role === "user");
    // Interne IDs dürfen nicht im Provider-Payload erscheinen
    expect(sentMsg!.content).not.toContain("student-007");
    expect(sentMsg!.content).not.toContain("student-008");
  });

  // ── Re-Identifikation NUR lokal ─────────────────────────────────────────────

  it("Re-Identifikation findet auf lokalem Pfad statt: Pseudonym in Antwort → interne ID", async () => {
    const { deps } = makeDeps();

    // Pseudonym für student-001 vorab anlegen
    const pseudonymRepo = deps.pseudonymDeps.repo as FakePseudonymRepository;
    const { computePseudonymId } = await import("@/lib/privacy/pseudonymize");
    const pid = computePseudonymId("test-secret", "student-001");
    await pseudonymRepo.upsert({ pseudonymId: pid, studentRef: "student-001", schoolId: "school-1" });

    const { deps: deps2, fakeProvider } = makeDeps({ fixedReply: `Bewertung für ${pid}: gut.` });
    // Manuell das Repo überschreiben mit dem vorbereiteten (über unknown für TS)
    (deps2.pseudonymDeps as unknown as { repo: FakePseudonymRepository }).repo = pseudonymRepo;

    const result = await runFlow(deps2, {
      messages: [{ role: "user", content: "Bitte Student-Feedback erstellen." }],
      dataClass: "INTERNAL",
      userId: "teacher-1",
      userRole: "teacher",
      studentRefs: ["student-001"],
    });

    // Lokaler Provider → Re-Identifikation → interne ID erscheint in Antwort
    expect(result.text).toContain("student-001");
    // Pseudonym ist weg
    expect(result.text).not.toContain(pid);
    expect(fakeProvider.calls.length).toBe(1);
  });

  // ── Provenienz-Record ───────────────────────────────────────────────────────

  it("Provenienz-Record wird nach jedem erfolgreichen Call geschrieben", async () => {
    const { deps, provWriter } = makeDeps();

    await runFlow(deps, {
      messages: [{ role: "user", content: "Unterrichtsplanung für Klasse 9." }],
      dataClass: "INTERNAL",
      userId: "teacher-1",
      userRole: "teacher",
      artifactType: "TEACHING_UNIT",
      artifactId: "unit-123",
    });

    expect(provWriter.records.length).toBe(1);
    const rec = provWriter.records[0]!;
    expect(rec.provider).toBe(LOCAL_ID);
    expect(rec.ownerTeacherId).toBe("teacher-1");
    expect(rec.artifactType).toBe("TEACHING_UNIT");
    expect(rec.artifactId).toBe("unit-123");
    expect(typeof rec.promptHash).toBe("string");
    expect(rec.promptHash.length).toBeGreaterThan(0);
  });

  // ── Audit-Log bei Erfolg ────────────────────────────────────────────────────

  it("Audit-Log enthält LLM_CALL_SUCCESS bei erfolgreichem Call", async () => {
    const { deps, auditLogger } = makeDeps();

    await runFlow(deps, {
      messages: [{ role: "user", content: "Frage für Unterrichtsplanung." }],
      dataClass: "PUBLIC",
      userId: "teacher-1",
      userRole: "teacher",
    });

    const successEvent = auditLogger.events.find((e) => e.eventType === "LLM_CALL_SUCCESS");
    expect(successEvent).toBeDefined();
    expect(successEvent!.severity).toBe("info");
  });

  // ── PolicyViolationError ────────────────────────────────────────────────────

  it("SENSITIVE_STUDENT + Cloud-Provider ohne Grant → PolicyViolationError, kein Provider-Call", async () => {
    const cloudProvider = new FakeLlmProvider("cloud-reply");
    const { deps, fakeProvider } = makeDeps({ cloudProvider, grant: undefined });

    await expect(
      runFlow(deps, {
        messages: [{ role: "user", content: "Feedback zu Schülerarbeit." }],
        dataClass: "SENSITIVE_STUDENT",
        userId: "teacher-1",
        userRole: "teacher",
        schoolId: "school-1",
        requestedProviderId: CLOUD_ID,
      }),
    ).rejects.toThrow(PolicyViolationError);

    // Weder lokaler noch Cloud-Provider wurde aufgerufen
    expect(fakeProvider.calls.length).toBe(0);
    expect(cloudProvider.calls.length).toBe(0);
  });

  // ── System-Messages ─────────────────────────────────────────────────────────

  it("System-Prompt wird an Provider weitergegeben", async () => {
    const { deps, fakeProvider } = makeDeps();

    await runFlow(deps, {
      messages: [{ role: "user", content: "Frage" }],
      system: "Du bist ein hilfreicher Assistent für Lehrkräfte.",
      dataClass: "PUBLIC",
      userId: "teacher-1",
      userRole: "teacher",
    });

    expect(fakeProvider.calls[0]?.system).toBe("Du bist ein hilfreicher Assistent für Lehrkräfte.");
  });
});
