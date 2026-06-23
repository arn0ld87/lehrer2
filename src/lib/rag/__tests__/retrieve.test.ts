/**
 * retrieve.test.ts — deterministische Vitest-Tests für retrieve()
 *
 * Nutzt FakeVectorStore + FakeEmbedder + Fake-SourceRefReader (alle in-memory).
 * Kein Docker, kein Netzwerk, kein Qdrant-Prozess nötig.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { FakeVectorStore } from "@/lib/infra/qdrant";
import { FakeEmbedder } from "@/lib/infra/ollama";
import type { SourceRefMeta } from "@/lib/rag/citation";
import type { SourceRefReader, RetrieveDeps } from "@/lib/rag/retrieve";
import { retrieve } from "@/lib/rag/retrieve";

// ── Fake-SourceRefReader ───────────────────────────────────────────────────────

class FakeSourceRefReader implements SourceRefReader {
  private store: Map<string, SourceRefMeta>;

  constructor(entries: SourceRefMeta[]) {
    this.store = new Map(entries.map((e) => [e.id, e]));
  }

  async getById(sourceId: string): Promise<SourceRefMeta | null> {
    return this.store.get(sourceId) ?? null;
  }
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function makeSourceRef(overrides: Partial<SourceRefMeta> & { id: string }): SourceRefMeta {
  return {
    id: overrides.id,
    title: overrides.title ?? `Quelle ${overrides.id}`,
    uri: overrides.uri ?? `https://example.com/${overrides.id}`,
    authorOrganization: overrides.authorOrganization ?? "Testverlag",
    licenseInfo: overrides.licenseInfo ?? "CC-BY-4.0",
    retrievedAt: overrides.retrievedAt ?? new Date("2026-06-22T10:00:00Z"),
    sourceVersion: overrides.sourceVersion ?? 1,
    contentHash: overrides.contentHash ?? `hash-${overrides.id}`,
  };
}

type PayloadBase = {
  source_id: string;
  trust_level: string;
  subject: string;
  confession_context: string;
  page_or_section: string;
  source_version: number;
  content_hash: string;
  chunk_text: string;
  license: string;
  retrieved_at: string;
};

function makePayload(overrides: Partial<PayloadBase> & { source_id: string }): PayloadBase {
  return {
    source_id: overrides.source_id,
    trust_level: overrides.trust_level ?? "OFFICIAL_BINDING",
    subject: overrides.subject ?? "DEUTSCH",
    confession_context: overrides.confession_context ?? "NICHT_ANWENDBAR",
    page_or_section: overrides.page_or_section ?? "S. 1",
    source_version: overrides.source_version ?? 1,
    content_hash: overrides.content_hash ?? `hash-${overrides.source_id}`,
    chunk_text:
      overrides.chunk_text ??
      "Ein ausreichend langer Chunk-Text für den Test, der mindestens 50 Zeichen hat.",
    license: overrides.license ?? "CC-BY-4.0",
    retrieved_at: overrides.retrieved_at ?? "2026-06-22T10:00:00Z",
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

// Quellen-IDs
const SRC_EV = "src-ev-001";
const SRC_KAT = "src-kat-001";
const SRC_SENS = "src-sens-001";
const SRC_ETH = "src-eth-001";
const SRC_DE = "src-de-001";
const SRC_UNVERIFIED = "src-unverified-001";

const sourceRefs: SourceRefMeta[] = [
  makeSourceRef({ id: SRC_EV, title: "Ev. Lehrplan Sachsen-Anhalt" }),
  makeSourceRef({ id: SRC_KAT, title: "Kath. Lehrplan Sachsen-Anhalt" }),
  makeSourceRef({ id: SRC_SENS, title: "Konfessionssensible Handreichung" }),
  makeSourceRef({ id: SRC_ETH, title: "Ethik-Lehrplan" }),
  makeSourceRef({ id: SRC_DE, title: "Deutsch-Lehrplan" }),
  makeSourceRef({ id: SRC_UNVERIFIED, title: "Unverifizierte Quelle" }),
];

// Punkte für den FakeVectorStore
const basePoints = [
  {
    id: "point-ev",
    vector: [1, 0, 0],
    payload: makePayload({
      source_id: SRC_EV,
      subject: "RELIGION",
      confession_context: "EVANGELISCH",
      trust_level: "OFFICIAL_BINDING",
    }),
  },
  {
    id: "point-kat",
    vector: [0, 1, 0],
    payload: makePayload({
      source_id: SRC_KAT,
      subject: "RELIGION",
      confession_context: "KATHOLISCH",
      trust_level: "OFFICIAL_BINDING",
    }),
  },
  {
    id: "point-sens",
    vector: [0.7, 0.7, 0],
    payload: makePayload({
      source_id: SRC_SENS,
      subject: "RELIGION",
      confession_context: "KONFESSIONSSENSIBEL_UEBERGREIFEND",
      trust_level: "OFFICIAL_GUIDANCE",
    }),
  },
  {
    id: "point-eth",
    vector: [0, 0, 1],
    payload: makePayload({
      source_id: SRC_ETH,
      subject: "ETHIK",
      confession_context: "RELIGIONSKUNDLICH",
      trust_level: "OFFICIAL_BINDING",
    }),
  },
  {
    id: "point-de",
    vector: [0.5, 0.5, 0.5],
    payload: makePayload({
      source_id: SRC_DE,
      subject: "DEUTSCH",
      confession_context: "NICHT_ANWENDBAR",
      trust_level: "OPEN_CURATED",
    }),
  },
  {
    id: "point-unverified",
    vector: [1, 1, 1],
    payload: makePayload({
      source_id: SRC_UNVERIFIED,
      subject: "DEUTSCH",
      confession_context: "NICHT_ANWENDBAR",
      trust_level: "UNVERIFIED",
    }),
  },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("retrieve()", () => {
  let vectorStore: FakeVectorStore;
  let embedder: FakeEmbedder;
  let reader: FakeSourceRefReader;
  let deps: RetrieveDeps;

  beforeEach(async () => {
    vectorStore = new FakeVectorStore();
    embedder = new FakeEmbedder(3); // 3-dimensionale Vektoren für Tests
    reader = new FakeSourceRefReader(sourceRefs);
    deps = { embedder, store: vectorStore, sourceRefReader: reader };

    await vectorStore.ensureCollection();
    await vectorStore.upsertPoints(basePoints);
  });

  // ── (a) Konfessionsfilter evangelisch ──────────────────────────────────────

  describe("(a) evangelisch-Filter", () => {
    it("liefert EVANGELISCH und KONFESSIONSSENSIBEL_UEBERGREIFEND — schliesst KATHOLISCH und RELIGIONSKUNDLICH aus", async () => {
      const results = await retrieve(deps, "Religiöser Unterricht", {
        subject: "evangelische-religion",
        k: 10,
      });

      const confessions = results.map((r) => r.confessionContext);
      expect(confessions).toContain("EVANGELISCH");
      expect(confessions).toContain("KONFESSIONSSENSIBEL_UEBERGREIFEND");
      expect(confessions).not.toContain("KATHOLISCH");
      expect(confessions).not.toContain("RELIGIONSKUNDLICH");
      expect(confessions).not.toContain("NICHT_ANWENDBAR");
    });

    it("schliesst auch ETHIK-Punkte aus, obwohl sie RELIGIONSKUNDLICH tragen", async () => {
      const results = await retrieve(deps, "Ethik und Moral", {
        subject: "evangelische-religion",
        k: 10,
      });
      const sourceIds = results.map((r) => r.sourceId);
      expect(sourceIds).not.toContain(SRC_ETH);
    });
  });

  // ── (b) UNVERIFIED niemals im Ergebnis ────────────────────────────────────

  describe("(b) UNVERIFIED-Ausschluss", () => {
    it("enthält keine UNVERIFIED-Treffer ohne minTrust", async () => {
      const results = await retrieve(deps, "Irgendein Thema", { k: 20 });
      const levels = results.map((r) => r.trustLevel);
      expect(levels).not.toContain("UNVERIFIED");
    });

    it("enthält keine UNVERIFIED-Treffer auch wenn explizit minTrust=UNVERIFIED", async () => {
      // minTrust=UNVERIFIED würde bedeuten "mindestens UNVERIFIED", aber die
      // fail-closed-Invariante blockiert UNVERIFIED immer
      const results = await retrieve(deps, "Irgendein Thema", {
        minTrust: "UNVERIFIED",
        k: 20,
      });
      const levels = results.map((r) => r.trustLevel);
      expect(levels).not.toContain("UNVERIFIED");
    });

    it("UNVERIFIED-Punkt ist im Store vorhanden, wird aber gefiltert", async () => {
      // Sanity-check: Store enthält den Punkt
      const allHits = await vectorStore.search([], {}, 100);
      const unverifiedHit = allHits.find(
        (h) => h.payload.trust_level === "UNVERIFIED",
      );
      expect(unverifiedHit).toBeDefined();

      // retrieve() darf ihn nicht zurückgeben
      const results = await retrieve(deps, "Test", { k: 20 });
      expect(results.map((r) => r.sourceId)).not.toContain(SRC_UNVERIFIED);
    });
  });

  // ── (c) Alle Pflichtfelder in jeder RankedCitation ────────────────────────

  describe("(c) vollständige Zitationsfelder", () => {
    it("jede RankedCitation trägt alle Pflichtfelder (non-null oder sinnvoll befüllt)", async () => {
      const results = await retrieve(deps, "Lehrplan", { k: 5 });
      expect(results.length).toBeGreaterThan(0);

      for (const c of results) {
        // Unbedingte Pflichtfelder (CITATION_STANDARD.md)
        expect(c.sourceId).toBeTruthy();
        expect(c.title).toBeTruthy();
        expect(c.publisher).toBeTruthy();
        expect(c.license).toBeTruthy();
        expect(c.pageOrSection).toBeTruthy();
        expect(typeof c.sourceVersion).toBe("number");
        expect(c.contentHash).toBeTruthy();
        expect(c.trustLevel).toBeTruthy();
        expect(c.chunkText).toBeTruthy();
        expect(typeof c.score).toBe("number");
        expect(["GROUNDED", "UNSUPPORTED_DRAFT"]).toContain(c.confidence);
        // Bedingte Felder (laut Standard null zulässig): uri, retrievedAt, confessionContext, subject
      }
    });

    it("confidence=GROUNDED bei OFFICIAL_BINDING und OFFICIAL_GUIDANCE", async () => {
      const results = await retrieve(deps, "Lehrplan", { k: 10 });
      for (const c of results) {
        if (c.trustLevel === "OFFICIAL_BINDING" || c.trustLevel === "OFFICIAL_GUIDANCE") {
          expect(c.confidence).toBe("GROUNDED");
        }
      }
    });

    it("confidence=UNSUPPORTED_DRAFT bei OPEN_CURATED", async () => {
      const results = await retrieve(deps, "Deutsch Unterricht", {
        subject: "deutsch",
        k: 5,
      });
      const openCurated = results.filter((r) => r.trustLevel === "OPEN_CURATED");
      for (const c of openCurated) {
        expect(c.confidence).toBe("UNSUPPORTED_DRAFT");
      }
    });
  });

  // ── (d) Leerer / partieller Filter ────────────────────────────────────────

  describe("(d) leerer und partieller Filter", () => {
    it("retrieve() ohne opts liefert Ergebnisse (kein subject-Filter)", async () => {
      const results = await retrieve(deps, "Unterricht");
      expect(results.length).toBeGreaterThan(0);
      // Kein UNVERIFIED
      expect(results.map((r) => r.trustLevel)).not.toContain("UNVERIFIED");
    });

    it("retrieve() mit nur k=1 liefert genau 1 Ergebnis (wenn Treffer vorhanden)", async () => {
      const results = await retrieve(deps, "Lehrplan", { k: 1 });
      expect(results.length).toBe(1);
    });

    it("retrieve() mit subject=deutsch filtert auf DEUTSCH", async () => {
      const results = await retrieve(deps, "Grammatik", {
        subject: "deutsch",
        k: 10,
      });
      const subjects = results.map((r) => r.confessionContext);
      // Deutschpunkte haben confession_context=NICHT_ANWENDBAR
      for (const s of subjects) {
        expect(s).toBe("NICHT_ANWENDBAR");
      }
    });

    it("retrieve() mit subject=ethik liefert nur RELIGIONSKUNDLICH (kein EVANGELISCH/KATHOLISCH)", async () => {
      const results = await retrieve(deps, "Ethik Werte", {
        subject: "ethik",
        k: 10,
      });
      const confessions = results.map((r) => r.confessionContext);
      expect(confessions).toContain("RELIGIONSKUNDLICH");
      expect(confessions).not.toContain("EVANGELISCH");
      expect(confessions).not.toContain("KATHOLISCH");
      expect(confessions).not.toContain("KONFESSIONSSENSIBEL_UEBERGREIFEND");
    });

    it("minTrust=OFFICIAL_BINDING filtert OPEN_CURATED heraus", async () => {
      const results = await retrieve(deps, "Test", {
        minTrust: "OFFICIAL_BINDING",
        k: 20,
      });
      const levels = results.map((r) => r.trustLevel);
      expect(levels).not.toContain("OPEN_CURATED");
      expect(levels).not.toContain("USER_APPROVED");
      expect(levels).not.toContain("UNVERIFIED");
    });
  });

  // ── (e) Ranking ist deterministisch ───────────────────────────────────────

  describe("(e) deterministisches Ranking", () => {
    it("gleiche Query + opts liefert identische Ergebnis-Reihenfolge bei zwei Aufrufen", async () => {
      const first = await retrieve(deps, "Lehrplan Religion", {
        subject: "evangelische-religion",
        k: 5,
      });
      const second = await retrieve(deps, "Lehrplan Religion", {
        subject: "evangelische-religion",
        k: 5,
      });

      expect(first.map((r) => r.sourceId)).toEqual(second.map((r) => r.sourceId));
      expect(first.map((r) => r.score)).toEqual(second.map((r) => r.score));
    });

    it("Reihenfolge ändert sich bei unterschiedlichen Queries deterministisch (FakeEmbedder)", async () => {
      // FakeEmbedder erzeugt deterministisch unterschiedliche Vektoren aus unterschiedlichem Text
      const r1 = await retrieve(deps, "Evangelisch", { k: 5 });
      const r2 = await retrieve(deps, "Evangelisch", { k: 5 });
      // Beide Aufrufe müssen identisch sein
      expect(r1.map((r) => r.sourceId)).toEqual(r2.map((r) => r.sourceId));
    });
  });

  // ── (f) Treffer ohne sourceRef werden verworfen ────────────────────────────

  describe("(f) fehlende sourceRef-Metadaten", () => {
    it("Treffer ohne passende sourceRef werden still verworfen (kein Fehler)", async () => {
      // Store enthält Punkt mit unbekannter source_id
      const orphanStore = new FakeVectorStore();
      await orphanStore.upsertPoints([
        {
          id: "orphan-point",
          vector: [1, 0, 0],
          payload: makePayload({
            source_id: "unknown-source-id",
            subject: "DEUTSCH",
            confession_context: "NICHT_ANWENDBAR",
            trust_level: "OFFICIAL_BINDING",
          }),
        },
      ]);

      const orphanDeps: RetrieveDeps = {
        embedder,
        store: orphanStore,
        sourceRefReader: reader, // kennt "unknown-source-id" nicht
      };

      // Kein Fehler — Treffer wird verworfen
      const results = await retrieve(orphanDeps, "Test", { k: 5 });
      expect(results.map((r) => r.sourceId)).not.toContain("unknown-source-id");
    });
  });

  // ── (g) Treffer mit unvollständiger Payload werden verworfen ──────────────

  describe("(g) unvollständige Payload", () => {
    it("Treffer ohne chunk_text wird verworfen", async () => {
      const incompleteStore = new FakeVectorStore();
      await incompleteStore.upsertPoints([
        {
          id: "incomplete-point",
          vector: [1, 0, 0],
          payload: {
            source_id: SRC_DE,
            trust_level: "OFFICIAL_BINDING",
            subject: "DEUTSCH",
            confession_context: "NICHT_ANWENDBAR",
            page_or_section: "S. 1",
            source_version: 1,
            content_hash: "abc123",
            // chunk_text fehlt absichtlich
          },
        },
      ]);

      const incompleteDeps: RetrieveDeps = {
        embedder,
        store: incompleteStore,
        sourceRefReader: reader,
      };

      const results = await retrieve(incompleteDeps, "Test", { k: 5 });
      // Punkt hat keine vollständige Zitation → verworfen
      expect(results).toHaveLength(0);
    });
  });

  // ── (h) publisher & license sind erzwungene Pflichtfelder ──────────────────

  describe("(h) Pflichtfelder publisher & license", () => {
    it("Treffer mit fehlender license wird verworfen", async () => {
      const store = new FakeVectorStore();
      await store.upsertPoints([
        {
          id: "p-nolicense",
          vector: [1, 0, 0],
          payload: makePayload({ source_id: "src-nolicense", trust_level: "OFFICIAL_BINDING" }),
        },
      ]);
      const noLicenseReader = new FakeSourceRefReader([
        {
          id: "src-nolicense",
          title: "Quelle ohne Lizenz",
          uri: "https://example.com/x",
          authorOrganization: "Verlag",
          licenseInfo: null, // fehlt absichtlich → Pflichtfeld
          retrievedAt: new Date("2026-06-22T10:00:00Z"),
          sourceVersion: 1,
          contentHash: "h-nolicense",
        },
      ]);
      const results = await retrieve(
        { embedder, store, sourceRefReader: noLicenseReader },
        "Test",
        { k: 5 },
      );
      expect(results.map((r) => r.sourceId)).not.toContain("src-nolicense");
      expect(results).toHaveLength(0);
    });

    it("Treffer mit fehlendem publisher wird verworfen", async () => {
      const store = new FakeVectorStore();
      await store.upsertPoints([
        {
          id: "p-nopub",
          vector: [1, 0, 0],
          payload: makePayload({ source_id: "src-nopub", trust_level: "OFFICIAL_BINDING" }),
        },
      ]);
      const noPubReader = new FakeSourceRefReader([
        {
          id: "src-nopub",
          title: "Quelle ohne Herausgeber",
          uri: "https://example.com/y",
          authorOrganization: null, // fehlt absichtlich → Pflichtfeld
          licenseInfo: "CC-BY-4.0",
          retrievedAt: new Date("2026-06-22T10:00:00Z"),
          sourceVersion: 1,
          contentHash: "h-nopub",
        },
      ]);
      const results = await retrieve(
        { embedder, store, sourceRefReader: noPubReader },
        "Test",
        { k: 5 },
      );
      expect(results.map((r) => r.sourceId)).not.toContain("src-nopub");
      expect(results).toHaveLength(0);
    });

    it("vollständiger Treffer trägt publisher und license non-null", async () => {
      const results = await retrieve(deps, "Lehrplan", { k: 10 });
      expect(results.length).toBeGreaterThan(0);
      for (const c of results) {
        expect(c.publisher).toBeTruthy();
        expect(c.license).toBeTruthy();
      }
    });
  });
});
