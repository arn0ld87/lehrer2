/**
 * redact-pseudonymize.test.ts — Round-trip-Tests für redact + pseudonymize
 *
 * Geprüft:
 *   - redact() maskiert PII-Kategorien aus §2.1
 *   - redactedText enthält keine PII mehr (Guard besteht)
 *   - pseudonymize() erzeugt stabiles Pseudonym (deterministisch)
 *   - pseudonymizeText() ersetzt interne IDs im Text
 *   - reidentify() stellt interne IDs nur lokal wieder her
 *   - Klarnamen verlassen das System NIE (Redaction schützt davor)
 */

import { describe, it, expect } from "vitest";
import { redact, MASK_NAME, MASK_DATE, MASK_CONTACT, MASK_ADDRESS, MASK_TRAIT } from "../redact";
import {
  pseudonymize,
  pseudonymizeText,
  reidentify,
  computePseudonymId,
  FakePseudonymRepository,
} from "../pseudonymize";
import { assertNoPii } from "../guard";

// ─── redact() ─────────────────────────────────────────────────────────────────

describe("redact()", () => {
  it("maskiert E-Mail-Adresse → KONTAKT_REDACTED", () => {
    const { redactedText } = redact("Kontakt: max.mueller@schule.de bitte melden.");
    expect(redactedText).toContain(MASK_CONTACT);
    expect(redactedText).not.toContain("@schule.de");
  });

  it("maskiert DD.MM.YYYY-Datum → DATUM_REDACTED", () => {
    const { redactedText } = redact("Geburtsdatum: 15.03.2009");
    expect(redactedText).toContain(MASK_DATE);
    expect(redactedText).not.toContain("15.03.2009");
  });

  it("maskiert ISO-Datum YYYY-MM-DD → DATUM_REDACTED", () => {
    const { redactedText } = redact("DOB: 2009-03-15 in der DB");
    expect(redactedText).toContain(MASK_DATE);
    expect(redactedText).not.toContain("2009-03-15");
  });

  it("maskiert PLZ + Ort → ADRESSE_REDACTED", () => {
    const { redactedText } = redact("Wohnhaft: 06108 Halle (Saale)");
    expect(redactedText).toContain(MASK_ADDRESS);
  });

  it("maskiert sensible Merkmale LRS → MERKMAL_REDACTED", () => {
    const { redactedText } = redact("Schüler hat diagnostiziertes LRS und Dyskalkulie.");
    expect(redactedText).toContain(MASK_TRAIT);
    expect(redactedText).not.toContain("LRS");
    expect(redactedText).not.toContain("Dyskalkulie");
  });

  it("maskiert ADHS → MERKMAL_REDACTED", () => {
    const { redactedText } = redact("Diagnose: ADHS-Betroffener Schüler");
    expect(redactedText).toContain(MASK_TRAIT);
  });

  it("maskiert Vor-Nachname-Pattern → SCHÜLER_PSEUDONYM", () => {
    const { redactedText } = redact("Lernender Max Müller hat die Aufgabe gelöst.");
    expect(redactedText).toContain(MASK_NAME);
    expect(redactedText).not.toContain("Max Müller");
  });

  it("foundPii enthält korrekte Kategorien", () => {
    const { foundPii } = redact("Max Müller, 15.03.2009, LRS");
    const categories = foundPii.map((p) => p.category);
    expect(categories).toContain("date");
    expect(categories).toContain("trait");
    // Name-Match: "Max Müller" kann unter "name" fallen
  });

  it("gibt leere foundPii zurück wenn kein PII vorhanden", () => {
    const { foundPii, redactedText } = redact("Bitte erkläre den Begriff Metapher.");
    expect(foundPii).toHaveLength(0);
    expect(redactedText).toBe("Bitte erkläre den Begriff Metapher.");
  });

  // ── redactedText besteht Guard-Prüfung ─────────────────────────────────────

  it("redactedText für E-Mail besteht assertNoPii", () => {
    const { redactedText } = redact("E-Mail: schueler@test.de");
    expect(() => assertNoPii(redactedText)).not.toThrow();
  });

  it("redactedText für Datum besteht assertNoPii", () => {
    const { redactedText } = redact("Geboren: 2009-03-15");
    expect(() => assertNoPii(redactedText)).not.toThrow();
  });

  it("redactedText für sensible Merkmale besteht assertNoPii", () => {
    const { redactedText } = redact("Förderbedarf: LRS, Dyskalkulie, ADHS");
    expect(() => assertNoPii(redactedText)).not.toThrow();
  });
});

// ─── pseudonymize() + reidentify() ───────────────────────────────────────────

describe("pseudonymize() + reidentify()", () => {
  function makeDeps() {
    const repo = new FakePseudonymRepository();
    return {
      repo,
      deps: {
        repo,
        schoolSecret: "test-secret-xyz",
        schoolId: "school-1",
      },
    };
  }

  it("computePseudonymId ist deterministisch (gleiche Inputs → gleiches Pseudonym)", () => {
    const p1 = computePseudonymId("secret", "student-001");
    const p2 = computePseudonymId("secret", "student-001");
    expect(p1).toBe(p2);
  });

  it("computePseudonymId erzeugt URL-sicheres Base64 (kein +, /, =)", () => {
    const pid = computePseudonymId("secret", "student-001");
    expect(pid).not.toContain("+");
    expect(pid).not.toContain("/");
    expect(pid).not.toContain("=");
  });

  it("verschiedene studentRefs → verschiedene Pseudonyme", () => {
    const p1 = computePseudonymId("secret", "student-001");
    const p2 = computePseudonymId("secret", "student-002");
    expect(p1).not.toBe(p2);
  });

  it("pseudonymize() gibt stabiles Pseudonym zurück", async () => {
    const { deps } = makeDeps();
    const pid1 = await pseudonymize(deps, "student-001");
    const pid2 = await pseudonymize(deps, "student-001");
    expect(pid1).toBe(pid2);
  });

  it("pseudonymize() schreibt ins Repository", async () => {
    const { repo, deps } = makeDeps();
    const pid = await pseudonymize(deps, "student-001");
    const found = await repo.findByPseudonymId(pid);
    expect(found).not.toBeNull();
    expect(found!.studentRef).toBe("student-001");
    expect(found!.schoolId).toBe("school-1");
  });

  it("pseudonymizeText() ersetzt studentRef im Text durch Pseudonym", async () => {
    const { deps } = makeDeps();
    const { pseudonymizedText } = await pseudonymizeText(deps, "ID: student-001 hat teilgenommen.", ["student-001"]);
    expect(pseudonymizedText).not.toContain("student-001");
    // sollte einen Pseudonym-String enthalten (nicht leer)
    expect(pseudonymizedText.length).toBeGreaterThan("ID:  hat teilgenommen.".length);
  });

  it("reidentify() stellt interne ID aus dem lokalen Repo wieder her", async () => {
    const { repo, deps } = makeDeps();
    const pid = await pseudonymize(deps, "student-001");
    const textWithPseudonym = `Bericht für ${pid}: gute Leistung.`;
    const restored = await reidentify(repo, textWithPseudonym, [pid]);
    expect(restored).toContain("student-001");
    expect(restored).not.toContain(pid);
  });

  it("reidentify() lässt unbekannte Pseudonyme unverändert", async () => {
    const { repo } = makeDeps();
    const text = "Bericht für UNBEKANNT_xyz: gute Leistung.";
    const restored = await reidentify(repo, text, ["UNBEKANNT_xyz"]);
    expect(restored).toBe(text);
  });

  it("reidentify() stellt NICHT Klarnamen her (nur interne IDs)", async () => {
    // Das Repository kennt nur interne IDs (keine Klarnamen)
    const { repo, deps } = makeDeps();
    const pid = await pseudonymize(deps, "student-001");
    // student-001 ist eine interne ID, kein Klarname
    const restored = await reidentify(repo, `Eintrag: ${pid}`, [pid]);
    expect(restored).toBe("Eintrag: student-001");
    // Kein Klarname wie "Max Müller" taucht auf
    expect(restored).not.toContain("Max");
  });

  // ── Round-trip: pseudonymize → Text → reidentify ───────────────────────────

  it("Round-trip: pseudonymizeText → reidentify stellt ursprünglichen Text wieder her", async () => {
    const { repo, deps } = makeDeps();
    const original = "Schülerin student-007 hat die Prüfung bestanden.";
    const { pseudonymizedText, pseudonymMap } = await pseudonymizeText(deps, original, ["student-007"]);

    expect(pseudonymizedText).not.toContain("student-007");

    const pseudonymIds = Array.from(pseudonymMap.mapping.values());
    const restored = await reidentify(repo, pseudonymizedText, pseudonymIds);
    expect(restored).toBe(original);
  });
});
