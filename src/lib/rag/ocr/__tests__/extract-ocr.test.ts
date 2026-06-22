/**
 * extract-ocr.test.ts — Unit-Tests für extractContent mit OcrEngine (#40)
 *
 * Prüft:
 *   (A) Scan-PDF (leerer PDF-Parser-Text) + FakeOcrEngine mit Text → OCR-Text zurückgegeben
 *   (B) Scan-PDF + FakeOcrEngine liefert leer → ExtractionFailedError (fail-laut)
 *   (C) Kein ocrEngine übergeben → bisheriges Verhalten (ExtractionFailedError) bleibt erhalten
 *
 * Statt vi.mock auf pdf-parse (CJS-interop-problematisch) wird der optionale
 * `_pdfParser`-Parameter von extractContent genutzt (DI für Testbarkeit).
 */

import { describe, it, expect } from "vitest";
import { extractContent, ExtractionFailedError } from "../../extract.js";
import { FakeOcrEngine } from "../engine.js";
import type { PdfParser } from "../../extract.js";

// ── Fake-PDF-Parser: gibt immer leeren Text zurück (simuliert Scan-PDF) ──────
const fakePdfParserLeer: PdfParser = async (_buf) => ({ text: "" });

// ── Minimalistische Pseudo-PDF-Bytes ──────────────────────────────────────
// %PDF-1 Header — reicht für den injizierten Fake-Parser
const FAKE_PDF_BYTES = new TextEncoder().encode("%PDF-1.4 (empty scan)");

describe("extractContent — OCR-Fallback bei Scan-PDF (#40)", () => {
  // ── (A) Positiv: FakeOcrEngine liefert Text ──────────────────────────────
  it("(A) gibt OCR-Text zurück, wenn PDF-Parser leer und FakeOcrEngine Text liefert", async () => {
    const ocrText =
      "Lehrplan Deutsch Sachsen-Anhalt Sekundarstufe I — synthetisch, keine echten Schüler-PII. " +
      "Kompetenzbereiche: Sprechen, Schreiben, Lesen. Ausreichend lang für Chunking.";

    const engine = new FakeOcrEngine(ocrText);

    const result = await extractContent(
      "file://scan-test.pdf",
      FAKE_PDF_BYTES,
      "application/pdf",
      engine,
      fakePdfParserLeer,
    );

    expect(result).toBe(ocrText);
  });

  // ── (B) Negativ: FakeOcrEngine liefert leer → ExtractionFailedError ───────
  it("(B) wirft ExtractionFailedError (fail-laut), wenn OCR ebenfalls leer liefert", async () => {
    const engine = new FakeOcrEngine(""); // leer → OCR schlägt fehl

    await expect(
      extractContent(
        "file://unscannable.pdf",
        FAKE_PDF_BYTES,
        "application/pdf",
        engine,
        fakePdfParserLeer,
      ),
    ).rejects.toThrow(ExtractionFailedError);

    await expect(
      extractContent(
        "file://unscannable.pdf",
        FAKE_PDF_BYTES,
        "application/pdf",
        engine,
        fakePdfParserLeer,
      ),
    ).rejects.toThrow(/OCR.*leer.*URI:/);
  });

  it("(B) ExtractionFailedError enthält URI im Fehlertext", async () => {
    const engine = new FakeOcrEngine("");
    const uri = "file://mein-scan-pdf.pdf";

    const err = await extractContent(
      uri,
      FAKE_PDF_BYTES,
      "application/pdf",
      engine,
      fakePdfParserLeer,
    ).catch((e) => e);

    expect(err).toBeInstanceOf(ExtractionFailedError);
    expect(err.message).toContain(uri);
  });

  // ── (C) Kein ocrEngine → bisheriges Verhalten erhalten (nicht brechen) ────
  it("(C) wirft ExtractionFailedError ohne ocrEngine (bisheriges Verhalten bleibt)", async () => {
    await expect(
      extractContent(
        "file://scan-no-ocr.pdf",
        FAKE_PDF_BYTES,
        "application/pdf",
        undefined,
        fakePdfParserLeer,
      ),
    ).rejects.toThrow(ExtractionFailedError);

    await expect(
      extractContent(
        "file://scan-no-ocr.pdf",
        FAKE_PDF_BYTES,
        "application/pdf",
        undefined,
        fakePdfParserLeer,
      ),
    ).rejects.toThrow(/OCR-Worker.*noetig/);
  });
});

describe("extractContent — andere MIME-Typen bleiben unberührt", () => {
  it("text/plain funktioniert weiterhin ohne ocrEngine", async () => {
    const text = "Normaler Textinhalt ohne OCR.";
    const result = await extractContent(
      "file://test.txt",
      new TextEncoder().encode(text),
      "text/plain",
    );
    expect(result).toBe(text);
  });

  it("nicht-unterstützter MIME-Typ wirft ExtractionFailedError", async () => {
    await expect(
      extractContent("file://test.docx", new Uint8Array([1, 2, 3]), "application/octet-stream"),
    ).rejects.toThrow(ExtractionFailedError);
  });
});
