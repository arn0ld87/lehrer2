/**
 * mistral-engine.ts — MistralOcrEngine
 *
 * OcrEngine-Implementierung via Mistral OCR API (raw fetch, kein SDK).
 * Scannt PDFs und Bilder per Cloud-API mit Retry bei Rate-Limits und 5xx.
 *
 * Voraussetzungen:
 *   - MISTRAL_API_KEY (Pflicht; fehlt → klarer Fehler, Key-Inhalt wird NIEMALS geloggt)
 *   - MISTRAL_OCR_MODEL (Default: "mistral-ocr-latest")
 *   - MISTRAL_OCR_BASE_URL (Default: "https://api.mistral.ai")
 *
 * Sicherheit (THREAT_MODEL §3, DATA_PROTECTION):
 *   - API-Key erscheint NICHT in Fehlermeldungen, Logs oder Throws
 *   - Leeres OCR-Ergebnis → wirft (fail-laut), nie leeren String
 *   - sanitizeOcrText wird immer auf das zusammengefügte Markdown angewendet
 */

import { type OcrEngine, sanitizeOcrText } from "./engine.js";

// ── Konstanten ────────────────────────────────────────────────────────────

/** Standard-Timeout für einen einzelnen OCR-Request (ms) */
const DEFAULT_TIMEOUT_MS = 120_000;

/** Maximale Retry-Versuche bei 429 / 5xx */
const DEFAULT_MAX_RETRIES = 4;

/** Basis-Delay für exponentielles Backoff (ms) */
const BASE_DELAY_MS = 2_000;

// ── Hilfsfunktionen ───────────────────────────────────────────────────────

/** Prüft, ob ein HTTP-Status einen Retry rechtfertigt (429 oder 5xx) */
function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

/**
 * Berechnet Delay mit exponentiellem Backoff + Jitter (0–50 % des Delays).
 * Verhindert Thundering-Herd bei Rate-Limit-Antworten.
 */
function calcDelay(attempt: number, baseMs: number): number {
  const expDelay = baseMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.5 * expDelay;
  return Math.floor(expDelay + jitter);
}

/**
 * Erkennt MIME-Typ aus Bildbytes via Magic-Bytes.
 *   PNG:  89 50 4E 47
 *   JPEG: FF D8
 * Default: image/jpeg
 */
function detectImageMime(bytes: Uint8Array): "image/png" | "image/jpeg" {
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  return "image/jpeg";
}

/** Uint8Array → Base64-String (Node.js Buffer, keine Abhängigkeiten) */
function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

// ── API-Typen ─────────────────────────────────────────────────────────────

interface MistralOcrPage {
  index: number;
  markdown: string;
}

interface MistralOcrResponse {
  pages: MistralOcrPage[];
}

// ── Optionen ──────────────────────────────────────────────────────────────

/**
 * Injizierbare Abhängigkeiten — primär für Tests (Fake-fetch, Fake-sleep).
 * In Produktion werden Defaults aus Umgebungsvariablen geladen.
 */
export interface MistralOcrEngineOptions {
  /** API-Key; Default: process.env.MISTRAL_API_KEY */
  apiKey?: string;
  /** Modell-ID; Default: process.env.MISTRAL_OCR_MODEL ?? "mistral-ocr-latest" */
  model?: string;
  /** Basis-URL; Default: process.env.MISTRAL_OCR_BASE_URL ?? "https://api.mistral.ai" */
  baseUrl?: string;
  /** Maximale Retry-Versuche; Default: 4 */
  maxRetries?: number;
  /** Request-Timeout in ms; Default: 120 000 */
  timeoutMs?: number;
  /** Fetch-Implementierung; Default: globalThis.fetch */
  fetch?: typeof globalThis.fetch;
  /** Sleep-Implementierung für Backoff; Default: setTimeout-basiert */
  sleep?: (ms: number) => Promise<void>;
}

// ── Implementierung ───────────────────────────────────────────────────────

/**
 * MistralOcrEngine — Cloud-OCR via Mistral OCR API (raw fetch, kein SDK).
 *
 * Retry-Strategie: exponentielles Backoff + Jitter bei HTTP 429 und 5xx.
 * Leeres OCR-Ergebnis und fehlender API-Key → klarer Fehler (fail-laut).
 */
export class MistralOcrEngine implements OcrEngine {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly sleepFn: (ms: number) => Promise<void>;

  constructor(opts: MistralOcrEngineOptions = {}) {
    const key = opts.apiKey ?? process.env.MISTRAL_API_KEY ?? "";
    if (!key) {
      throw new Error(
        "MistralOcrEngine: MISTRAL_API_KEY fehlt — Umgebungsvariable setzen oder apiKey-Option übergeben",
      );
    }
    this.apiKey = key;
    this.model =
      opts.model ?? process.env.MISTRAL_OCR_MODEL ?? "mistral-ocr-latest";
    this.baseUrl =
      opts.baseUrl ??
      process.env.MISTRAL_OCR_BASE_URL ??
      "https://api.mistral.ai";
    this.maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchFn = opts.fetch ?? globalThis.fetch;
    this.sleepFn =
      opts.sleep ??
      ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  }

  /**
   * Sendet einen OCR-Request an die Mistral API mit Retry-Logik.
   * API-Key erscheint NICHT in Fehlermeldungen.
   */
  private async callOcr(body: object): Promise<MistralOcrResponse> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.timeoutMs,
      );

      let response: Response;
      try {
        response = await this.fetchFn(`${this.baseUrl}/v1/ocr`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error(
            `MistralOcrEngine: Request-Timeout nach ${this.timeoutMs}ms — kein Ergebnis von der API`,
          );
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }

      if (response.ok) {
        return (await response.json()) as MistralOcrResponse;
      }

      const status = response.status;
      // Kurzen Fehler-Body lesen (max 200 Zeichen) — Key ist hier NICHT enthalten
      let snippet = "";
      try {
        const raw = await response.text();
        snippet = raw.slice(0, 200);
      } catch {
        // ignorieren — response.text() kann bei Netzwerkfehlern werfen
      }

      if (isRetryableStatus(status) && attempt < this.maxRetries) {
        lastError = new Error(`MistralOcrEngine: HTTP ${status} — ${snippet}`);
        const delay = calcDelay(attempt, BASE_DELAY_MS);
        await this.sleepFn(delay);
        continue;
      }

      // Nicht-retryable oder alle Retries erschöpft
      throw new Error(`MistralOcrEngine: HTTP ${status} — ${snippet}`);
    }

    throw (
      lastError ??
      new Error("MistralOcrEngine: Alle Retry-Versuche fehlgeschlagen")
    );
  }

  /**
   * Extrahiert Text aus einem PDF via Mistral OCR API.
   *
   * @param bytes  Rohdaten des PDFs (Scan-PDF ohne Textebene)
   * @returns      Bereinigter Text (sanitizeOcrText angewendet)
   * @throws       Bei fehlendem Key, leerem Ergebnis, Netzwerkfehler oder Timeout
   */
  async recognizePdf(bytes: Uint8Array): Promise<string> {
    const base64 = toBase64(bytes);
    const data = await this.callOcr({
      model: this.model,
      document: {
        type: "document_url",
        document_url: `data:application/pdf;base64,${base64}`,
      },
      include_image_base64: false,
    });

    const pages = data.pages ?? [];
    if (pages.length === 0) {
      throw new Error(
        "MistralOcrEngine: OCR lieferte keine Seiten — PDF möglicherweise leer oder nicht lesbar",
      );
    }

    const combined = pages.map((p) => p.markdown).join("\n\n");
    const sanitized = sanitizeOcrText(combined);

    if (!sanitized.trim()) {
      throw new Error(
        "MistralOcrEngine: OCR-Ergebnis nach Sanitierung leer — kein verwertbarer Text extrahiert",
      );
    }

    return sanitized;
  }

  /**
   * Extrahiert Text aus einer Bilddatei (JPEG/PNG) via Mistral OCR API.
   * MIME-Typ wird aus Magic-Bytes ermittelt.
   *
   * @param bytes  Rohdaten des Bildes
   * @returns      Bereinigter Text (sanitizeOcrText angewendet)
   * @throws       Bei fehlendem Key, leerem Ergebnis, Netzwerkfehler oder Timeout
   */
  async recognizeImage(bytes: Uint8Array): Promise<string> {
    const mime = detectImageMime(bytes);
    const subtype = mime.split("/")[1]; // "png" | "jpeg"
    const base64 = toBase64(bytes);

    const data = await this.callOcr({
      model: this.model,
      document: {
        type: "image_url",
        image_url: `data:image/${subtype};base64,${base64}`,
      },
      include_image_base64: false,
    });

    const pages = data.pages ?? [];
    if (pages.length === 0) {
      throw new Error(
        "MistralOcrEngine: OCR lieferte kein Ergebnis — Bild möglicherweise leer oder nicht lesbar",
      );
    }

    const combined = pages.map((p) => p.markdown).join("\n\n");
    const sanitized = sanitizeOcrText(combined);

    if (!sanitized.trim()) {
      throw new Error(
        "MistralOcrEngine: OCR-Ergebnis nach Sanitierung leer — kein verwertbarer Text extrahiert",
      );
    }

    return sanitized;
  }
}
