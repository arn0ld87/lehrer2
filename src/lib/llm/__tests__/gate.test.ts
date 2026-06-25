/**
 * gate.test.ts — Fail-closed Verhalten von guardAssertion + withGate
 *
 * Pure Unit-Tests: kein Docker, kein Netzwerk, kein Postgres.
 * Alle Deps sind Inline-Fakes; FakeLLMProvider aus fake.ts.
 */

import { describe, it, expect, afterEach } from "vitest";
import { guardAssertion, GateBlockedError } from "@/lib/llm/guard";
import { withGate, type GrantReader, type AuditSink } from "@/lib/llm/gate";
import { FakeLLMProvider } from "@/lib/llm/fake";
import type { CallContext } from "@/lib/llm/provider";

// ── Inline-Fakes ──────────────────────────────────────────────────────────────

class NoOpAudit implements AuditSink {
  readonly events: Array<Parameters<AuditSink["record"]>[0]> = [];
  async record(event: Parameters<AuditSink["record"]>[0]): Promise<void> {
    this.events.push(event);
  }
}

class NullGrantReader implements GrantReader {
  async getActiveGrant(_args: {
    schoolId: string;
    provider: string;
    subject?: string;
    gradeBand?: string;
  }): Promise<{ id: string } | null> {
    return null;
  }
}

class FixedGrantReader implements GrantReader {
  constructor(private readonly grant: { id: string } | null) {}
  async getActiveGrant(_args: {
    schoolId: string;
    provider: string;
    subject?: string;
    gradeBand?: string;
  }): Promise<{ id: string } | null> {
    return this.grant;
  }
}

/** FakeLLMProvider-Subklasse, die explodiert wenn call() aufgerufen wird. */
class NeverCalledProvider extends FakeLLMProvider {
  called = false;
  override async call(prompt: string, context?: CallContext): Promise<string> {
    this.called = true;
    throw new Error("Provider.call() wurde aufgerufen — sollte NICHT passieren");
  }
}

const BASE_CTX: CallContext = {
  schoolId: "schule-01",
  userId: "user-01",
  destinationProvider: "ollama",
};

// ── guardAssertion ─────────────────────────────────────────────────────────────

describe("guardAssertion()", () => {
  it("wirft GateBlockedError(RESIDUAL_PII) bei E-Mail-Adresse", () => {
    expect(() => guardAssertion("kontakt: max@example.com")).toThrowError(GateBlockedError);
    try {
      guardAssertion("kontakt: max@example.com");
    } catch (err) {
      expect(err).toBeInstanceOf(GateBlockedError);
      expect((err as GateBlockedError).reason).toBe("RESIDUAL_PII");
    }
  });

  it("gibt true zurück bei legitimem Curriculum-Text (Eigenname darf NICHT blockiert werden)", () => {
    // Fix E (2026-06-25): Roh-Bigram deaktiviert — Curriculum-Eigennamen erlaubt
    const result = guardAssertion(
      "Martin Luther veröffentlichte 1517 die 95 Thesen in Wittenberg.",
    );
    expect(result).toBe(true);
  });

  it("wirft bei label-anchored Name-Rest", () => {
    expect(() => guardAssertion("Schüler: Max")).toThrowError(GateBlockedError);
  });

  it("wirft bei ISO-Datum (YYYY-MM-DD)", () => {
    expect(() => guardAssertion("Geburtsdatum: 2005-03-14")).toThrowError(GateBlockedError);
  });

  it("wirft bei 'dyskalkulie'", () => {
    expect(() => guardAssertion("Förderbedarf: Dyskalkulie")).toThrowError(GateBlockedError);
  });
});

// ── withGate — Lokaler Pfad ────────────────────────────────────────────────────

describe("withGate — lokaler Pfad (providerKind: local)", () => {
  it("löst auf, ruft den Provider auf, schreibt Audit-Event severity=info", async () => {
    const audit = new NoOpAudit();
    const inner = new FakeLLMProvider();
    const gated = withGate(inner, {
      providerKind: "local",
      grantReader: new NullGrantReader(),
      audit,
    });

    const result = await gated.call("Erkläre den Begriff Strophe.", BASE_CTX);

    // Provider wurde aufgerufen (FakeLLMProvider gibt deterministisches Format zurück)
    expect(result).toMatch(/^FAKE_RESPONSE\[/);

    // Audit-Event vorhanden, severity=info
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0].severity).toBe("info");
    expect(audit.events[0].eventType).toBe("llm_gate_local_call");
  });

  it("blockiert bei RESIDUAL_PII im Prompt (auch lokaler Pfad ist fail-closed)", async () => {
    // redact() verwendet \b-geankerte ISO-Datumsmuster (/\b\d{4}-\d{2}-\d{2}\b/g).
    // Ein Datum ohne Wortgrenze ("x2005-03-14x") überlebt redact() unverändert,
    // wird aber von der guard-Assertion (/\d{2,4}-\d{2}-\d{2}/, kein \b) erkannt.
    // Dadurch trifft guardAssertion BEVOR provider.call() erreicht wird.
    const audit = new NoOpAudit();
    const inner = new NeverCalledProvider();
    const gated = withGate(inner, {
      providerKind: "local",
      grantReader: new NullGrantReader(),
      audit,
    });

    let caughtErr: unknown;
    try {
      await gated.call("Schüler-Info: geburtsdatum=x2005-03-14x.", BASE_CTX);
    } catch (err) {
      caughtErr = err;
    }

    expect(caughtErr).toBeInstanceOf(GateBlockedError);
    expect((caughtErr as GateBlockedError).reason).toBe("RESIDUAL_PII");
    // Provider wurde NIE aufgerufen
    expect(inner.called).toBe(false);
  });
});

// ── withGate — Cloud-Pfad ─────────────────────────────────────────────────────

describe("withGate — Cloud-Pfad (providerKind: cloud)", () => {
  const originalEnv = process.env.CLOUD_LLM_ENABLED;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.CLOUD_LLM_ENABLED;
    } else {
      process.env.CLOUD_LLM_ENABLED = originalEnv;
    }
  });

  it("CLOUD_LLM_ENABLED nicht gesetzt → GateBlockedError(CLOUD_DISABLED), Provider nie aufgerufen", async () => {
    delete process.env.CLOUD_LLM_ENABLED;

    const audit = new NoOpAudit();
    const inner = new NeverCalledProvider();
    const gated = withGate(inner, {
      providerKind: "cloud",
      providerName: "openai",
      grantReader: new NullGrantReader(),
      audit,
    });

    let caughtErr: unknown;
    try {
      await gated.call("Lehrplan Deutsch Klasse 7.", BASE_CTX);
    } catch (err) {
      caughtErr = err;
    }

    expect(caughtErr).toBeInstanceOf(GateBlockedError);
    expect((caughtErr as GateBlockedError).reason).toBe("CLOUD_DISABLED");
    expect(inner.called).toBe(false);

    // Audit-Event mit severity=critical vorhanden
    expect(audit.events.some((e) => e.severity === "critical")).toBe(true);
  });

  it("CLOUD_LLM_ENABLED='false' → GateBlockedError(CLOUD_DISABLED)", async () => {
    process.env.CLOUD_LLM_ENABLED = "false";

    const audit = new NoOpAudit();
    const inner = new NeverCalledProvider();
    const gated = withGate(inner, {
      providerKind: "cloud",
      providerName: "openai",
      grantReader: new NullGrantReader(),
      audit,
    });

    await expect(
      gated.call("Lehrplan Deutsch Klasse 7.", BASE_CTX),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof GateBlockedError && err.reason === "CLOUD_DISABLED",
    );
    expect(inner.called).toBe(false);
  });

  it("CLOUD_LLM_ENABLED='true', grantReader liefert null, schoolId vorhanden → GateBlockedError(NO_ACTIVE_GRANT), Provider nie aufgerufen", async () => {
    process.env.CLOUD_LLM_ENABLED = "true";

    const audit = new NoOpAudit();
    const inner = new NeverCalledProvider();
    const gated = withGate(inner, {
      providerKind: "cloud",
      providerName: "openai",
      grantReader: new NullGrantReader(), // liefert null
      audit,
    });

    let caughtErr: unknown;
    try {
      await gated.call("Lehrplan Deutsch Klasse 7.", BASE_CTX);
    } catch (err) {
      caughtErr = err;
    }

    expect(caughtErr).toBeInstanceOf(GateBlockedError);
    expect((caughtErr as GateBlockedError).reason).toBe("NO_ACTIVE_GRANT");
    expect(inner.called).toBe(false);

    // Audit-Event critical
    expect(audit.events.some((e) => e.severity === "critical")).toBe(true);
  });

  it("CLOUD_LLM_ENABLED='true', grantReader liefert {id:'g1'}, voller Kontext → call() löst auf, Provider aufgerufen", async () => {
    process.env.CLOUD_LLM_ENABLED = "true";

    const audit = new NoOpAudit();
    const inner = new FakeLLMProvider();
    const gated = withGate(inner, {
      providerKind: "cloud",
      providerName: "openai",
      grantReader: new FixedGrantReader({ id: "g1" }),
      audit,
    });

    const result = await gated.call("Erkläre den Begriff Metapher.", {
      ...BASE_CTX,
      destinationProvider: "openai",
    });

    expect(result).toMatch(/^FAKE_RESPONSE\[/);

    // Audit-Event: info-Level für erfolgreichen Cloud-Call
    expect(audit.events.some((e) => e.severity === "info")).toBe(true);
    expect(audit.events.some((e) => e.eventType === "llm_gate_cloud_call")).toBe(true);
  });
});
