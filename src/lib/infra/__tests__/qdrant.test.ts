import { describe, it, expect, beforeEach } from "vitest";
import { FakeVectorStore, VectorPoint, SearchFilter } from "../qdrant";

describe("FakeVectorStore", () => {
  let store: FakeVectorStore;

  beforeEach(async () => {
    store = new FakeVectorStore();
    await store.ensureCollection();
  });

  describe("upsertPoints", () => {
    it("should store points with full payload", async () => {
      const points: VectorPoint[] = [
        {
          id: "p1",
          vector: [1, 2, 3],
          payload: {
            trust_level: "OFFICIAL_BINDING",
            subject: "DEUTSCH",
            confession_context: "NICHT_ANWENDBAR",
            source_id: "src123",
          },
        },
      ];

      await store.upsertPoints(points);

      const results = await store.search([1, 2, 3], {}, 10);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("p1");
      expect(results[0].payload.trust_level).toBe("OFFICIAL_BINDING");
    });

    it("should overwrite duplicate IDs", async () => {
      const point1: VectorPoint = {
        id: "p1",
        vector: [1, 2, 3],
        payload: { trust_level: "OFFICIAL_BINDING" },
      };

      const point2: VectorPoint = {
        id: "p1",
        vector: [4, 5, 6],
        payload: { trust_level: "OPEN_CURATED" },
      };

      await store.upsertPoints([point1]);
      await store.upsertPoints([point2]);

      const results = await store.search([4, 5, 6], {}, 10);
      expect(results).toHaveLength(1);
      expect(results[0].payload.trust_level).toBe("OPEN_CURATED");
    });

    it("should handle empty array", async () => {
      await store.upsertPoints([]);
      const results = await store.search([1, 2, 3], {}, 10);
      expect(results).toHaveLength(0);
    });
  });

  describe("search with trustLevelNot filter", () => {
    beforeEach(async () => {
      const points: VectorPoint[] = [
        {
          id: "p1",
          vector: [1, 2, 3],
          payload: { trust_level: "OFFICIAL_BINDING" },
        },
        {
          id: "p2",
          vector: [1, 2, 3],
          payload: { trust_level: "UNVERIFIED" },
        },
        {
          id: "p3",
          vector: [1, 2, 3],
          payload: { trust_level: "OPEN_CURATED" },
        },
      ];
      await store.upsertPoints(points);
    });

    it("should exclude points matching trustLevelNot", async () => {
      const filter: SearchFilter = { trustLevelNot: "UNVERIFIED" };
      const results = await store.search([1, 2, 3], filter, 10);

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.id)).toEqual(
        expect.not.arrayContaining(["p2"]),
      );
      expect(results.map((r) => r.id)).toContain("p1");
      expect(results.map((r) => r.id)).toContain("p3");
    });

    it("should include all when trustLevelNot is not specified", async () => {
      const filter: SearchFilter = {};
      const results = await store.search([1, 2, 3], filter, 10);

      expect(results).toHaveLength(3);
    });

    it("should enforce trustLevelNot with payload check", async () => {
      const results = await store.search([1, 2, 3], { trustLevelNot: "UNVERIFIED" }, 10);

      // Binding guarantee: all returned points must NOT have trust_level === "UNVERIFIED"
      for (const point of results) {
        expect(point.payload.trust_level).not.toBe("UNVERIFIED");
      }
    });
  });

  describe("search with subject filter", () => {
    beforeEach(async () => {
      const points: VectorPoint[] = [
        {
          id: "p1",
          vector: [1, 2, 3],
          payload: { subject: "DEUTSCH", trust_level: "OFFICIAL_BINDING" },
        },
        {
          id: "p2",
          vector: [1, 2, 3],
          payload: { subject: "RELIGION", trust_level: "OFFICIAL_BINDING" },
        },
        {
          id: "p3",
          vector: [1, 2, 3],
          payload: { subject: "ETHIK", trust_level: "OFFICIAL_BINDING" },
        },
      ];
      await store.upsertPoints(points);
    });

    it("should filter by exact subject match", async () => {
      const filter: SearchFilter = { subject: "DEUTSCH" };
      const results = await store.search([1, 2, 3], filter, 10);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("p1");
      expect(results[0].payload.subject).toBe("DEUTSCH");
    });

    it("should return empty when subject does not match", async () => {
      const filter: SearchFilter = { subject: "NONEXISTENT" };
      const results = await store.search([1, 2, 3], filter, 10);

      expect(results).toHaveLength(0);
    });
  });

  describe("search with confessionContextIn filter", () => {
    beforeEach(async () => {
      const points: VectorPoint[] = [
        {
          id: "p1",
          vector: [1, 2, 3],
          payload: { confession_context: "EVANGELISCH", trust_level: "OFFICIAL_BINDING" },
        },
        {
          id: "p2",
          vector: [1, 2, 3],
          payload: { confession_context: "KATHOLISCH", trust_level: "OFFICIAL_BINDING" },
        },
        {
          id: "p3",
          vector: [1, 2, 3],
          payload: {
            confession_context: "KONFESSIONSSENSIBEL_UEBERGREIFEND",
            trust_level: "OFFICIAL_BINDING",
          },
        },
        {
          id: "p4",
          vector: [1, 2, 3],
          payload: { confession_context: "RELIGIONSKUNDLICH", trust_level: "OFFICIAL_BINDING" },
        },
        {
          id: "p5",
          vector: [1, 2, 3],
          payload: { confession_context: "NICHT_ANWENDBAR", trust_level: "OFFICIAL_BINDING" },
        },
      ];
      await store.upsertPoints(points);
    });

    it("should include only points in confessionContextIn list", async () => {
      const filter: SearchFilter = {
        confessionContextIn: ["EVANGELISCH", "KATHOLISCH"],
      };
      const results = await store.search([1, 2, 3], filter, 10);

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.id).sort()).toEqual(["p1", "p2"]);
    });

    it("should enforce confessionContextIn with payload check", async () => {
      const allowedContexts = ["KONFESSIONSSENSIBEL_UEBERGREIFEND", "RELIGIONSKUNDLICH"];
      const filter: SearchFilter = { confessionContextIn: allowedContexts };
      const results = await store.search([1, 2, 3], filter, 10);

      // Binding guarantee: all returned points must have confession_context in the filter list
      for (const point of results) {
        expect(allowedContexts).toContain(point.payload.confession_context);
      }
    });

    it("should return all when confessionContextIn is empty", async () => {
      const filter: SearchFilter = { confessionContextIn: [] };
      const results = await store.search([1, 2, 3], filter, 10);

      expect(results).toHaveLength(5);
    });
  });

  describe("search with combined filters", () => {
    beforeEach(async () => {
      const points: VectorPoint[] = [
        {
          id: "p1",
          vector: [1, 2, 3],
          payload: {
            subject: "DEUTSCH",
            trust_level: "OFFICIAL_BINDING",
            confession_context: "NICHT_ANWENDBAR",
          },
        },
        {
          id: "p2",
          vector: [1, 2, 3],
          payload: {
            subject: "RELIGION",
            trust_level: "UNVERIFIED",
            confession_context: "EVANGELISCH",
          },
        },
        {
          id: "p3",
          vector: [1, 2, 3],
          payload: {
            subject: "RELIGION",
            trust_level: "OFFICIAL_BINDING",
            confession_context: "EVANGELISCH",
          },
        },
        {
          id: "p4",
          vector: [1, 2, 3],
          payload: {
            subject: "RELIGION",
            trust_level: "OFFICIAL_BINDING",
            confession_context: "KATHOLISCH",
          },
        },
      ];
      await store.upsertPoints(points);
    });

    it("should apply all filters (AND logic)", async () => {
      const filter: SearchFilter = {
        subject: "RELIGION",
        trustLevelNot: "UNVERIFIED",
        confessionContextIn: ["EVANGELISCH"],
      };
      const results = await store.search([1, 2, 3], filter, 10);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("p3");
    });

    it("should combine trustLevelNot with confessionContextIn", async () => {
      const filter: SearchFilter = {
        trustLevelNot: "UNVERIFIED",
        confessionContextIn: ["EVANGELISCH", "KATHOLISCH"],
      };
      const results = await store.search([1, 2, 3], filter, 10);

      expect(results.map((r) => r.id).sort()).toEqual(["p3", "p4"]);
      for (const point of results) {
        expect(point.payload.trust_level).not.toBe("UNVERIFIED");
        expect(["EVANGELISCH", "KATHOLISCH"]).toContain(
          point.payload.confession_context,
        );
      }
    });

    it("should return empty when no points match all filters", async () => {
      const filter: SearchFilter = {
        subject: "DEUTSCH",
        confessionContextIn: ["EVANGELISCH"],
      };
      const results = await store.search([1, 2, 3], filter, 10);

      expect(results).toHaveLength(0);
    });
  });

  describe("search with limit", () => {
    beforeEach(async () => {
      const points: VectorPoint[] = [
        { id: "p1", vector: [1, 2, 3], payload: { trust_level: "OFFICIAL_BINDING" } },
        { id: "p2", vector: [1, 2, 3], payload: { trust_level: "OFFICIAL_BINDING" } },
        { id: "p3", vector: [1, 2, 3], payload: { trust_level: "OFFICIAL_BINDING" } },
        { id: "p4", vector: [1, 2, 3], payload: { trust_level: "OFFICIAL_BINDING" } },
      ];
      await store.upsertPoints(points);
    });

    it("should respect limit parameter", async () => {
      const results = await store.search([1, 2, 3], {}, 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("should use default limit of 10 when not specified", async () => {
      const results = await store.search([1, 2, 3], {});
      expect(results).toHaveLength(4);
    });
  });

  describe("deleteByFilter", () => {
    beforeEach(async () => {
      const points: VectorPoint[] = [
        {
          id: "p1",
          vector: [1, 2, 3],
          payload: {
            source_id: "src1",
            trust_level: "OFFICIAL_BINDING",
            subject: "DEUTSCH",
          },
        },
        {
          id: "p2",
          vector: [1, 2, 3],
          payload: {
            source_id: "src1",
            trust_level: "UNVERIFIED",
            subject: "DEUTSCH",
          },
        },
        {
          id: "p3",
          vector: [1, 2, 3],
          payload: {
            source_id: "src2",
            trust_level: "OFFICIAL_BINDING",
            subject: "RELIGION",
          },
        },
        {
          id: "p4",
          vector: [1, 2, 3],
          payload: {
            source_id: "src2",
            trust_level: "OFFICIAL_BINDING",
            subject: "DEUTSCH",
          },
        },
      ];
      await store.upsertPoints(points);
    });

    it("should delete by sourceId (exact match)", async () => {
      const filter: SearchFilter = { sourceId: "src1" };
      await store.deleteByFilter(filter);

      const results = await store.search([1, 2, 3], {}, 10);
      expect(results.map((r) => r.id)).not.toContain("p1");
      expect(results.map((r) => r.id)).not.toContain("p2");
      expect(results.map((r) => r.id)).toContain("p3");
      expect(results.map((r) => r.id)).toContain("p4");
    });

    it("should delete by trustLevelNot (remove matching trust_level)", async () => {
      const filter: SearchFilter = { trustLevelNot: "UNVERIFIED" };
      await store.deleteByFilter(filter);

      const results = await store.search([1, 2, 3], {}, 10);
      // Should only keep points with trust_level === "UNVERIFIED"
      expect(results.map((r) => r.id)).toEqual(["p2"]);
    });

    it("should delete by confessionContextIn", async () => {
      await store.upsertPoints([
        {
          id: "p5",
          vector: [1, 2, 3],
          payload: {
            source_id: "src3",
            subject: "RELIGION",
            confession_context: "EVANGELISCH",
          },
        },
        {
          id: "p6",
          vector: [1, 2, 3],
          payload: {
            source_id: "src3",
            subject: "RELIGION",
            confession_context: "KATHOLISCH",
          },
        },
      ]);

      const filter: SearchFilter = {
        confessionContextIn: ["EVANGELISCH"],
      };
      await store.deleteByFilter(filter);

      const results = await store.search([1, 2, 3], {}, 10);
      expect(results.map((r) => r.id)).not.toContain("p5");
      expect(results.map((r) => r.id)).toContain("p6");
    });

    it("should delete by subject", async () => {
      const filter: SearchFilter = { subject: "DEUTSCH" };
      await store.deleteByFilter(filter);

      const results = await store.search([1, 2, 3], {}, 10);
      expect(results.map((r) => r.id)).toEqual(["p3"]);
    });

    it("should handle delete with empty filter (no-op behavior)", async () => {
      const filter: SearchFilter = {};
      await store.deleteByFilter(filter);

      // Should delete all points when filter is empty (must_all logic)
      const results = await store.search([1, 2, 3], {}, 10);
      expect(results).toHaveLength(0);
    });
  });

  // #41 — gezielte Löschung nur bestimmter Punkt-IDs (Kompensation eines Laufs)
  describe("deletePoints", () => {
    beforeEach(async () => {
      // Zwei Punkte derselben source_id: p_old (früherer Lauf) + p_new (dieser Lauf)
      await store.upsertPoints([
        {
          id: "p_old",
          vector: [1, 2, 3],
          payload: { source_id: "srcX", trust_level: "OFFICIAL_BINDING" },
        },
        {
          id: "p_new",
          vector: [1, 2, 3],
          payload: { source_id: "srcX", trust_level: "OFFICIAL_BINDING" },
        },
      ]);
    });

    it("löscht NUR die angegebenen IDs; Reste derselben source_id bleiben erhalten", async () => {
      await store.deletePoints(["p_new"]);

      const results = await store.search([1, 2, 3], {}, 10);
      const ids = results.map((r) => r.id);
      expect(ids).toContain("p_old"); // früherer Lauf bleibt unberührt
      expect(ids).not.toContain("p_new"); // nur dieser Lauf wird zurückgerollt
    });

    it("unterscheidet sich von deleteByFilter({sourceId}), das ALLE Punkte der source_id löscht", async () => {
      await store.deleteByFilter({ sourceId: "srcX" });

      const results = await store.search([1, 2, 3], {}, 10);
      expect(results).toHaveLength(0); // breite Löschung trifft beide
    });

    it("ist ein No-op bei leerer ID-Liste", async () => {
      await store.deletePoints([]);
      const results = await store.search([1, 2, 3], {}, 10);
      expect(results).toHaveLength(2);
    });
  });

  describe("search result format", () => {
    beforeEach(async () => {
      const points: VectorPoint[] = [
        {
          id: "test-id",
          vector: [1, 2, 3],
          payload: {
            trust_level: "OFFICIAL_BINDING",
            custom_field: "custom_value",
          },
        },
      ];
      await store.upsertPoints(points);
    });

    it("should return results with id, score, and payload", async () => {
      const results = await store.search([1, 2, 3], {}, 10);

      expect(results).toHaveLength(1);
      const result = results[0];
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("score");
      expect(result).toHaveProperty("payload");
    });

    it("should return deterministic score of 1", async () => {
      const results = await store.search([1, 2, 3], {}, 10);

      expect(results[0].score).toBe(1);
    });

    it("should preserve payload structure", async () => {
      const results = await store.search([1, 2, 3], {}, 10);

      expect(results[0].payload.trust_level).toBe("OFFICIAL_BINDING");
      expect(results[0].payload.custom_field).toBe("custom_value");
    });
  });

  describe("ensureCollection", () => {
    it("should be a no-op for FakeVectorStore", async () => {
      const store2 = new FakeVectorStore();
      await expect(store2.ensureCollection()).resolves.not.toThrow();
    });
  });
});

// QdrantStore contract tests — only run if QDRANT_TEST==="1"
describe.skipIf(process.env.QDRANT_TEST !== "1")("QdrantStore (contract tests)", () => {
  // Contract tests for real Qdrant instance would go here
  // Requires QDRANT_TEST environment variable to be set to "1"
  // Tests would verify HTTP endpoint availability and API contract
  it("placeholder: QdrantStore contract tests skipped by default", () => {
    expect(process.env.QDRANT_TEST).not.toBe("1");
  });
});
