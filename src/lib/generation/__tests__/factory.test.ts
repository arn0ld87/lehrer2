/**
 * factory.test.ts — PgAuditSink + createGenerationDeps
 *
 * Pure Unit-Tests: kein Docker, kein Netzwerk, kein Postgres.
 *
 * PgAuditSink: Drizzle-insert-Stub prüft das values-Objekt.
 * createGenerationDeps: Smoke-Test — Strukturprüfung der 6 Keys;
 *   Konstruktoren öffnen keine Verbindung, daher ohne Mocking möglich.
 */

import { describe, it, expect, vi } from "vitest";
import { PgAuditSink, createGenerationDeps } from "@/lib/generation/factory";
import type { Db } from "@/lib/db/client";

// ── Hilfs-Typ für den gefakten DB-Stub ───────────────────────────────────────

/**
 * Minimaler Drizzle-Stub: insert().values() aufzeichnen und resolven.
 */
function makeFakeDb() {
  const insertedValues: Record<string, unknown>[] = [];
  const valuesFn = vi.fn().mockImplementation((v: Record<string, unknown>) => {
    insertedValues.push(v);
    return Promise.resolve();
  });
  const insertFn = vi.fn().mockReturnValue({ values: valuesFn });
  const fakeDb = { insert: insertFn } as unknown as Db;
  return { fakeDb, insertFn, valuesFn, insertedValues };
}

// ── PgAuditSink ───────────────────────────────────────────────────────────────

describe("PgAuditSink.record()", () => {
  it("schreibt eventType, actorId, subject, severity korrekt", async () => {
    const { fakeDb, insertFn, insertedValues } = makeFakeDb();
    const sink = new PgAuditSink(fakeDb);

    await sink.record({
      eventType: "llm_gate_local_call",
      actorId: "teacher-01",
      subject: "DEUTSCH",
      severity: "info",
      detail: "redactionApplied:false",
    });

    expect(insertFn).toHaveBeenCalledOnce();
    const values = insertedValues[0];
    expect(values.eventType).toBe("llm_gate_local_call");
    expect(values.actorId).toBe("teacher-01");
    expect(values.subject).toBe("DEUTSCH");
    expect(values.severity).toBe("info");
  });

  it("verpackt detail als { detail: string } im jsonb-Feld 'details'", async () => {
    const { fakeDb, insertedValues } = makeFakeDb();
    const sink = new PgAuditSink(fakeDb);

    await sink.record({
      eventType: "test_event",
      severity: "warning",
      detail: "Redaction applied — 2 categories",
    });

    expect(insertedValues[0].details).toEqual({ detail: "Redaction applied — 2 categories" });
  });

  it("details ist null wenn detail fehlt", async () => {
    const { fakeDb, insertedValues } = makeFakeDb();
    const sink = new PgAuditSink(fakeDb);

    await sink.record({ eventType: "minimal_event", severity: "info" });

    expect(insertedValues[0].details).toBeNull();
  });

  it("actorId und subject sind null wenn nicht übergeben", async () => {
    const { fakeDb, insertedValues } = makeFakeDb();
    const sink = new PgAuditSink(fakeDb);

    await sink.record({ eventType: "anon_event", severity: "critical" });

    expect(insertedValues[0].actorId).toBeNull();
    expect(insertedValues[0].subject).toBeNull();
  });

  it("severity 'warning' wird direkt durchgereicht", async () => {
    const { fakeDb, insertedValues } = makeFakeDb();
    const sink = new PgAuditSink(fakeDb);

    await sink.record({ eventType: "ev", severity: "warning" });

    expect(insertedValues[0].severity).toBe("warning");
  });

  it("severity 'critical' wird direkt durchgereicht", async () => {
    const { fakeDb, insertedValues } = makeFakeDb();
    const sink = new PgAuditSink(fakeDb);

    await sink.record({ eventType: "ev", severity: "critical" });

    expect(insertedValues[0].severity).toBe("critical");
  });

  it("kein Klarname oder PII in values (Guard-Regression)", async () => {
    const { fakeDb, insertedValues } = makeFakeDb();
    const sink = new PgAuditSink(fakeDb);

    // Simuliert einen Gate-Audit-Call mit nur technischen Metadaten
    await sink.record({
      eventType: "llm_gate_pii_guard_fail",
      actorId: "pseudonym-abc123",   // pseudonyme ID, kein Klarname
      subject: "llm_privacy_gate",
      severity: "critical",
      detail: JSON.stringify({ reason: "RESIDUAL_PII", provider: "local" }),
    });

    const values = insertedValues[0];
    const detailStr = JSON.stringify(values);
    // Kein Klarname-Muster (Vor-/Nachname) in den gespeicherten Werten
    expect(detailStr).not.toMatch(/\b[A-ZÄÖÜ][a-zäöü]+ [A-ZÄÖÜ][a-zäöü]+\b/);
  });
});

// ── createGenerationDeps ──────────────────────────────────────────────────────

describe("createGenerationDeps()", () => {
  it("liefert Objekt mit allen 6 GenerationDeps-Keys (Smoke, kein Netzwerk)", () => {
    // Konstruktoren von OllamaChatProvider, QdrantStore etc. öffnen keine
    // Verbindung — daher sicher ohne Mocking aufrufbar.
    const deps = createGenerationDeps();

    expect(deps).toHaveProperty("db");
    expect(deps).toHaveProperty("provider");
    expect(deps).toHaveProperty("embedder");
    expect(deps).toHaveProperty("store");
    expect(deps).toHaveProperty("sourceRefReader");
    expect(deps).toHaveProperty("audit");
  });

  it("audit ist eine PgAuditSink-Instanz", () => {
    const deps = createGenerationDeps();
    expect(deps.audit).toBeInstanceOf(PgAuditSink);
  });

  it("provider ist ein Objekt mit call, callStructured und estimateTokens", () => {
    const deps = createGenerationDeps();
    expect(typeof deps.provider.call).toBe("function");
    expect(typeof deps.provider.callStructured).toBe("function");
    expect(typeof deps.provider.estimateTokens).toBe("function");
  });
});
