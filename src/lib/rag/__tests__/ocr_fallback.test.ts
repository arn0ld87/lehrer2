import { describe, it, expect } from "vitest";
import { extractContent } from "../extract";

describe("OCR Integration Fallback", () => {
  it("should throw ExtractionFailedError for images to trigger worker", async () => {
    const buf = new Uint8Array([1, 2, 3]);
    await expect(extractContent("test.jpg", buf, "image/jpeg")).rejects.toThrow(/Bild lieferte keinen Text/);
  });

  it("should throw ExtractionFailedError for empty PDF to trigger worker", async () => {
    // Small buffer will result in empty text from pdf-parse
    const buf = new Uint8Array([0, 0, 0]);
    await expect(extractContent("scan.pdf", buf, "application/pdf")).rejects.toThrow(/PDF lieferte keinen Text/);
  });
});
