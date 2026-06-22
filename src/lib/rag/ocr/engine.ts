/**
 * engine.ts — OCR-Engine-Interface und Hilfsfunktionen
 *
 * Definiert das abstrakte `OcrEngine`-Interface und stellt bereit:
 *   - `FakeOcrEngine` für Tests (konfigurierbar, kein System-Aufruf)
 *   - `sanitizeOcrText` zur Bereinigung von OCR-Ausgaben (Sicherheit, §2.3 UPLOAD_AND_OCR_SECURITY)
 *
 * Sicherheitsanforderungen (THREAT_MODEL §3, UPLOAD_AND_OCR_SECURITY §2.3):
 *   - Steuerzeichen entfernen (kein roher JS/LaTeX-Durchschlag)
 *   - HTML-Tags bereinigen (kein XSS-Risiko durch OCR-Ausgabe)
 *   - Whitespace normalisieren
 *   - recognizePdf MUSS sanitizeOcrText aufrufen
 */

/**
 * OcrEngine — abstraktes Interface für alle OCR-Implementierungen.
 * Jede Implementierung MUSS `sanitizeOcrText` auf das Ergebnis anwenden.
 */
export interface OcrEngine {
  /**
   * Extrahiert Text aus einem PDF per OCR.
   *
   * @param bytes  Rohdaten des PDFs
   * @returns      Bereinigter Text (sanitizeOcrText wurde angewendet)
   * @throws       Bei fehlendem Binary, leerem Ergebnis oder sonstigen Fehlern
   */
  recognizePdf(bytes: Uint8Array): Promise<string>;
}

/**
 * Bereinigt rohen OCR-Text für sichere Weiterverarbeitung.
 *
 * Angewendete Transformationen (UPLOAD_AND_OCR_SECURITY §2.3, THREAT_MODEL §3):
 *   1. Steuerzeichen (außer \t, \n, \r) entfernen — kein LaTeX/JS-Durchschlag
 *   2. HTML-Tags entfernen — kein XSS-Risiko beim späteren Rendern
 *   3. HTML-Entities normalisieren
 *   4. Whitespace normalisieren (mehrfache Leerzeichen → eins)
 *   5. Führende/abschließende Leerzeichen trimmen
 *
 * @param raw  Roher OCR-Text
 * @returns    Bereinigter Text
 */
export function sanitizeOcrText(raw: string): string {
  // (1) Steuerzeichen entfernen — behält \t, \n, \r (Zeilenumbrüche für Lesbarkeit)
  // Unicode-Kategorien C0 (0x00–0x1F) und C1 (0x7F–0x9F) außer \t (0x09), \n (0x0A), \r (0x0D)
  let text = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/gu, "");

  // (2) HTML-Tags entfernen (kein roher HTML/JS-Durchschlag in späteren Rendering-Kontexten)
  // Skript/Style-Blöcke zuerst
  text = text
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");

  // (3) HTML-Entities normalisieren
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ");

  // (4) Mehrfache Leerzeichen (nicht Zeilenumbrüche) normalisieren
  text = text.replace(/[^\S\r\n]{2,}/g, " ");

  // (5) Trimmen
  return text.trim();
}

/**
 * FakeOcrEngine — deterministisch für Tests, kein System-Aufruf.
 *
 * Gibt den konfigurierten Text zurück; wirft bei leerem `returnText`,
 * wenn `throwOnEmpty` gesetzt ist.
 */
export class FakeOcrEngine implements OcrEngine {
  private returnText: string;
  private throwOnEmpty: boolean;

  /**
   * @param returnText   Text, den `recognizePdf` zurückgibt (nach sanitizeOcrText).
   *                     Leerstring simuliert ein fehlgeschlagenes OCR.
   * @param throwOnEmpty Wenn true, wirft recognizePdf bei leerem returnText.
   */
  constructor(returnText: string, throwOnEmpty = false) {
    this.returnText = returnText;
    this.throwOnEmpty = throwOnEmpty;
  }

  async recognizePdf(_bytes: Uint8Array): Promise<string> {
    const sanitized = sanitizeOcrText(this.returnText);
    if (this.throwOnEmpty && !sanitized.trim()) {
      throw new Error("FakeOcrEngine: OCR-Ergebnis ist leer (simulierter Fehler)");
    }
    return sanitized;
  }
}
