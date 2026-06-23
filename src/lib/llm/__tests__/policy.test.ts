/**
 * policy.test.ts — Unit-Tests für ProviderPolicyGate (ADR 0002 §92, §109)
 *
 * Geprüft:
 *   - SENSITIVE_STUDENT ohne Grant → Cloud reject; lokal erlaubt
 *   - Abgelaufener Grant → reject
 *   - Scope-fremder Grant (falsches Fach) → reject
 *   - PUBLIC → Cloud erlaubt (kein Grant nötig)
 *   - INTERNAL / PERSONAL_TEACHER → immer lokal (PolicyViolationError bei Cloud-Anfrage)
 *   - Default-Pfad = lokal (requestedProviderId = "ollama")
 */

import { describe, it, expect } from "vitest";
import {
  ProviderPolicyGate,
  PolicyViolationError,
  FakeGrantRepository,
  type CloudReleaseGrantRecord,
} from "../policy";
import { FakeLlmProvider } from "../provider";

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

const LOCAL_ID = "ollama";
const CLOUD_ID = "openai";

function makeGate(grant: CloudReleaseGrantRecord | null = null): ProviderPolicyGate {
  const local = new FakeLlmProvider();
  Object.defineProperty(local, "id", { get: () => LOCAL_ID });

  const cloud = new FakeLlmProvider();
  Object.defineProperty(cloud, "id", { get: () => CLOUD_ID });
  Object.defineProperty(cloud, "requiresCloudGrant", { get: () => true });

  const cloudProviders = new Map([[CLOUD_ID, cloud]]);
  const grantRepo = new FakeGrantRepository(grant);

  return new ProviderPolicyGate(local, cloudProviders, grantRepo);
}

function futureDate(daysFromNow: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d;
}

function pastDate(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d;
}

function validGrant(overrides: Partial<CloudReleaseGrantRecord> = {}): CloudReleaseGrantRecord {
  return {
    id: "grant-1",
    schoolId: "school-abc",
    provider: CLOUD_ID,
    region: "eu-central-1",
    avvStatus: "signed",
    scope: { subjects: ["DEUTSCH"], gradeBands: ["KS9"] },
    validFrom: pastDate(30),
    validUntil: futureDate(30),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ProviderPolicyGate", () => {
  // ── Default: lokal ──────────────────────────────────────────────────────────

  it("gibt lokalen Provider zurück wenn requestedProviderId = 'ollama'", async () => {
    const gate = makeGate();
    const provider = await gate.selectProvider(LOCAL_ID, {
      userId: "u1",
      userRole: "teacher",
      dataClass: "PUBLIC",
    });
    expect(provider.id).toBe(LOCAL_ID);
  });

  it("gibt lokalen Provider zurück wenn Cloud-Provider nicht registriert ist", async () => {
    const gate = makeGate();
    const provider = await gate.selectProvider("unbekannter-provider", {
      userId: "u1",
      userRole: "teacher",
      dataClass: "PUBLIC",
    });
    expect(provider.id).toBe(LOCAL_ID);
  });

  // ── PUBLIC ──────────────────────────────────────────────────────────────────

  it("PUBLIC: erlaubt Cloud-Provider ohne Grant", async () => {
    const gate = makeGate(null); // kein Grant
    const provider = await gate.selectProvider(CLOUD_ID, {
      userId: "u1",
      userRole: "teacher",
      dataClass: "PUBLIC",
    });
    expect(provider.id).toBe(CLOUD_ID);
  });

  // ── INTERNAL / PERSONAL_TEACHER ─────────────────────────────────────────────

  it("INTERNAL: wirft PolicyViolationError bei Cloud-Anfrage", async () => {
    const gate = makeGate(validGrant());
    await expect(
      gate.selectProvider(CLOUD_ID, {
        userId: "u1",
        userRole: "teacher",
        dataClass: "INTERNAL",
      }),
    ).rejects.toThrow(PolicyViolationError);
  });

  it("PERSONAL_TEACHER: wirft PolicyViolationError bei Cloud-Anfrage", async () => {
    const gate = makeGate(validGrant());
    await expect(
      gate.selectProvider(CLOUD_ID, {
        userId: "u1",
        userRole: "teacher",
        dataClass: "PERSONAL_TEACHER",
      }),
    ).rejects.toThrow(PolicyViolationError);
  });

  it("INTERNAL: erlaubt lokalen Provider", async () => {
    const gate = makeGate();
    const provider = await gate.selectProvider(LOCAL_ID, {
      userId: "u1",
      userRole: "teacher",
      dataClass: "INTERNAL",
    });
    expect(provider.id).toBe(LOCAL_ID);
  });

  // ── SENSITIVE_STUDENT ohne Grant ────────────────────────────────────────────

  it("SENSITIVE_STUDENT ohne Grant: wirft PolicyViolationError für Cloud", async () => {
    const gate = makeGate(null);
    await expect(
      gate.selectProvider(CLOUD_ID, {
        userId: "u1",
        userRole: "teacher",
        dataClass: "SENSITIVE_STUDENT",
      }, { schoolId: "school-abc" }),
    ).rejects.toThrow(PolicyViolationError);
  });

  it("SENSITIVE_STUDENT ohne schoolId: wirft PolicyViolationError", async () => {
    const gate = makeGate(validGrant());
    await expect(
      gate.selectProvider(CLOUD_ID, {
        userId: "u1",
        userRole: "teacher",
        dataClass: "SENSITIVE_STUDENT",
        // schoolId fehlt absichtlich
      }, {}),
    ).rejects.toThrow(PolicyViolationError);
  });

  it("SENSITIVE_STUDENT mit lokalem Provider: erlaubt immer", async () => {
    const gate = makeGate(null);
    const provider = await gate.selectProvider(LOCAL_ID, {
      userId: "u1",
      userRole: "teacher",
      dataClass: "SENSITIVE_STUDENT",
    }, { schoolId: "school-abc" });
    expect(provider.id).toBe(LOCAL_ID);
  });

  // ── SENSITIVE_STUDENT mit gültigem Grant ────────────────────────────────────

  it("SENSITIVE_STUDENT mit gültigem Grant: erlaubt Cloud", async () => {
    const gate = makeGate(validGrant());
    const provider = await gate.selectProvider(CLOUD_ID, {
      userId: "u1",
      userRole: "teacher",
      dataClass: "SENSITIVE_STUDENT",
      subject: "DEUTSCH",
      gradeBand: "KS9",
    }, { schoolId: "school-abc" });
    expect(provider.id).toBe(CLOUD_ID);
  });

  // ── Abgelaufener Grant ──────────────────────────────────────────────────────

  it("abgelaufener Grant (validUntil in Vergangenheit): wirft PolicyViolationError", async () => {
    const expired = validGrant({ validUntil: pastDate(1) });
    const gate = makeGate(expired);
    await expect(
      gate.selectProvider(CLOUD_ID, {
        userId: "u1",
        userRole: "teacher",
        dataClass: "SENSITIVE_STUDENT",
        subject: "DEUTSCH",
      }, { schoolId: "school-abc" }),
    ).rejects.toThrow(PolicyViolationError);
  });

  it("Grant noch nicht aktiv (validFrom in Zukunft): wirft PolicyViolationError", async () => {
    const notYetValid = validGrant({ validFrom: futureDate(5) });
    const gate = makeGate(notYetValid);
    await expect(
      gate.selectProvider(CLOUD_ID, {
        userId: "u1",
        userRole: "teacher",
        dataClass: "SENSITIVE_STUDENT",
        subject: "DEUTSCH",
      }, { schoolId: "school-abc" }),
    ).rejects.toThrow(PolicyViolationError);
  });

  // ── Scope-fremder Grant ─────────────────────────────────────────────────────

  it("Grant mit falschem Fach (ETHIK statt DEUTSCH): wirft PolicyViolationError", async () => {
    const wrongScope = validGrant({
      scope: { subjects: ["ETHIK"], gradeBands: ["KS9"] },
    });
    const gate = makeGate(wrongScope);
    await expect(
      gate.selectProvider(CLOUD_ID, {
        userId: "u1",
        userRole: "teacher",
        dataClass: "SENSITIVE_STUDENT",
        subject: "DEUTSCH",
      }, { schoolId: "school-abc" }),
    ).rejects.toThrow(PolicyViolationError);
  });

  it("Grant mit falscher Schule: wirft PolicyViolationError", async () => {
    const wrongSchool = validGrant({ schoolId: "andere-schule" });
    const gate = makeGate(wrongSchool);
    await expect(
      gate.selectProvider(CLOUD_ID, {
        userId: "u1",
        userRole: "teacher",
        dataClass: "SENSITIVE_STUDENT",
        subject: "DEUTSCH",
      }, { schoolId: "school-abc" }),
    ).rejects.toThrow(PolicyViolationError);
  });

  it("AVV pending (nicht signed): wirft PolicyViolationError", async () => {
    const pending = validGrant({ avvStatus: "pending" });
    const gate = makeGate(pending);
    await expect(
      gate.selectProvider(CLOUD_ID, {
        userId: "u1",
        userRole: "teacher",
        dataClass: "SENSITIVE_STUDENT",
        subject: "DEUTSCH",
      }, { schoolId: "school-abc" }),
    ).rejects.toThrow(PolicyViolationError);
  });
});
