/**
 * extract.ts — Inhaltsextraktion aus Rohdokumenten
 *
 * Unterstützte MIME-Typen:
 *   text/plain          — UTF-8-Dekodierung
 *   text/html           — Tag-Strip via Regex (keine externe Dep)
 *   application/pdf     — pdf-parse; leerer Text => OCR via ocrEngine (wenn übergeben)
 *                          oder ExtractionFailedError (Scan-PDF ohne OCR-Engine)
 *
 * Niemals einen leeren String zurückgeben — wirft ExtractionFailedError.
 *
 * OCR-Fallback (minimal-invasiv, #40):
 *   Wenn `application/pdf` UND pdf-parse liefert leeren Text UND `ocrEngine` übergeben ist:
 *     text = await ocrEngine.recognizePdf(buf)
 *   Ist OCR-Ergebnis ebenfalls leer → ExtractionFailedError (fail-laut, mit URI).
 *   OHNE `ocrEngine` bleibt das bisherige Verhalten EXAKT erhalten (wirft).
 */

import type { OcrEngine } from "./ocr/engine.js";

// pdf-parse uses `export =` (CJS); import-equals is required with moduleResolution:bundler
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;

export class ExtractionFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractionFailedError";
  }
}

/** Typ des PDF-Parser-Adapters (für Testbarkeit ohne vi.mock-CJS-Kämpfe) */
export type PdfParser = (buf: Buffer) => Promise<{ text: string }>;

/**
 * Extrahiert lesbaren Text aus einem Rohdokument.
 *
 * @param uri        Herkunfts-URI (nur für Fehlermeldungen)
 * @param buf        Rohdaten des Dokuments
 * @param mime       MIME-Type (z. B. "application/pdf")
 * @param ocrEngine  Optionale OCR-Engine für Scan-PDFs (wird nur bei leerem pdf-parse genutzt)
 * @param _pdfParser Optionaler PDF-Parser-Adapter (Standard: pdf-parse; nur für Tests)
 * @returns          Extrahierter Text (nie leer/nur-Whitespace)
 * @throws           ExtractionFailedError bei leerem Ergebnis oder nicht unterstütztem Typ
 */
export async function extractContent(
  uri: string,
  buf: Uint8Array,
  mime: string,
  ocrEngine?: OcrEngine,
  _pdfParser?: PdfParser,
): Promise<string> {
  const parser: PdfParser = _pdfParser ?? pdfParse;
  let text: string;

  if (mime === "text/plain") {
    text = Buffer.from(buf).toString("utf-8");
  } else if (mime === "text/html") {
    const raw = Buffer.from(buf).toString("utf-8");
    // Einfacher Tag-Strip: Skript/Style-Blöcke entfernen, dann alle Tags
    text = raw
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/\s{2,}/g, " ")
      .trim();
  } else if (mime === "application/pdf") {
    const result = await parser(Buffer.from(buf));
    text = result.text ?? "";
    if (!text.trim()) {
      // Scan-PDF: OCR-Fallback wenn ocrEngine übergeben (#40)
      if (ocrEngine) {
        const ocrText = await ocrEngine.recognizePdf(buf);
        if (!ocrText.trim()) {
          throw new ExtractionFailedError(
            `OCR-Worker: OCR lieferte ebenfalls leeren Text für Scan-PDF — Dokument nicht ingestierbar (URI: ${uri})`,
          );
        }
        text = ocrText;
      } else {
        throw new ExtractionFailedError(
          `PDF lieferte keinen Text — vermutlich Scan; OCR-Worker (M2.4) noetig; Maintainer-Issue anlegen (URI: ${uri})`,
        );
      }
    }
  } else {
    throw new ExtractionFailedError(
      `Nicht unterstützter MIME-Typ: ${mime} (URI: ${uri})`,
    );
  }

  if (!text.trim()) {
    throw new ExtractionFailedError(
      `Extraktion ergab leeren Text für URI: ${uri} (MIME: ${mime})`,
    );
  }

  return text;
}
