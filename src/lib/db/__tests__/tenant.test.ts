import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@/lib/db/schema";
import { user } from "@/lib/db/schema/auth";
import { school, teacherProfile } from "@/lib/db/schema/tenant";

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client, { schema });

afterAll(async () => {
  await client.end();
});

describe("teacher_profile.user_id ist UNIQUE", () => {
  it("verhindert zwei teacher_profiles für denselben user", async () => {
    // Seed: user + school (file-unique IDs to avoid cross-test collisions)
    const userId = "t-tenant-unique-user";
    const schoolName = "Tenant-Test-Schule";

    await db
      .insert(user)
      .values({ id: userId, name: "Tenant User", email: "tenant-unique@example.org" })
      .onConflictDoNothing();

    const [seedSchool] = await db
      .insert(school)
      .values({ name: schoolName })
      .returning();

    // First profile: must succeed
    await db.insert(teacherProfile).values({
      userId,
      schoolId: seedSchool.id,
      displayName: "Erster Profil",
    });

    // Second profile with same userId: must fail (UNIQUE constraint on user_id)
    await expect(
      db.insert(teacherProfile).values({
        userId,
        schoolId: seedSchool.id,
        displayName: "Zweiter Profil",
      }),
    ).rejects.toThrow();
  });
});
