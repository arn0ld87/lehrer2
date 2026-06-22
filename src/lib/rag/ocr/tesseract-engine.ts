/**
 * tesseract-engine.ts — TesseractOcrEngine (Laufzeit-only)
 *
 * Rastet PDF-Seiten via `pdftoppm` (poppler) zu PNG und OCR't via `tesseract`.
 * KEINE Top-Level-Verbindung oder System-Aufruf bei Import — nur bei Aufruf von recognizePdf.
 *
 * Anforderungen:
 *   - System-Binaries: `pdftoppm` (poppler-utils) und `tesseract` (tesseract-ocr)
 *   - Deutsch-Sprache: `tesseract-ocr-deu` installiert
 *   - Temporäres Verzeichnis: wird angelegt, nach Verarbeitung bereinigt (os.tmpdir)
 *   - Fehlende Binaries / leeres Ergebnis: aussagekräftiger Fehler
 *
 * WIRD IN CI NICHT AUSGEFÜHRT (keine tesseract/poppler-Installation in CI).
 * Nur der Laufzeit-Container (services/ocr-worker) enthält die Binaries.
 */

import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { type OcrEngine, sanitizeOcrText } from "./engine.js";

const execFileAsync = promisify(execFile);

/** Auflösung in DPI für pdftoppm-Rasterung. 300 DPI ist Standard für OCR-Qualität. */
const RASTER_DPI = 300;

/** Tesseract-Sprache(n) — Deutsch mit Fallback auf Englisch */
const TESSERACT_LANG = "deu+eng";

/**
 * TesseractOcrEngine — rastert PDF-Seiten zu PNG und führt Tesseract OCR durch.
 * Laufzeit-only; wirft bei fehlenden Binaries oder leerem OCR-Ergebnis.
 */
export class TesseractOcrEngine implements OcrEngine {
  /**
   * Extrahiert Text aus einem PDF via pdftoppm + tesseract.
   *
   * Ablauf:
   *   1. Temp-Verzeichnis anlegen
   *   2. PDF-Bytes als Datei schreiben
   *   3. pdftoppm: PDF → PNG-Seiten (300 DPI)
   *   4. tesseract: jede PNG → Text
   *   5. Texte zusammenführen + sanitizeOcrText
   *   6. Temp-Verzeichnis bereinigen (auch bei Fehler)
   *
   * @throws bei fehlendem pdftoppm/tesseract-Binary oder leerem OCR-Ergebnis
   */
  async recognizePdf(bytes: Uint8Array): Promise<string> {
    let tmpDir: string | undefined;

    try {
      // (1) Temp-Verzeichnis
      tmpDir = await mkdtemp(join(tmpdir(), "ocr-worker-"));

      // (2) PDF-Bytes schreiben
      const pdfPath = join(tmpDir, "input.pdf");
      await import("node:fs/promises").then((fs) =>
        fs.writeFile(pdfPath, bytes),
      );

      // (3) pdftoppm: PDF → PNG-Seiten
      const pngPrefix = join(tmpDir, "page");
      try {
        await execFileAsync("pdftoppm", [
          "-r", String(RASTER_DPI),
          "-png",
          pdfPath,
          pngPrefix,
        ]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("not found") || msg.includes("ENOENT") || msg.includes("command not found")) {
          throw new Error(
            `TesseractOcrEngine: pdftoppm nicht gefunden — bitte poppler-utils installieren (Fehlermeldung: ${msg})`,
          );
        }
        throw new Error(`TesseractOcrEngine: pdftoppm fehlgeschlagen: ${msg}`);
      }

      // (4) PNG-Dateien finden und sortieren
      const allFiles = await readdir(tmpDir);
      const pngFiles = allFiles
        .filter((f) => f.endsWith(".png"))
        .sort(); // lexikografisch; pdftoppm erzeugt page-01.png, page-02.png, …

      if (pngFiles.length === 0) {
        throw new Error(
          "TesseractOcrEngine: pdftoppm erzeugte keine PNG-Seiten — PDF möglicherweise beschädigt",
        );
      }

      // (5) tesseract: jede PNG → Text
      const pageTexts: string[] = [];

      for (const pngFile of pngFiles) {
        const pngPath = join(tmpDir, pngFile);
        const txtBase = join(tmpDir, `${pngFile}-ocr`);

        try {
          await execFileAsync("tesseract", [
            pngPath,
            txtBase,
            "-l", TESSERACT_LANG,
            "--psm", "3", // automatische Seitenanalyse
          ]);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("not found") || msg.includes("ENOENT") || msg.includes("command not found")) {
            throw new Error(
              `TesseractOcrEngine: tesseract nicht gefunden — bitte tesseract-ocr + tesseract-ocr-deu installieren (Fehlermeldung: ${msg})`,
            );
          }
          // Seite überspringen bei Fehler (z. B. leere/beschädigte Seite), nicht gesamten Job abbrechen
          console.warn(
            `TesseractOcrEngine: tesseract fehlgeschlagen für ${pngFile}: ${msg} — Seite wird übersprungen`,
          );
          continue;
        }

        // Tesseract schreibt Ausgabe in <txtBase>.txt
        const txtPath = `${txtBase}.txt`;
        try {
          const pageText = await readFile(txtPath, "utf-8");
          if (pageText.trim()) {
            pageTexts.push(pageText);
          }
        } catch {
          // Ausgabedatei fehlt (leere Seite) — überspringen
        }
      }

      // (6) Texte zusammenführen + sanitizen
      const combined = pageTexts.join("\n\n");
      const sanitized = sanitizeOcrText(combined);

      if (!sanitized.trim()) {
        throw new Error(
          `TesseractOcrEngine: OCR lieferte keinen Text — Scan-PDF möglicherweise unleserlich oder Sprache nicht erkannt (Sprache: ${TESSERACT_LANG})`,
        );
      }

      return sanitized;
    } finally {
      // Temp-Verzeichnis bereinigen (auch bei Fehler)
      if (tmpDir) {
        try {
          await rm(tmpDir, { recursive: true, force: true });
        } catch (cleanupErr) {
          console.warn(
            `TesseractOcrEngine: Temp-Verzeichnis konnte nicht bereinigt werden: ${tmpDir}`,
            cleanupErr,
          );
        }
      }
    }
  }
}
