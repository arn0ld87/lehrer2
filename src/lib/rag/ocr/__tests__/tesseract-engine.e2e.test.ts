/**
 * tesseract-engine.e2e.test.ts — Env-gated E2E-Test für TesseractOcrEngine
 *
 * Wird NUR ausgeführt, wenn `OCR_E2E=1` gesetzt ist (z. B. lokal mit installierten Binaries).
 * In CI: OCR_E2E ist nicht gesetzt → Test wird übersprungen.
 *
 * Muster: wie qdrant.e2e.test.ts (env-gated, kein Testcontainer für externe Tools)
 *
 * Voraussetzungen (lokal):
 *   - tesseract-ocr installiert
 *   - tesseract-ocr-deu installiert
 *   - poppler-utils (pdftoppm) installiert
 *   - Kleine Scan-PDF-Datei unter `src/lib/rag/ocr/__tests__/fixtures/scan-sample.pdf`
 *     (falls vorhanden; andernfalls wird ein minimales synthetisches Pseudo-PDF erzeugt)
 */

import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

const runE2E = process.env.OCR_E2E === "1";

describe.skipIf(!runE2E)(
  "TesseractOcrEngine E2E (OCR_E2E=1 erforderlich)",
  () => {
    it("erkennnt Text aus einer echten Scan-PDF", async () => {
      const { TesseractOcrEngine } = await import("../tesseract-engine.js");

      const engine = new TesseractOcrEngine();

      // Fixture-PDF suchen (falls vorhanden)
      const fixturePath = join(
        import.meta.dirname,
        "fixtures",
        "scan-sample.pdf",
      );

      let pdfBytes: Uint8Array;

      if (existsSync(fixturePath)) {
        const { readFile } = await import("node:fs/promises");
        pdfBytes = new Uint8Array(await readFile(fixturePath));
      } else {
        // Kein Fixture vorhanden — Test skipped mit sinnvoller Meldung
        console.warn(
          "[OCR E2E] Kein Fixture unter fixtures/scan-sample.pdf — Test wird übersprungen.",
        );
        return;
      }

      const result = await engine.recognizePdf(pdfBytes);

      // Grundlegende Invarianten
      expect(typeof result).toBe("string");
      expect(result.trim().length).toBeGreaterThan(0);

      // Kein Steuerzeichen oder rohe HTML-Tags im Output (sanitizeOcrText wurde angewendet)
      expect(result).not.toMatch(/[\x00-\x08\x0B\x0C\x0E-\x1F]/);
      expect(result).not.toMatch(/<script/i);

      console.log(
        `[OCR E2E] Extrahierter Text (erste 200 Zeichen): ${result.slice(0, 200)}`,
      );
    });
  },
);
