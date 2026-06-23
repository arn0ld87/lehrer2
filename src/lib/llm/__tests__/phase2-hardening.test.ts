/**
 * phase2-hardening.test.ts — deckt die Härtungs-Fixes nach Review ab:
 *  - Grant-Scope prüft gradeBand (nicht nur subject)
 *  - Redaction/Guard fangen deutsche Rufnummern mit 0-Vorwahl + Trenner (ohne +49)
 *  - kein False-Positive auf datumsartige Zahlen
 *
 * Docker-frei (reine Logik + Fakes).
 */

import { describe, it, expect } from "vitest";
import { FakeGrantRepository, type CloudReleaseGrantRecord } from "@/lib/llm/policy";
import { redact } from "@/lib/privacy/redact";
import { assertNoPii, PiiGuardError } from "@/lib/privacy/guard";

function makeGrant(overrides: Partial<CloudReleaseGrantRecord> = {}): CloudReleaseGrantRecord {
  return {
    id: "g1",
    schoolId: "s1",
    provider: "openai",
    region: "eu-central-1",
    avvStatus: "signed",
    scope: { subjects: ["deutsch"], gradeBands: ["KS9"] },
    validFrom: new Date("2026-01-01T00:00:00Z"),
    validUntil: new Date("2027-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("Phase-2-Hardening", () => {
  describe("Grant-Scope: gradeBand", () => {
    it("lehnt Grant ab, wenn gradeBand außerhalb des Scopes liegt (KS9-Grant, KS10-Anfrage)", async () => {
      const repo = new FakeGrantRepository(makeGrant());
      const r = await repo.findActive({
        schoolId: "s1",
        provider: "openai",
        subject: "deutsch",
        gradeBand: "KS10",
        now: new Date("2026-06-01T00:00:00Z"),
      });
      expect(r).toBeNull();
    });

    it("akzeptiert Grant, wenn subject und gradeBand im Scope liegen", async () => {
      const repo = new FakeGrantRepository(makeGrant());
      const r = await repo.findActive({
        schoolId: "s1",
        provider: "openai",
        subject: "deutsch",
        gradeBand: "KS9",
        now: new Date("2026-06-01T00:00:00Z"),
      });
      expect(r).not.toBeNull();
    });
  });

  describe("Telefon mit 0-Vorwahl + Trenner (ohne Ländervorwahl)", () => {
    it("redact maskiert '0361 234567'", () => {
      const { redactedText, foundPii } = redact("Erreichbar unter 0361 234567 am Vormittag.");
      expect(redactedText).not.toContain("0361 234567");
      expect(foundPii.some((p) => p.category === "contact")).toBe(true);
    });

    it("guard schlägt bei '0351-1234567' an", () => {
      expect(() => assertNoPii("Bitte unter 0351-1234567 zurückrufen")).toThrow(PiiGuardError);
    });

    it("guard erzeugt keinen False-Positive auf datumsartige Zahlen ohne 0-Trunk", () => {
      expect(() => assertNoPii("Das Schuljahr 2024 2025 verlief erfolgreich.")).not.toThrow();
    });
  });
});
