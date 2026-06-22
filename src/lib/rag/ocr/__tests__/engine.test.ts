/**
 * engine.test.ts — Unit-Tests für sanitizeOcrText und FakeOcrEngine
 *
 * Prüft:
 *   - sanitizeOcrText: Steuerzeichen entfernen, HTML-Tags neutralisieren
 *   - FakeOcrEngine: konfigurierter Rückgabetext, leeres Ergebnis
 */

import { describe, it, expect } from "vitest";
import { sanitizeOcrText, FakeOcrEngine } from "../engine.js";

// ── sanitizeOcrText ────────────────────────────────────────────────────────

describe("sanitizeOcrText — Steuerzeichen", () => {
  it("entfernt C0-Steuerzeichen (außer TAB, CR, LF)", () => {
    const raw = "Hallo\x00Welt\x01\x02\x1F!";
    const result = sanitizeOcrText(raw);
    expect(result).toBe("HalloWelt!");
  });

  it("entfernt C1-Steuerzeichen (0x7F–0x9F)", () => {
    const raw = "Text\x7FMitte\x9FEnde";
    const result = sanitizeOcrText(raw);
    expect(result).toBe("TextMitteEnde");
  });

  it("behält Zeilenumbrüche (\\n, \\r) und Tabs (\\t)", () => {
    const raw = "Zeile 1\nZeile 2\r\nMit\tTab";
    const result = sanitizeOcrText(raw);
    expect(result).toContain("Zeile 1\nZeile 2");
    expect(result).toContain("Mit\tTab");
  });
});

describe("sanitizeOcrText — HTML/JS-Neutralisierung (THREAT_MODEL §3)", () => {
  it("entfernt HTML-Tags", () => {
    const raw = "Normaler Text <script>alert(1)</script> weiterer Text";
    const result = sanitizeOcrText(raw);
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("alert(1)");
    expect(result).toContain("Normaler Text");
    expect(result).toContain("weiterer Text");
  });

  it("entfernt style-Blöcke", () => {
    const raw = "Text <style>body{color:red}</style> Ende";
    const result = sanitizeOcrText(raw);
    expect(result).not.toContain("<style>");
    expect(result).not.toContain("color:red");
    expect(result).toContain("Text");
    expect(result).toContain("Ende");
  });

  it("entfernt generische HTML-Tags", () => {
    const raw = "<b>Fett</b> und <i>kursiv</i> und <a href='x'>Link</a>";
    const result = sanitizeOcrText(raw);
    expect(result).not.toContain("<b>");
    expect(result).not.toContain("</b>");
    expect(result).toContain("Fett");
    expect(result).toContain("kursiv");
    expect(result).toContain("Link");
  });

  it("normalisiert HTML-Entities", () => {
    const raw = "Laut &amp; Leise &lt;Test&gt; &quot;OK&quot;";
    const result = sanitizeOcrText(raw);
    expect(result).toBe('Laut & Leise <Test> "OK"');
  });
});

describe("sanitizeOcrText — Whitespace-Normalisierung", () => {
  it("normalisiert mehrfache Leerzeichen zu einem", () => {
    const raw = "Wort   mehrere    Leerzeichen";
    const result = sanitizeOcrText(raw);
    expect(result).toBe("Wort mehrere Leerzeichen");
  });

  it("trimmt führende und abschließende Leerzeichen", () => {
    const raw = "   Text mit Rand   ";
    const result = sanitizeOcrText(raw);
    expect(result).toBe("Text mit Rand");
  });

  it("gibt leeren String bei komplett leerem Input zurück", () => {
    expect(sanitizeOcrText("")).toBe("");
    expect(sanitizeOcrText("   ")).toBe("");
    expect(sanitizeOcrText("\x00\x01")).toBe("");
  });
});

// ── FakeOcrEngine ──────────────────────────────────────────────────────────

describe("FakeOcrEngine", () => {
  it("gibt konfigurierten Text zurück (nach sanitizeOcrText)", async () => {
    const engine = new FakeOcrEngine("Lehrplan Sachsen-Anhalt Deutsch");
    const result = await engine.recognizePdf(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    expect(result).toBe("Lehrplan Sachsen-Anhalt Deutsch");
  });

  it("gibt leeren String zurück, wenn returnText leer ist (kein throwOnEmpty)", async () => {
    const engine = new FakeOcrEngine("");
    const result = await engine.recognizePdf(new Uint8Array([]));
    expect(result).toBe("");
  });

  it("wirft bei leerem returnText wenn throwOnEmpty=true", async () => {
    const engine = new FakeOcrEngine("", true);
    await expect(engine.recognizePdf(new Uint8Array([]))).rejects.toThrow(
      /FakeOcrEngine.*leer/,
    );
  });

  it("sanitiert den zurückgegebenen Text (Steuerzeichen entfernen)", async () => {
    const engine = new FakeOcrEngine("Hallo\x00Welt<script>bad()</script>");
    const result = await engine.recognizePdf(new Uint8Array([]));
    expect(result).not.toContain("\x00");
    expect(result).not.toContain("<script>");
    expect(result).toContain("Hallo");
    expect(result).toContain("Welt");
  });
});
