/**
 * extract-docx.test.ts — Unit-Test für den DOCX-Zweig in extractContent
 *
 * mammoth wird lazy per dynamic import in extract.ts geladen —
 * vi.mock interceptiert auch Dynamic Imports in Vitest (Modul-Registry).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock wird von Vitest vor allen Imports gehoisted.
vi.mock("mammoth", () => ({
  default: {
    extractRawText: vi.fn(),
  },
}));

import mammoth from "mammoth";
import { extractContent, ExtractionFailedError } from "@/lib/rag/extract";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const FAKE_BUF = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // PK-Header (ZIP/DOCX)

describe("extractContent – DOCX", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gibt extrahierten Text zurück wenn mammoth Inhalt liefert", async () => {
    vi.mocked(mammoth.extractRawText).mockResolvedValue({
      value: "Hallo Welt",
      messages: [],
    });

    const result = await extractContent("lehrplan.docx", FAKE_BUF, DOCX_MIME);

    expect(result).toBe("Hallo Welt");
    expect(mammoth.extractRawText).toHaveBeenCalledOnce();
    expect(mammoth.extractRawText).toHaveBeenCalledWith({
      buffer: Buffer.from(FAKE_BUF),
    });
  });

  it("wirft ExtractionFailedError wenn value leer ist", async () => {
    vi.mocked(mammoth.extractRawText).mockResolvedValue({
      value: "",
      messages: [],
    });

    await expect(
      extractContent("lehrplan.docx", FAKE_BUF, DOCX_MIME),
    ).rejects.toThrow(ExtractionFailedError);
  });

  it("wirft ExtractionFailedError bei nur-Whitespace value", async () => {
    vi.mocked(mammoth.extractRawText).mockResolvedValue({
      value: "   \n\t  ",
      messages: [],
    });

    await expect(
      extractContent("lehrplan.docx", FAKE_BUF, DOCX_MIME),
    ).rejects.toThrow(ExtractionFailedError);
  });
});
