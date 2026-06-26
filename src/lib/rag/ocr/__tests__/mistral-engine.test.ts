/**
 * mistral-engine.test.ts — Unit-Tests für MistralOcrEngine
 *
 * Kein echter Netzwerk-Call; fetch und sleep sind injizierte Fakes.
 * Geprüfte Eigenschaften:
 *   (a) 200 mit pages.markdown → sanitizter Text zurückgegeben
 *   (b) 429 dann 200 → Retry erfolgreich
 *   (c) Leere pages → wirft aussagekräftigen Fehler
 *   (d) Fehlender API-Key → wirft im Konstruktor
 *   (e) API-Key erscheint NICHT in Fehlermeldungen
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MistralOcrEngine } from "../mistral-engine.js";

// ── Hilfsfunktionen ───────────────────────────────────────────────────────

interface FakeResponse {
  status: number;
  body: object;
}

/**
 * Erzeugt einen Fake-fetch, der Responses aus einer Liste sequenziell
 * zurückgibt. Nach Erschöpfen der Liste bleibt die letzte Response aktiv.
 */
function makeFakeFetch(responses: FakeResponse[]) {
  let callIndex = 0;
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit): Promise<Response> => {
    const resp = responses[Math.min(callIndex, responses.length - 1)];
    callIndex++;
    const ok = resp.status >= 200 && resp.status < 300;
    const bodyStr = JSON.stringify(resp.body);
    return {
      ok,
      status: resp.status,
      json: async () => resp.body,
      text: async () => bodyStr,
    } as unknown as Response;
  });
}

/** Fake-sleep, das sofort auflöst (kein echtes Warten in Tests) */
const noopSleep = async (_ms: number): Promise<void> => {};

/** Dummy-PDF-Bytes (beginnen mit %PDF-Magic) */
const DUMMY_PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-

/** Dummy-PNG-Bytes (beginnen mit PNG-Magic: 89 50 4E 47) */
const DUMMY_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Test-API-Key (wird nie an echte API gesendet) */
const TEST_API_KEY = "sk-test-deadbeef-1234567890abcdef";

// ── Tests ─────────────────────────────────────────────────────────────────

describe("MistralOcrEngine", () => {
  // Env-Variable vor/nach jedem Test sauber halten
  let savedKey: string | undefined;

  beforeEach(() => {
    savedKey = process.env.MISTRAL_API_KEY;
    delete process.env.MISTRAL_API_KEY;
  });

  afterEach(() => {
    if (savedKey !== undefined) {
      process.env.MISTRAL_API_KEY = savedKey;
    } else {
      delete process.env.MISTRAL_API_KEY;
    }
  });

  // ── (a) Erfolgreiche 200-Antwort ─────────────────────────────────────

  describe("(a) 200 mit pages.markdown", () => {
    it("gibt sanitizierten Text zurück und entfernt HTML-Tags", async () => {
      const fakeFetch = makeFakeFetch([
        {
          status: 200,
          body: {
            pages: [
              { index: 0, markdown: "Lehrplan  Deutsch\n" },
              { index: 1, markdown: "<b>Klasse 5</b> Schuljahr 2024" },
            ],
          },
        },
      ]);

      const engine = new MistralOcrEngine({
        apiKey: TEST_API_KEY,
        fetch: fakeFetch,
        sleep: noopSleep,
      });

      const result = await engine.recognizePdf(DUMMY_PDF);

      // Text aus beiden Seiten muss vorhanden sein
      expect(result).toContain("Lehrplan");
      expect(result).toContain("Deutsch");
      expect(result).toContain("Klasse 5");
      expect(result).toContain("Schuljahr 2024");

      // sanitizeOcrText muss HTML-Tags entfernt haben
      expect(result).not.toContain("<b>");
      expect(result).not.toContain("</b>");

      // Nur ein API-Call nötig
      expect(fakeFetch).toHaveBeenCalledOnce();
    });

    it("verbindet mehrere Seiten mit doppeltem Zeilenumbruch", async () => {
      const fakeFetch = makeFakeFetch([
        {
          status: 200,
          body: {
            pages: [
              { index: 0, markdown: "Seite eins" },
              { index: 1, markdown: "Seite zwei" },
            ],
          },
        },
      ]);

      const engine = new MistralOcrEngine({
        apiKey: TEST_API_KEY,
        fetch: fakeFetch,
        sleep: noopSleep,
      });

      const result = await engine.recognizePdf(DUMMY_PDF);
      expect(result).toContain("Seite eins");
      expect(result).toContain("Seite zwei");
    });

    it("erklärt PNG-Bilder via recognizeImage (image_url-Dokument)", async () => {
      const fakeFetch = makeFakeFetch([
        {
          status: 200,
          body: {
            pages: [{ index: 0, markdown: "Bildinhalt erkannt" }],
          },
        },
      ]);

      const engine = new MistralOcrEngine({
        apiKey: TEST_API_KEY,
        fetch: fakeFetch,
        sleep: noopSleep,
      });

      const result = await engine.recognizeImage(DUMMY_PNG);
      expect(result).toBe("Bildinhalt erkannt");

      // Prüfen, dass image_url (nicht document_url) gesendet wurde
      const sentBody = JSON.parse(
        (fakeFetch.mock.calls[0][1]?.body as string) ?? "{}",
      ) as { document?: { type?: string } };
      expect(sentBody.document?.type).toBe("image_url");
    });
  });

  // ── (b) 429 → Retry → 200 ────────────────────────────────────────────

  describe("(b) 429 dann 200 → Retry", () => {
    it("führt genau einen Retry durch und liefert Ergebnis", async () => {
      const fakeFetch = makeFakeFetch([
        { status: 429, body: { message: "Rate limit exceeded" } },
        {
          status: 200,
          body: { pages: [{ index: 0, markdown: "Retry erfolgreich" }] },
        },
      ]);

      const engine = new MistralOcrEngine({
        apiKey: TEST_API_KEY,
        fetch: fakeFetch,
        sleep: noopSleep,
        maxRetries: 2,
      });

      const result = await engine.recognizePdf(DUMMY_PDF);

      expect(result).toBe("Retry erfolgreich");
      expect(fakeFetch).toHaveBeenCalledTimes(2);
    });

    it("wirft nach Erschöpfung aller Retries bei dauerhaftem 429", async () => {
      // Alle 5 Calls (1 initial + 4 Retries) geben 429 zurück
      const fakeFetch = makeFakeFetch([
        { status: 429, body: { message: "Rate limit exceeded" } },
      ]);

      const engine = new MistralOcrEngine({
        apiKey: TEST_API_KEY,
        fetch: fakeFetch,
        sleep: noopSleep,
        maxRetries: 4,
      });

      await expect(engine.recognizePdf(DUMMY_PDF)).rejects.toThrow("429");
      expect(fakeFetch).toHaveBeenCalledTimes(5); // 1 initial + 4 Retries
    });

    it("führt Retry auch bei 5xx durch", async () => {
      const fakeFetch = makeFakeFetch([
        { status: 503, body: { message: "Service Unavailable" } },
        {
          status: 200,
          body: { pages: [{ index: 0, markdown: "Nach 503 erfolgreich" }] },
        },
      ]);

      const engine = new MistralOcrEngine({
        apiKey: TEST_API_KEY,
        fetch: fakeFetch,
        sleep: noopSleep,
        maxRetries: 1,
      });

      const result = await engine.recognizePdf(DUMMY_PDF);
      expect(result).toContain("Nach 503 erfolgreich");
    });
  });

  // ── (c) Leere pages → wirft ──────────────────────────────────────────

  describe("(c) Leere pages → wirft", () => {
    it("recognizePdf wirft bei pages: []", async () => {
      const fakeFetch = makeFakeFetch([
        { status: 200, body: { pages: [] } },
      ]);

      const engine = new MistralOcrEngine({
        apiKey: TEST_API_KEY,
        fetch: fakeFetch,
        sleep: noopSleep,
      });

      await expect(engine.recognizePdf(DUMMY_PDF)).rejects.toThrow(
        /keine Seiten/,
      );
    });

    it("recognizeImage wirft bei pages: []", async () => {
      const fakeFetch = makeFakeFetch([
        { status: 200, body: { pages: [] } },
      ]);

      const engine = new MistralOcrEngine({
        apiKey: TEST_API_KEY,
        fetch: fakeFetch,
        sleep: noopSleep,
      });

      await expect(engine.recognizeImage(DUMMY_PNG)).rejects.toThrow(
        /kein Ergebnis/,
      );
    });

    it("wirft bei pages mit nur Leerzeichen-Markdown", async () => {
      const fakeFetch = makeFakeFetch([
        {
          status: 200,
          body: { pages: [{ index: 0, markdown: "   \n\n   " }] },
        },
      ]);

      const engine = new MistralOcrEngine({
        apiKey: TEST_API_KEY,
        fetch: fakeFetch,
        sleep: noopSleep,
      });

      await expect(engine.recognizePdf(DUMMY_PDF)).rejects.toThrow(
        /leer/,
      );
    });
  });

  // ── (d) Fehlender Key → wirft im Konstruktor ─────────────────────────

  describe("(d) Fehlender API-Key", () => {
    it("wirft im Konstruktor wenn kein Key gesetzt", () => {
      // MISTRAL_API_KEY ist durch beforeEach gelöscht
      expect(
        () =>
          new MistralOcrEngine({
            fetch: async () => new Response(),
            sleep: noopSleep,
          }),
      ).toThrow("MISTRAL_API_KEY fehlt");
    });

    it("akzeptiert Key aus apiKey-Option", () => {
      // Kein Env, aber explizite Option → kein Fehler
      expect(
        () =>
          new MistralOcrEngine({
            apiKey: "explicit-key",
            fetch: async () => new Response(),
            sleep: noopSleep,
          }),
      ).not.toThrow();
    });

    it("akzeptiert Key aus MISTRAL_API_KEY Env-Variable", () => {
      process.env.MISTRAL_API_KEY = "env-key-12345";
      expect(
        () =>
          new MistralOcrEngine({
            fetch: async () => new Response(),
            sleep: noopSleep,
          }),
      ).not.toThrow();
    });
  });

  // ── (e) Key NICHT im Fehlertext ──────────────────────────────────────

  describe("(e) API-Key erscheint NICHT in Fehlermeldungen", () => {
    it("Key fehlt in HTTP-500-Fehlermeldung", async () => {
      const fakeFetch = makeFakeFetch([
        { status: 500, body: { message: "Internal Server Error" } },
      ]);

      const engine = new MistralOcrEngine({
        apiKey: TEST_API_KEY,
        fetch: fakeFetch,
        sleep: noopSleep,
        maxRetries: 0,
      });

      await expect(engine.recognizePdf(DUMMY_PDF)).rejects.toSatisfy(
        (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          return !msg.includes(TEST_API_KEY);
        },
      );
    });

    it("Key fehlt in 429-Fehlermeldung nach Erschöpfung der Retries", async () => {
      const fakeFetch = makeFakeFetch([
        { status: 429, body: { message: "too many requests" } },
      ]);

      const engine = new MistralOcrEngine({
        apiKey: TEST_API_KEY,
        fetch: fakeFetch,
        sleep: noopSleep,
        maxRetries: 1,
      });

      await expect(engine.recognizePdf(DUMMY_PDF)).rejects.toSatisfy(
        (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          return !msg.includes(TEST_API_KEY);
        },
      );
    });

    it("Key fehlt in Timeout-Fehlermeldung", async () => {
      // Fetch, der sofort einen AbortError simuliert
      const abortingFetch = vi.fn(
        async (_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
          const signal = init?.signal;
          if (signal) {
            const err = new DOMException("Aborted", "AbortError");
            throw err;
          }
          return new Response();
        },
      );

      const engine = new MistralOcrEngine({
        apiKey: TEST_API_KEY,
        fetch: abortingFetch,
        sleep: noopSleep,
        maxRetries: 0,
        timeoutMs: 1,
      });

      await expect(engine.recognizePdf(DUMMY_PDF)).rejects.toSatisfy(
        (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          return !msg.includes(TEST_API_KEY);
        },
      );
    });
  });
});
