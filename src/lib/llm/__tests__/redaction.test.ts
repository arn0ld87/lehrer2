/**
 * redaction.test.ts — Datenschutz-Garantie für den Korrektur-Eingabepfad.
 *
 * generateCorrection() redacted die Schülerarbeit lokal, BEVOR sie in den Prompt
 * und an den (gegateten) Provider geht. Diese Tests sichern, dass die typischen
 * PII-Kategorien einer Schülerarbeit maskiert werden. Pure Funktion, kein IO/Docker.
 *
 * Hinweis (bewusstes Design, redaction.ts): Nur label-anchored Namen ("Name: …")
 * werden maskiert — freie Eigennamen im Fließtext bleiben (Lehrer-/Curriculum-Content).
 * Der fail-closed Guard (guardAssertion, siehe gate.test.ts) ist die letzte Verteidigung.
 */

import { describe, it, expect } from "vitest";
import { redact } from "../redaction";

describe("redact() — Korrektur-Eingabepfad", () => {
  it("maskiert label-anchored Schülernamen", () => {
    const r = redact("Name: Max Mustermann\nAufgabe: Charakterisierung …");
    expect(r.redactedText).not.toContain("Max Mustermann");
    expect(r.redactedText).toContain("[SCHÜLER_PSEUDONYM]");
    expect(r.categoriesHit).toContain("name");
    expect(r.redactionApplied).toBe(true);
  });

  it("maskiert Kontaktdaten (E-Mail)", () => {
    const r = redact("Rückfragen an max.muster@schule.de bitte.");
    expect(r.redactedText).not.toContain("max.muster@schule.de");
    expect(r.categoriesHit).toContain("contact");
  });

  it("maskiert Geburtsdaten", () => {
    const r = redact("geboren am 14.03.2009 in der Klasse.");
    expect(r.redactedText).not.toContain("14.03.2009");
    expect(r.categoriesHit).toContain("birthdate");
  });

  it("maskiert sensible Merkmale (Förderbedarf)", () => {
    const r = redact("Der Schüler hat LRS und Nachteilsausgleich.");
    expect(r.redactedText).not.toContain("LRS");
    expect(r.categoriesHit).toContain("sensitive_attribute");
  });

  it("lässt unkritischen Fachtext unverändert (kein Over-Redaction)", () => {
    const text = "Die Lernende analysiert Aufbau und Figuren der Kurzgeschichte.";
    const r = redact(text);
    expect(r.redactedText).toBe(text);
    expect(r.redactionApplied).toBe(false);
  });
});
