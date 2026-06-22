/**
 * qdrant.e2e.test.ts — Echter QdrantStore-E2E-/Contract-Test (#45)
 *
 * Startet ein reales Qdrant via Testcontainers (GenericContainer) und prüft
 * den QdrantStore-REST-Adapter end-to-end gegen die echte Engine:
 *   - ensureCollection legt die Collection mit Cosine-Distanz an (idempotent)
 *   - upsertPoints + search liefern reale Cosine-Scores in korrekter Reihenfolge
 *   - Payload-Filter (trust_level / subject / confession_context / source_id)
 *     wirken serverseitig wie der FakeVectorStore sie nachbildet
 *   - deletePoints (gezielt) und deleteByFilter (breit) verhalten sich korrekt
 *
 * ENV-GATE: läuft nur mit QDRANT_TEST=1 (sonst komplett übersprungen — kein
 * Docker-Zwang im Standard-CI). Benötigt eine funktionierende Docker-Umgebung.
 *
 *   QDRANT_TEST=1 pnpm test src/lib/infra/__tests__/qdrant.e2e.test.ts
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";

import { QdrantStore, type VectorPoint } from "../qdrant";

const GATED = process.env.QDRANT_TEST === "1";
const QDRANT_IMAGE = process.env.QDRANT_TEST_IMAGE ?? "qdrant/qdrant:v1.12.1";
const VECTOR_SIZE = 8;
const BOOT_TIMEOUT_MS = 180_000;

// Hilfsfunktion: 8-dim Einheitsähnliche Vektoren (deterministisch, kein Random)
function vec(values: number[]): number[] {
  const v = values.slice(0, VECTOR_SIZE);
  while (v.length < VECTOR_SIZE) v.push(0);
  return v;
}

describe.skipIf(!GATED)("QdrantStore E2E (reales Qdrant via Testcontainers, #45)", () => {
  let container: StartedTestContainer;
  let store: QdrantStore;

  beforeAll(async () => {
    container = await new GenericContainer(QDRANT_IMAGE)
      .withExposedPorts(6333)
      .withWaitStrategy(Wait.forHttp("/readyz", 6333).forStatusCode(200))
      .start();

    const url = `http://${container.getHost()}:${container.getMappedPort(6333)}`;
    store = new QdrantStore(url, "ua_lsa_e2e", VECTOR_SIZE);
    await store.ensureCollection();
  }, BOOT_TIMEOUT_MS);

  afterAll(async () => {
    await container?.stop();
  });

  it("ensureCollection ist idempotent (zweiter Aufruf wirft nicht)", async () => {
    await expect(store.ensureCollection()).resolves.not.toThrow();
  });

  it("upsertPoints + search liefern reale Cosine-Scores in Ähnlichkeitsreihenfolge", async () => {
    const points: VectorPoint[] = [
      {
        id: "11111111-1111-1111-1111-111111111111",
        vector: vec([1, 0, 0, 0]),
        payload: {
          source_id: "srcA",
          trust_level: "OFFICIAL_BINDING",
          subject: "DEUTSCH",
          confession_context: "NICHT_ANWENDBAR",
        },
      },
      {
        id: "22222222-2222-2222-2222-222222222222",
        vector: vec([0, 1, 0, 0]),
        payload: {
          source_id: "srcB",
          trust_level: "OFFICIAL_BINDING",
          subject: "RELIGION",
          confession_context: "EVANGELISCH",
        },
      },
      {
        id: "33333333-3333-3333-3333-333333333333",
        vector: vec([0, 0, 1, 0]),
        payload: {
          source_id: "srcC",
          trust_level: "UNVERIFIED",
          subject: "RELIGION",
          confession_context: "KATHOLISCH",
        },
      },
    ];
    await store.upsertPoints(points);

    // Query nahe an Punkt 1 → Punkt 1 muss zuerst kommen, Score ~1.0
    const results = await store.search(vec([0.9, 0.1, 0, 0]), {}, 10);
    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results[0]!.id).toBe("11111111-1111-1111-1111-111111111111");
    expect(results[0]!.score).toBeGreaterThan(results[1]!.score);
  });

  it("Filter trust_level (mustNot UNVERIFIED) schließt unverifizierte Punkte serverseitig aus", async () => {
    const results = await store.search(vec([0, 0, 1, 0]), { trustLevelNot: "UNVERIFIED" }, 10);
    const ids = results.map((r) => r.id);
    expect(ids).not.toContain("33333333-3333-3333-3333-333333333333");
  });

  it("Filter subject=DEUTSCH liefert nur Deutsch-Punkte", async () => {
    const results = await store.search(vec([1, 0, 0, 0]), { subject: "DEUTSCH" }, 10);
    expect(results.length).toBe(1);
    expect(results[0]!.payload.subject).toBe("DEUTSCH");
  });

  it("Filter confession_context IN [EVANGELISCH] trennt Konfessionen serverseitig", async () => {
    const results = await store.search(
      vec([0, 1, 0, 0]),
      { confessionContextIn: ["EVANGELISCH"] },
      10,
    );
    const confessions = results.map((r) => r.payload.confession_context);
    expect(confessions).toContain("EVANGELISCH");
    expect(confessions).not.toContain("KATHOLISCH");
  });

  it("deletePoints löscht gezielt nur die angegebene ID", async () => {
    await store.deletePoints(["33333333-3333-3333-3333-333333333333"]);
    const results = await store.search(vec([0, 0, 1, 0]), {}, 10);
    expect(results.map((r) => r.id)).not.toContain("33333333-3333-3333-3333-333333333333");
    // srcA/srcB bleiben unberührt
    expect(results.map((r) => r.id)).toContain("11111111-1111-1111-1111-111111111111");
  });

  it("deleteByFilter({sourceId}) löscht alle Punkte einer Quelle", async () => {
    await store.deleteByFilter({ sourceId: "srcA" });
    const results = await store.search(vec([1, 0, 0, 0]), {}, 10);
    expect(results.map((r) => r.id)).not.toContain("11111111-1111-1111-1111-111111111111");
  });
});
