/**
 * guard.test.ts — Unit-Tests für assertNoPii (REDACTION_AND_GUARD_SPEC.md §3)
 *
 * Geprüft:
 *   - PII-Muster aus §2/§3 → assertNoPii wirft PiiGuardError
 *   - Sauberer Text → kein Wurf
 *   - Bereits redacteter Text (Masken) → kein Wurf (Masken werden ignoriert)
 *   - PiiGuardError enthält korrekten userMessage + detectedPatterns
 */

import { describe, it, expect } from "vitest";
import { assertNoPii, PiiGuardError } from "../guard";
import { MASK_NAME, MASK_DATE, MASK_CONTACT, MASK_ADDRESS, MASK_TRAIT } from "../redact";

describe("assertNoPii", () => {
  // ── Saubere Texte (kein Wurf erwartet) ─────────────────────────────────────

  it("gibt bei sauberem Text ohne PII keinen Fehler", () => {
    expect(() =>
      assertNoPii("Bitte erkläre den Begriff Metapher für Klasse 7."),
    ).not.toThrow();
  });

  it("gibt bei leerem String keinen Fehler", () => {
    expect(() => assertNoPii("")).not.toThrow();
  });

  it("gibt bei reinem Fachtext keinen Fehler", () => {
    expect(() =>
      assertNoPii(
        "Der Lehrplan schreibt für Klasse 9 folgende Kompetenzen vor: Lesekompetenz, Schreibkompetenz.",
      ),
    ).not.toThrow();
  });

  // ── Masken werden ignoriert (kein Wurf erwartet) ────────────────────────────

  it("akzeptiert bereits redactierten Text mit Masken", () => {
    const maskedText = `Schüler ${MASK_NAME} hat das Geburtsdatum ${MASK_DATE}. Kontakt: ${MASK_CONTACT}`;
    expect(() => assertNoPii(maskedText)).not.toThrow();
  });

  it("akzeptiert alle bekannten Masken", () => {
    const allMasks = `${MASK_NAME} ${MASK_DATE} ${MASK_ADDRESS} ${MASK_CONTACT} ${MASK_TRAIT}`;
    expect(() => assertNoPii(allMasks)).not.toThrow();
  });

  // ── PII-Muster aus §3.1 (Wurf erwartet) ────────────────────────────────────

  it("wirft bei Vor-Nachname-Muster", () => {
    expect(() =>
      assertNoPii("Der Schüler Max Müller hat die Aufgabe nicht abgegeben."),
    ).toThrow(PiiGuardError);
  });

  it("wirft bei deutschem Namen mit Umlaut", () => {
    expect(() =>
      assertNoPii("Schülerin Ärgernis Überlinger hat gefehlt."),
    ).toThrow(PiiGuardError);
  });

  it("wirft bei ISO-Datum YYYY-MM-DD (§3.1)", () => {
    expect(() =>
      assertNoPii("Geburtsdatum: 2009-03-15"),
    ).toThrow(PiiGuardError);
  });

  it("wirft bei Datum DD.MM.YYYY", () => {
    expect(() =>
      assertNoPii("Geboren am 15.03.2009"),
    ).toThrow(PiiGuardError);
  });

  it("wirft bei PLZ + Stadtname (§3.1)", () => {
    expect(() =>
      assertNoPii("Wohnhaft in 06108 Halle"),
    ).toThrow(PiiGuardError);
  });

  it("wirft bei LRS (sensibles Merkmal, §3.1)", () => {
    expect(() =>
      assertNoPii("Schüler hat diagnostiziertes LRS."),
    ).toThrow(PiiGuardError);
  });

  it("wirft bei Dyskalkulie (sensibles Merkmal, §3.1)", () => {
    expect(() =>
      assertNoPii("Förderbedarf: Dyskalkulie"),
    ).toThrow(PiiGuardError);
  });

  it("wirft bei ADHS", () => {
    expect(() =>
      assertNoPii("Diagnose ADHS liegt vor."),
    ).toThrow(PiiGuardError);
  });

  it("wirft bei E-Mail-Adresse", () => {
    expect(() =>
      assertNoPii("Kontakt: schueler@beispielschule.de"),
    ).toThrow(PiiGuardError);
  });

  it("wirft bei Telefonnummer mit +49", () => {
    expect(() =>
      assertNoPii("Rufnummer: +49 345 12345678"),
    ).toThrow(PiiGuardError);
  });

  // ── PiiGuardError enthält korrekte Informationen ────────────────────────────

  it("PiiGuardError enthält korrekten userMessage", () => {
    let caughtError: PiiGuardError | undefined;
    try {
      assertNoPii("Max Müller hat LRS.");
    } catch (e) {
      if (e instanceof PiiGuardError) caughtError = e;
    }
    expect(caughtError).toBeDefined();
    expect(caughtError!.userMessage).toContain("Sicherheitsprüfung fehlgeschlagen");
  });

  it("PiiGuardError.detectedPatterns enthält mindestens ein Muster", () => {
    let caughtError: PiiGuardError | undefined;
    try {
      assertNoPii("Max Müller, geboren 15.03.2009, hat LRS.");
    } catch (e) {
      if (e instanceof PiiGuardError) caughtError = e;
    }
    expect(caughtError).toBeDefined();
    expect(caughtError!.detectedPatterns.length).toBeGreaterThan(0);
  });

  it("PiiGuardError.payloadLength entspricht der Eingabelänge", () => {
    const payload = "Max Müller";
    let caughtError: PiiGuardError | undefined;
    try {
      assertNoPii(payload);
    } catch (e) {
      if (e instanceof PiiGuardError) caughtError = e;
    }
    expect(caughtError?.payloadLength).toBe(payload.length);
  });

  // ── Gemischter Fall: Masken vorhanden + noch PII ────────────────────────────

  it("wirft wenn neben Masken noch unredactete PII im Text steht", () => {
    const mixedText = `${MASK_NAME} hat Kontakt ${MASK_CONTACT} — aber auch Max Müller ist betroffen.`;
    expect(() => assertNoPii(mixedText)).toThrow(PiiGuardError);
  });
});
