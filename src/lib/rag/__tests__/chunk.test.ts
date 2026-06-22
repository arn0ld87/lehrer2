import { describe, it, expect } from "vitest";
import { chunkText } from "../chunk";

describe("chunkText", () => {
  /**
   * Test 1: Deterministisch — bei gleichem Input immer gleiche Chunk-Anzahl
   */
  it("should produce deterministic chunk count with default options", () => {
    const text = "x".repeat(3000);
    const result1 = chunkText(text);
    const result2 = chunkText(text);

    expect(result1.length).toBe(result2.length);
    expect(result1.map((c) => c.text)).toEqual(result2.map((c) => c.text));
  });

  /**
   * Test 2: Overlap funktioniert korrekt
   * Mit size=100, overlap=20 sollte step=80 sein.
   * Text der Länge 200 ergibt: [0..100], [80..160], [160..200]
   * Nach Merge: [0..100], [80..160] (letzter ist 40 Zeichen, < MIN_CHUNK_LEN=50, wird angehängt)
   */
  it("should correctly apply overlap between chunks", () => {
    const text = "a".repeat(200);
    const result = chunkText(text, { size: 100, overlap: 20 });

    // Mindestens 2 Chunks; Overlap bedeutet Wiederholung
    expect(result.length).toBeGreaterThanOrEqual(2);

    // Prüfe dass sich aufeinanderfolgende Chunks überlappen
    const chunk0 = result[0]!.text;
    const chunk1 = result[1]!.text;
    const expectedOverlap = 20;

    // Die letzten 20 Zeichen von chunk0 sollten die ersten 20 von chunk1 sein
    const chunk0Tail = chunk0.slice(-expectedOverlap);
    const chunk1Head = chunk1.slice(0, expectedOverlap);
    expect(chunk0Tail).toBe(chunk1Head);
  });

  /**
   * Test 3: Jeder Chunk hat pageOrSection gesetzt
   */
  it("should set pageOrSection on every chunk", () => {
    const text = "Test text ".repeat(150); // ~1500 Zeichen
    const result = chunkText(text);

    expect(result.length).toBeGreaterThan(0);
    result.forEach((chunk, idx) => {
      expect(chunk.pageOrSection).toBe(`chunk:${idx}`);
      expect(chunk.pageOrSection).toBeDefined();
    });
  });

  /**
   * Test 4: Leerer Input gibt leeres Array zurück
   */
  it("should return empty array for empty or whitespace-only input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   ")).toEqual([]);
    expect(chunkText("\n\t")).toEqual([]);
  });

  /**
   * Test 5: Zu kurzer End-Chunk wird an Vorgänger angehängt
   * Bei size=100, overlap=50 (step=50):
   * Text der Länge 150 ergibt raw: [0..100], [50..150]
   * chunk[1] ist 100 Zeichen, also nicht < MIN_CHUNK_LEN=50 → wird nicht angehängt
   * Text der Länge 130 ergibt raw: [0..100], [50..130]
   * chunk[1] ist 80 Zeichen, also auch nicht < 50
   * Text der Länge 110 ergibt raw: [0..100], [50..110]
   * chunk[1] ist 60 Zeichen, also auch nicht < 50
   * Text der Länge 105 ergibt raw: [0..100], [50..105]
   * chunk[1] ist 55 Zeichen, also auch nicht < 50
   * Text der Länge 101 ergibt raw: [0..100], [50..101]
   * chunk[1] ist nur 51 Zeichen, also nicht < 50
   * Text der Länge 100 + 49 = 149 mit step=50:
   * [0..100] (100 chars), [50..149] (99 chars) — second ist >= 50
   * Versuch: size=1000, overlap=900 (step=100), text=1050:
   * [0..1000] (1000), [100..1050] (950) — still >= 50
   * Versuch: text=1040, size=1000, overlap=900:
   * [0..1000] (1000), [100..1040] (940) — still >= 50
   * Versuch: size=1000, overlap=950 (step=50):
   * text=1040: [0..1000], [50..1040] (990) — >= 50
   * Versuch: text=1000 + 25 = 1025, size=1000, overlap=980 (step=20):
   * [0..1000], [20..1020], [40..1025] — last ist 985, >= 50
   * Versuch: text=1020 + 25 = 1045, size=1000, overlap=980 (step=20):
   * [0..1000], [20..1020], [40..1040], [60..1045]
   * last ist 1045-60=985, >= 50
   *
   * Einfacher: size=1000, overlap=990 (step=10):
   * text = "x".repeat(1010)
   * [0..1000] (1000), [10..1010] (1000) — both >= 50, keine Merge
   *
   * text = "x".repeat(1005):
   * [0..1000] (1000), [10..1005] (995) — >= 50, keine Merge
   *
   * text = "x".repeat(1001):
   * [0..1000] (1000), [10..1001] (991) — >= 50, keine Merge
   *
   * Versuch bei step=10: um letzte Chunk < 50 zu kriegen, brauchen wir
   * start + size > text.length AND text.length - start < 50
   * Bei letztem Schritt: start = 990, size=1000 → [990..1990] but text endet früher
   * text = "x".repeat(1039): [0..1000], [10..1010], ..., [990..1039]
   * last: 1039 - 990 = 49, das ist < 50! → wird angehängt
   * merged: [[0..1000] + [10..1010] + ... + [980..1039]]
   *
   * Einfacher Testfall: size=10, overlap=5 (step=5)
   * text="x".repeat(22): [0..10], [5..15], [10..20], [15..22]
   * [15..22] ist 7 Zeichen, < 50? NEIN, MIN_CHUNK_LEN=50
   *
   * text="x".repeat(10+49+1) = 60: [0..10], [5..15], [10..20], [15..25], ..., [50..60]
   * Mit step=5: 0,5,10,15,20,25,30,35,40,45,50
   * [50..60] ist 10 Zeichen, < 50 → wird angehängt
   * merged hat dann 10 chunks
   */
  it("should merge short final chunks (< 50 chars) with predecessor", () => {
    // size=10, overlap=5, step=5
    // text=60 chars: [0..10], [5..15], [10..20], [15..25], [20..30], [25..35], [30..40], [35..45], [40..50], [45..55], [50..60]
    // [50..60] ist 10 chars < 50 → merge mit [45..55]
    const text = "x".repeat(60);
    const result = chunkText(text, { size: 10, overlap: 5 });

    // Sollte 10 chunks sein (11 raw chunks, letzter angehängt)
    expect(result.length).toBe(10);
    // Letzter chunk sollte jetzt 10+10=20 Zeichen sein (merged)
    expect(result[result.length - 1]!.text.length).toBe(20);
  });

  /**
   * Test 6: Alle nicht-letzten Chunks sollten >= MIN_CHUNK_LEN sein
   * (außer evtl. wenn Merge stattgefunden hat)
   */
  it("should not have chunks under MIN_CHUNK_LEN except as merged final chunk", () => {
    const text = "word ".repeat(300); // ~1500 Zeichen
    const result = chunkText(text);

    // Alle Chunks sollten >= 50 sein (oder es gibt weniger als 2 chunks)
    if (result.length > 1) {
      // Erste n-1 chunks sollten >= MIN_CHUNK_LEN sein
      result.slice(0, -1).forEach((chunk) => {
        expect(chunk.text.length).toBeGreaterThanOrEqual(50);
      });
    }
  });

  /**
   * Test 7: Text exakt der size-Länge ergibt 1 Chunk
   */
  it("should produce single chunk for text exactly size length", () => {
    const text = "x".repeat(1000);
    const result = chunkText(text, { size: 1000, overlap: 100 });

    expect(result.length).toBe(1);
    expect(result[0]!.text).toBe(text);
    expect(result[0]!.pageOrSection).toBe("chunk:0");
  });

  /**
   * Test 8: Sehr kleine Texte (< size, aber > 0)
   */
  it("should handle text smaller than chunk size", () => {
    const text = "x".repeat(100);
    const result = chunkText(text);

    expect(result.length).toBe(1);
    expect(result[0]!.text).toBe(text);
  });

  /**
   * Test 9: overlap >= size sollte Error werfen
   */
  it("should throw error when overlap >= size", () => {
    expect(() => chunkText("test", { size: 100, overlap: 100 })).toThrow(
      /overlap.*muss kleiner sein als size/,
    );
    expect(() => chunkText("test", { size: 100, overlap: 150 })).toThrow(
      /overlap.*muss kleiner sein als size/,
    );
  });

  /**
   * Test 10: pageOrSection-Index ist 0-basiert und konsekutiv
   */
  it("should have consecutive zero-based pageOrSection indices", () => {
    const text = "x".repeat(3000);
    const result = chunkText(text);

    result.forEach((chunk, idx) => {
      expect(chunk.pageOrSection).toBe(`chunk:${idx}`);
    });
    // Prüfe dass alle Indizes 0..length-1 sind
    const indices = result.map((c) => parseInt(c.pageOrSection.replace("chunk:", ""), 10));
    expect(indices).toEqual(Array.from({ length: result.length }, (_, i) => i));
  });
});
