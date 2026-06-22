import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { ragChunk } from "@/lib/db/schema/rag";
import { sourceRef } from "@/lib/db/schema/artifacts";

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client);

afterAll(async () => {
  await client.end();
});

describe("rag_chunk table constraints", () => {
  it("inserts a valid rag_chunk with sourceRef reference", async () => {
    // Create a unique sourceRef first (needed due to FK constraint)
    const uniqueTitle = `Source-${Date.now()}-${Math.random()}`;
    const [sourceRow] = await db
      .insert(sourceRef)
      .values({
        title: uniqueTitle,
        sourceType: "OFFICIAL_BINDING",
        contentHash: `hash-${Date.now()}-${Math.random()}`,
        uri: `https://example.com/${Date.now()}`,
      })
      .returning();

    // Insert a valid rag_chunk
    const uniqueContentHash = `chunk-hash-${Date.now()}-${Math.random()}`;
    const [chunk] = await db
      .insert(ragChunk)
      .values({
        sourceRefId: sourceRow.id,
        chunkText: "This is a valid chunk with at least fifty characters of content.",
        pageOrSection: "Page 1, Section A",
        sourceVersion: 1,
        contentHash: uniqueContentHash,
        trustLevel: "OFFICIAL_BINDING",
        subject: "DEUTSCH",
        confessionContext: "NICHT_ANWENDBAR",
      })
      .returning();

    expect(chunk.id).toBeDefined();
    expect(chunk.sourceRefId).toBe(sourceRow.id);
    expect(chunk.chunkText).toBe("This is a valid chunk with at least fifty characters of content.");
    expect(chunk.contentHash).toBe(uniqueContentHash);
    expect(chunk.sourceVersion).toBe(1);
    expect(chunk.trustLevel).toBe("OFFICIAL_BINDING");
  });

  it("rejects duplicate (sourceRefId, contentHash, sourceVersion) combination", async () => {
    // Create a sourceRef for this test case
    const uniqueTitle = `Source-unique-${Date.now()}-${Math.random()}`;
    const [sourceRow] = await db
      .insert(sourceRef)
      .values({
        title: uniqueTitle,
        sourceType: "OFFICIAL_BINDING",
        contentHash: `hash-dup-${Date.now()}-${Math.random()}`,
        uri: `https://example.com/${Date.now()}`,
      })
      .returning();

    const sharedContentHash = `chunk-hash-shared-${Date.now()}-${Math.random()}`;

    // Insert first chunk
    await db
      .insert(ragChunk)
      .values({
        sourceRefId: sourceRow.id,
        chunkText: "First chunk with at least fifty characters minimum length requirement.",
        pageOrSection: "Page 1",
        sourceVersion: 1,
        contentHash: sharedContentHash,
        trustLevel: "OFFICIAL_BINDING",
      })
      .returning();

    // Attempt to insert duplicate (same sourceRefId, contentHash, sourceVersion)
    await expect(
      db
        .insert(ragChunk)
        .values({
          sourceRefId: sourceRow.id,
          chunkText: "Second chunk with completely different text content here.",
          pageOrSection: "Page 2",
          sourceVersion: 1, // Same version as first chunk
          contentHash: sharedContentHash, // Same hash
          trustLevel: "OFFICIAL_BINDING",
        })
        .returning(),
    ).rejects.toThrow();
  });

  it("rejects chunkText shorter than 50 characters", async () => {
    // Create a sourceRef for this test
    const uniqueTitle = `Source-short-${Date.now()}-${Math.random()}`;
    const [sourceRow] = await db
      .insert(sourceRef)
      .values({
        title: uniqueTitle,
        sourceType: "OFFICIAL_BINDING",
        contentHash: `hash-short-${Date.now()}-${Math.random()}`,
        uri: `https://example.com/${Date.now()}`,
      })
      .returning();

    // Attempt to insert chunk with text < 50 chars
    await expect(
      db
        .insert(ragChunk)
        .values({
          sourceRefId: sourceRow.id,
          chunkText: "Too short", // Only 9 characters
          pageOrSection: "Page 1",
          sourceVersion: 1,
          contentHash: `chunk-hash-short-${Date.now()}`,
          trustLevel: "OFFICIAL_BINDING",
        })
        .returning(),
    ).rejects.toThrow();
  });

  it("allows different sourceVersion for same sourceRefId and contentHash", async () => {
    // Create a sourceRef for versioning test
    const uniqueTitle = `Source-versioned-${Date.now()}-${Math.random()}`;
    const [sourceRow] = await db
      .insert(sourceRef)
      .values({
        title: uniqueTitle,
        sourceType: "OFFICIAL_BINDING",
        contentHash: `hash-versioned-${Date.now()}-${Math.random()}`,
        uri: `https://example.com/${Date.now()}`,
      })
      .returning();

    const sharedContentHash = `chunk-hash-version-${Date.now()}-${Math.random()}`;

    // Insert version 1
    const [chunk1] = await db
      .insert(ragChunk)
      .values({
        sourceRefId: sourceRow.id,
        chunkText: "Version one of the chunk with sufficient character length here now.",
        pageOrSection: "Page 1",
        sourceVersion: 1,
        contentHash: sharedContentHash,
        trustLevel: "OFFICIAL_BINDING",
      })
      .returning();

    // Insert version 2 with same sourceRefId and contentHash but different sourceVersion
    const [chunk2] = await db
      .insert(ragChunk)
      .values({
        sourceRefId: sourceRow.id,
        chunkText: "Version two of the chunk with different text content now included.",
        pageOrSection: "Page 1",
        sourceVersion: 2, // Different version
        contentHash: sharedContentHash, // Same hash
        trustLevel: "OFFICIAL_BINDING",
      })
      .returning();

    expect(chunk1.id).not.toBe(chunk2.id);
    expect(chunk1.sourceVersion).toBe(1);
    expect(chunk2.sourceVersion).toBe(2);
  });
});
