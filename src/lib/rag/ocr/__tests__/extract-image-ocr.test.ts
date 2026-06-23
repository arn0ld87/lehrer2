/**
 * extract-image-ocr.test.ts — Unit-Tests für extractContent mit Bilddateien (#40)
 *
 * Prüft:
 *   (A) image/* + FakeOcrEngine mit Text → OCR-Text zurückgegeben
 *   (B) image/* + FakeOcrEngine liefert leer → ExtractionFailedError (fail-laut, mit URI)
 *   (C) image/* OHNE ocrEngine → ExtractionFailedError (nicht ingestierbar)
 *
 * Ergänzt zudem die FakeOcrEngine.recognizeImage-Abdeckung. Tesseract-Binary
 * wird hier NICHT aufgerufen (FakeOcrEngine, kein System-Call) — der reale Pfad
 * über TesseractOcrEngine läuft nur im Laufzeit-Container (siehe tesseract-engine.ts).
 */

import { describe, it, expect } from "vitest";
import { extractContent, ExtractionFailedError } from "../../extract.js";
import { FakeOcrEngine } from "../engine.js";

// ── Minimalistische Pseudo-Bild-Bytes — reichen für FakeOcrEngine (kein echter Decode) ──
const FAKE_IMAGE_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG-Magic-Bytes

describe("extractContent — Bild-OCR (#40)", () => {
  // ── (A) Positiv: FakeOcrEngine liefert Text ──────────────────────────────
  it("(A) gibt OCR-Text für image/png zurück, wenn FakeOcrEngine Text liefert", async () => {
    const ocrText =
      "Tafelbild Religion Sachsen-Anhalt — synthetisch, keine echten Schüler-PII. " +
      "Abgelichtetes Arbeitsblatt, ausreichend lang für Chunking.";

    const engine = new FakeOcrEngine(ocrText);

    const result = await extractContent(
      "file://tafelbild.png",
      FAKE_IMAGE_BYTES,
      "image/png",
      engine,
    );

    expect(result).toBe(ocrText);
  });

  it("(A) funktioniert ebenso für image/jpeg", async () => {
    const ocrText = "Foto einer Aufgabenstellung — synthetischer OCR-Text, lang genug für Chunking.";
    const engine = new FakeOcrEngine(ocrText);

    const result = await extractContent(
      "file://aufgabe.jpg",
      FAKE_IMAGE_BYTES,
      "image/jpeg",
      engine,
    );

    expect(result).toBe(ocrText);
  });

  // ── (B) Negativ: FakeOcrEngine liefert leer → ExtractionFailedError ───────
  it("(B) wirft ExtractionFailedError (fail-laut, mit URI), wenn OCR leer liefert", async () => {
    const engine = new FakeOcrEngine(""); // leer → OCR ohne Ergebnis
    const uri = "file://leeres-bild.png";

    const err = await extractContent(uri, FAKE_IMAGE_BYTES, "image/png", engine).catch(
      (e) => e,
    );

    expect(err).toBeInstanceOf(ExtractionFailedError);
    expect(err.message).toContain(uri);
  });

  // ── (C) Kein ocrEngine → Bild nicht ingestierbar ─────────────────────────
  it("(C) wirft ExtractionFailedError ohne ocrEngine", async () => {
    await expect(
      extractContent("file://bild-ohne-ocr.png", FAKE_IMAGE_BYTES, "image/png"),
    ).rejects.toThrow(ExtractionFailedError);

    await expect(
      extractContent("file://bild-ohne-ocr.png", FAKE_IMAGE_BYTES, "image/png"),
    ).rejects.toThrow(/OCR-Worker.*noetig/);
  });
});

describe("FakeOcrEngine.recognizeImage", () => {
  it("gibt sanitisierten Text zurück", async () => {
    const engine = new FakeOcrEngine("  Bildtext  mit   Whitespace  ");
    const result = await engine.recognizeImage(FAKE_IMAGE_BYTES);
    expect(result).toBe("Bildtext mit Whitespace");
  });

  it("wirft bei leerem Ergebnis, wenn throwOnEmpty gesetzt ist", async () => {
    const engine = new FakeOcrEngine("", true);
    await expect(engine.recognizeImage(FAKE_IMAGE_BYTES)).rejects.toThrow(/leer/);
  });
});
