/**
 * extract.ts — Inhaltsextraktion aus Rohdokumenten
 *
 * Unterstützte MIME-Typen:
 *   text/plain          — UTF-8-Dekodierung
 *   text/html           — Tag-Strip via Regex (keine externe Dep)
 *   application/pdf     — pdf-parse; leerer Text => ExtractionFailedError (Scan-PDF)
 *
 * Niemals einen leeren String zurückgeben — wirft ExtractionFailedError.
 */

// pdf-parse uses `export =` (CJS); import-equals is required with moduleResolution:bundler
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;

export class ExtractionFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractionFailedError";
  }
}

/**
 * Extrahiert lesbaren Text aus einem Rohdokument.
 *
 * @param uri   Herkunfts-URI (nur für Fehlermeldungen)
 * @param buf   Rohdaten des Dokuments
 * @param mime  MIME-Type (z. B. "application/pdf")
 * @returns     Extrahierter Text (nie leer/nur-Whitespace)
 * @throws      ExtractionFailedError bei leerem Ergebnis oder nicht unterstütztem Typ
 */
export async function extractContent(
  uri: string,
  buf: Uint8Array,
  mime: string,
): Promise<string> {
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
    const result = await pdfParse(Buffer.from(buf));
    text = result.text ?? "";
    if (!text.trim()) {
      throw new ExtractionFailedError(
        `PDF lieferte keinen Text — vermutlich Scan; OCR-Worker (M2.4) noetig; Maintainer-Issue anlegen (URI: ${uri})`,
      );
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
