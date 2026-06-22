import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { curriculumStrand } from "@/lib/db/schema/curriculum";

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client);

afterAll(async () => {
  await client.end();
});

describe("Konfessions-CHECK am curriculum_strand", () => {
  it("lehnt 'katholischen Deutschunterricht' ab", async () => {
    await expect(
      db.insert(curriculumStrand).values({
        subject: "DEUTSCH",
        confessionContext: "KATHOLISCH",
        schoolStage: "SEK_I",
        frameworkAuthority: "Test",
        validFrom: "2024-08-01",
        version: "1.0.0",
      }),
    ).rejects.toThrow();
  });

  it("akzeptiert evangelische Religion", async () => {
    const [row] = await db
      .insert(curriculumStrand)
      .values({
        subject: "RELIGION",
        confessionContext: "EVANGELISCH",
        schoolStage: "SEK_I",
        schoolForm: "GESAMTSCHULE",
        educationTrack: "GYMNASIALER_BILDUNGSGANG",
        frameworkAuthority: "Kultusministerium LSA",
        validFrom: "2019-08-01",
        version: "1.0.0",
      })
      .returning();
    expect(row.subject).toBe("RELIGION");
  });

  it("lehnt Schulform bei Sek II ab", async () => {
    await expect(
      db.insert(curriculumStrand).values({
        subject: "DEUTSCH",
        confessionContext: "NICHT_ANWENDBAR",
        schoolStage: "SEK_II",
        schoolForm: "GESAMTSCHULE",
        frameworkAuthority: "Test",
        validFrom: "2024-08-01",
        version: "1.0.0",
      }),
    ).rejects.toThrow();
  });
});
