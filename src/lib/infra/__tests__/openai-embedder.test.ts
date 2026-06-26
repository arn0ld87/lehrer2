/**
 * OpenAIEmbedder — Unit-Tests (gemockter fetch, keine echten Netzwerk-Calls).
 *
 * Prüft: Batching, Ausgabereihenfolge (defensive Sortierung nach index),
 * Fehler-Propagierung, fail-closed bei fehlendem API-Key.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAIEmbedder } from "../openai-embedder";

afterEach(() => {
  vi.restoreAllMocks();
});

function mockEmbeddingFetch(dim = 3) {
  return vi.fn(async (_url: string, init?: { body?: string }) => {
    const body = JSON.parse(init?.body ?? "{}") as { input: string[] };
    // Antworten ABSICHTLICH in umgekehrter Reihenfolge, um die index-Sortierung zu prüfen.
    const data = body.input
      .map((_t, i) => ({
        index: i,
        embedding: Array.from({ length: dim }, (_v, d) => i + d / 10),
      }))
      .reverse();
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ data }),
    } as unknown as Response;
  });
}

describe("OpenAIEmbedder", () => {
  it("gibt Vektoren in Eingabereihenfolge zurück (sortiert nach index)", async () => {
    vi.stubGlobal("fetch", mockEmbeddingFetch(2));
    const e = new OpenAIEmbedder({ apiKey: "sk-test" });
    const out = await e.embed(["a", "b", "c"]);
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual([0, 0.1]);
    expect(out[1]).toEqual([1, 1.1]);
    expect(out[2]).toEqual([2, 2.1]);
  });

  it("batcht über batchSize hinweg und konkateniert in Reihenfolge", async () => {
    const fetchMock = mockEmbeddingFetch(1);
    vi.stubGlobal("fetch", fetchMock);
    const e = new OpenAIEmbedder({ apiKey: "sk-test", batchSize: 2 });
    const out = await e.embed(["a", "b", "c", "d", "e"]);
    expect(fetchMock).toHaveBeenCalledTimes(3); // 2+2+1
    expect(out).toHaveLength(5);
    // Jeder Batch nummeriert intern ab 0 → Werte [0],[1] pro Batch
    expect(out.map((v) => v[0])).toEqual([0, 1, 0, 1, 0]);
  });

  it("wirft bei nicht-ok-Response (fail-closed, kein stiller Fallback)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: async () => "rate limited",
      })) as unknown as typeof fetch,
    );
    const e = new OpenAIEmbedder({ apiKey: "sk-test" });
    await expect(e.embed(["x"])).rejects.toThrow(/429/);
  });

  it("wirft im Konstruktor ohne API-Key", () => {
    const saved = { key: process.env.OPENAI_API_KEY, emb: process.env.OPENAI_EMBEDDING_API_KEY };
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_EMBEDDING_API_KEY;
    try {
      expect(() => new OpenAIEmbedder()).toThrow(/API-Key/);
    } finally {
      if (saved.key !== undefined) process.env.OPENAI_API_KEY = saved.key;
      if (saved.emb !== undefined) process.env.OPENAI_EMBEDDING_API_KEY = saved.emb;
    }
  });
});
