import { describe, expect, it } from "vitest";
import { exportArtifact } from "@/lib/export";
import { buildFooter } from "@/lib/export/footer";
import type { ExportableWorksheet } from "@/lib/export/types";

const ws: ExportableWorksheet = {
  title: "Argumentation Klasse 8",
  instructions: "Bearbeite die Aufgaben.",
  tasks: [{ prompt: "Analysiere den Text.", difficulty: "MEDIUM" }],
  license: "CC-BY-SA-4.0",
  derivationSource: "Lehrplan Deutsch LSA",
  sources: [{ title: "Lehrplan Deutsch LSA Kl. 8", locator: "§3.2.1", license: "OFFICIAL_BINDING" }],
};

describe("Export-Footer", () => {
  it("listet Quelle, Lokator und Lizenz", () => {
    const f = buildFooter(ws);
    expect(f).toContain("Lehrplan Deutsch LSA Kl. 8");
    expect(f).toContain("§3.2.1");
    expect(f).toContain("Lizenz: CC-BY-SA-4.0");
  });
});

describe("exportArtifact", () => {
  it("erzeugt DOCX-Bytes", async () => {
    const r = await exportArtifact(ws, "docx");
    expect(r.format).toBe("docx");
    expect(r.bytes.length).toBeGreaterThan(0);
    expect(r.filename).toMatch(/\.docx$/);
  });
  it("erzeugt PDF-Bytes (Magic-Header %PDF)", async () => {
    const r = await exportArtifact(ws, "pdf");
    expect(r.bytes.subarray(0, 4).toString()).toBe("%PDF");
  });
});
