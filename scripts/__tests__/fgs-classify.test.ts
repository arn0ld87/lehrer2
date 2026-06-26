/**
 * scripts/__tests__/fgs-classify.test.ts
 *
 * Testet die reine Klassifikationsfunktion classifyFgsFile — KEINE DB, KEINE I/O.
 * Alle Regeln sind in der definierten Reihenfolge (1→2→3→4→5/6→7) zu prüfen.
 * PII/Tooling/Out-of-Scope schlagen Subject-Regeln (fail-closed).
 */

import { describe, expect, it } from "vitest";
import { classifyFgsFile } from "../ingest-user-materials";

// ---------------------------------------------------------------------------
// Regel 1 — Nicht unterstützte Dateitypen
// ---------------------------------------------------------------------------

describe("Regel 1 — unsupported-type", () => {
  it("xlsx → exclude", () => {
    // Auch wenn Pfad 'Notenübersicht' enthält, greift erst Regel 1
    const r = classifyFgsFile("1_Klassenleitung/Notenübersicht/Klasse9.xlsx");
    expect(r.include).toBe(false);
    expect(r.reason).toBe("unsupported-type");
  });

  it(".py → exclude", () => {
    // site-packages im Pfad würde Regel 2 sein, aber .py feuert bereits Regel 1
    const r = classifyFgsFile("Materialsammlung-RAG/site-packages/foo.py");
    expect(r.include).toBe(false);
    expect(r.reason).toBe("unsupported-type");
  });

  it(".pptx → exclude", () => {
    const r = classifyFgsFile("2_Deutsch/Folien/einheit.pptx");
    expect(r.include).toBe(false);
    expect(r.reason).toBe("unsupported-type");
  });

  it(".jpg → exclude", () => {
    const r = classifyFgsFile("3_Religion/Bild.jpg");
    expect(r.include).toBe(false);
    expect(r.reason).toBe("unsupported-type");
  });
});

// ---------------------------------------------------------------------------
// Regel 2 — Tooling / Build-Artefakte
// ---------------------------------------------------------------------------

describe("Regel 2 — tooling", () => {
  it("_report-Unterordner → exclude", () => {
    const r = classifyFgsFile("Materialsammlung-RAG/_report/x.md");
    expect(r.include).toBe(false);
    expect(r.reason).toBe("tooling");
  });

  it("__pycache__ im Pfad → exclude", () => {
    const r = classifyFgsFile("Materialsammlung-RAG/__pycache__/module.txt");
    expect(r.include).toBe(false);
    expect(r.reason).toBe("tooling");
  });

  it("node_modules im Pfad → exclude", () => {
    const r = classifyFgsFile("2_Deutsch/node_modules/foo/index.md");
    expect(r.include).toBe(false);
    expect(r.reason).toBe("tooling");
  });

  it(".venv im Pfad → exclude", () => {
    const r = classifyFgsFile("Materialsammlung-RAG/.venv/lib/foo.html");
    expect(r.include).toBe(false);
    expect(r.reason).toBe("tooling");
  });
});

// ---------------------------------------------------------------------------
// Regel 3 — PII / Verwaltung (fail-closed, schlägt Subject-Regeln)
// ---------------------------------------------------------------------------

describe("Regel 3 — pii-or-admin (schlägt Subject)", () => {
  it("Klassenarbeit_Auswertung → exclude, NICHT pii durch religion", () => {
    const r = classifyFgsFile("2_Deutsch/Klasse 9/Klassenarbeit_Auswertung.pdf");
    expect(r.include).toBe(false);
    expect(r.reason).toBe("pii-or-admin");
  });

  it("PII schlägt Religion: 3_Religion/Zeugnis_Max.pdf → exclude pii, NICHT religion", () => {
    const r = classifyFgsFile("3_Religion/Zeugnis_Max.pdf");
    expect(r.include).toBe(false);
    expect(r.reason).toBe("pii-or-admin");
  });

  it("Notenübersicht (case-insensitive) → exclude", () => {
    const r = classifyFgsFile("2_Deutsch/notenübersicht_kl8.pdf");
    expect(r.include).toBe(false);
    expect(r.reason).toBe("pii-or-admin");
  });

  it("Klausur → exclude", () => {
    const r = classifyFgsFile("3_Religion/klausur_advent.docx");
    expect(r.include).toBe(false);
    expect(r.reason).toBe("pii-or-admin");
  });

  it("Förderplan → exclude", () => {
    const r = classifyFgsFile("Lernbüro 6 2024_2025/Deutsch/förderplan_schüler.pdf");
    expect(r.include).toBe(false);
    expect(r.reason).toBe("pii-or-admin");
  });

  it("Elternbrief → exclude", () => {
    const r = classifyFgsFile("2_Deutsch/Elternbrief_Herbst.docx");
    expect(r.include).toBe(false);
    expect(r.reason).toBe("pii-or-admin");
  });
});

// ---------------------------------------------------------------------------
// Regel 4 — Out-of-Scope-Fach
// ---------------------------------------------------------------------------

describe("Regel 4 — out-of-scope-subject", () => {
  it("Biologie → exclude", () => {
    const r = classifyFgsFile("Lernbüro 6 2024_2025/Biologie/zelle.pdf");
    expect(r.include).toBe(false);
    expect(r.reason).toBe("out-of-scope-subject");
  });

  it("Englisch → exclude", () => {
    const r = classifyFgsFile("2_Deutsch/Englisch/vocabulary.pdf");
    expect(r.include).toBe(false);
    expect(r.reason).toBe("out-of-scope-subject");
  });

  it("Mathematik → exclude", () => {
    const r = classifyFgsFile("Lernbüro 6 2024_2025/Mathe/geometrie.pdf");
    expect(r.include).toBe(false);
    expect(r.reason).toBe("out-of-scope-subject");
  });

  it("Informatik → exclude", () => {
    const r = classifyFgsFile("Materialsammlung-RAG/Informatik/algorithmen.pdf");
    expect(r.include).toBe(false);
    expect(r.reason).toBe("out-of-scope-subject");
  });
});

// ---------------------------------------------------------------------------
// Regel 5 — Religion (Top-Ordner und /relig/i)
// ---------------------------------------------------------------------------

describe("Regel 5 — religion-ev", () => {
  it("3_Religion Top-Ordner → include RELIGION/EVANGELISCH", () => {
    const r = classifyFgsFile("3_Religion/Klasse 8/Material.docx");
    expect(r.include).toBe(true);
    expect(r.subject).toBe("RELIGION");
    expect(r.confession).toBe("EVANGELISCH");
    expect(r.reason).toBe("religion-ev");
  });

  it("3_Religion_RAG_Auswahl Top-Ordner → include RELIGION/EVANGELISCH", () => {
    const r = classifyFgsFile("3_Religion_RAG_Auswahl/Oberstufe/x.pdf");
    expect(r.include).toBe(true);
    expect(r.subject).toBe("RELIGION");
    expect(r.confession).toBe("EVANGELISCH");
    expect(r.reason).toBe("religion-ev");
  });

  it("/relig/ im Pfad eines anderen Ordners → include RELIGION/EVANGELISCH", () => {
    const r = classifyFgsFile("Materialsammlung-RAG/Religion-Texte/Abraham.pdf");
    expect(r.include).toBe(true);
    expect(r.subject).toBe("RELIGION");
    expect(r.confession).toBe("EVANGELISCH");
    expect(r.reason).toBe("religion-ev");
  });
});

// ---------------------------------------------------------------------------
// Regel 6 — Ethik (deferred)
// ---------------------------------------------------------------------------

describe("Regel 6 — ethik-deferred", () => {
  it("Ethik im Pfad → exclude", () => {
    const r = classifyFgsFile("2_Deutsch/Ethik/werte.pdf");
    expect(r.include).toBe(false);
    expect(r.reason).toBe("ethik-deferred");
  });

  it("ethik (case-insensitive) → exclude", () => {
    const r = classifyFgsFile("Materialsammlung-RAG/ETHIK/einheit1.docx");
    expect(r.include).toBe(false);
    expect(r.reason).toBe("ethik-deferred");
  });
});

// ---------------------------------------------------------------------------
// Regel 7 — Default Deutsch
// ---------------------------------------------------------------------------

describe("Regel 7 — deutsch (default)", () => {
  it("2_Deutsch/9/Aufgabe.pdf → include DEUTSCH/NICHT_ANWENDBAR", () => {
    const r = classifyFgsFile("2_Deutsch/9/Aufgabe.pdf");
    expect(r.include).toBe(true);
    expect(r.subject).toBe("DEUTSCH");
    expect(r.confession).toBe("NICHT_ANWENDBAR");
    expect(r.reason).toBe("deutsch");
  });

  it("Lernbüro 6 2024_2025/Deutsch/lesen.pdf → include DEUTSCH", () => {
    const r = classifyFgsFile("Lernbüro 6 2024_2025/Deutsch/lesen.pdf");
    expect(r.include).toBe(true);
    expect(r.subject).toBe("DEUTSCH");
    expect(r.confession).toBe("NICHT_ANWENDBAR");
    expect(r.reason).toBe("deutsch");
  });

  it("Materialsammlung-RAG/Lesen/kurzgeschichte.md → include DEUTSCH", () => {
    const r = classifyFgsFile("Materialsammlung-RAG/Lesen/kurzgeschichte.md");
    expect(r.include).toBe(true);
    expect(r.subject).toBe("DEUTSCH");
    expect(r.confession).toBe("NICHT_ANWENDBAR");
    expect(r.reason).toBe("deutsch");
  });

  it("Lehrpläne Schulgesetz Sachsen Anhalt/lp_deutsch_sek1.pdf → include DEUTSCH", () => {
    const r = classifyFgsFile(
      "Lehrpläne Schulgesetz Sachsen Anhalt/lp_deutsch_sek1.pdf",
    );
    expect(r.include).toBe(true);
    expect(r.subject).toBe("DEUTSCH");
    expect(r.confession).toBe("NICHT_ANWENDBAR");
    expect(r.reason).toBe("deutsch");
  });
});

// ---------------------------------------------------------------------------
// Reihenfolge-Invarianten (PII/Tooling > Subject)
// ---------------------------------------------------------------------------

describe("Reihenfolge-Invarianten", () => {
  it("PII (Zeugnis) schlägt Religion auch bei Top-Ordner 3_Religion", () => {
    const r = classifyFgsFile("3_Religion/Zeugnisse/Max_Zeugnis.pdf");
    expect(r.include).toBe(false);
    expect(r.reason).toBe("pii-or-admin");
  });

  it("Tooling (_report) schlägt Deutsch", () => {
    const r = classifyFgsFile("2_Deutsch/_report/analyse.html");
    expect(r.include).toBe(false);
    expect(r.reason).toBe("tooling");
  });

  it("Out-of-Scope schlägt Ethik (Ethik bereits Regel 6, aber Biologie ist Regel 4)", () => {
    // Biologie ist Regel 4, Ethik wäre Regel 6 — Regel 4 greift zuerst
    const r = classifyFgsFile("2_Deutsch/Biologie-Ethik/einheit.pdf");
    expect(r.include).toBe(false);
    expect(r.reason).toBe("out-of-scope-subject");
  });
});
