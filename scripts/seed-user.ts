/**
 * scripts/seed-user.ts
 *
 * Legt den Dev-Seed-User Jana Zwarg an (idempotent).
 * NUR für lokale Entwicklung / Staging – KEIN echtes Passwort einchecken.
 *
 * Passwort: process.env.SEED_USER_PASSWORD (Fallback: 'dev-change-me-2026!' – DEV ONLY)
 *
 * Ablauf:
 *  1. School anlegen falls noch nicht vorhanden (Lookup via Name).
 *  2. User via better-auth Server-API anlegen (Passwort-Hashing übernimmt better-auth).
 *     Existiert der User bereits → User-Schritt überspringen.
 *  3. teacherProfile sicherstellen (userId + schoolId + role + displayName).
 */

// .env laden, BEVOR src/lib/db/client.ts process.env.DATABASE_URL beim Import liest
import "dotenv/config";
import { db } from "../src/lib/db/client";
import { auth } from "../src/lib/auth/auth";
import { school, teacherProfile } from "../src/lib/db/schema/tenant";
import { user as userTable } from "../src/lib/db/schema/auth";
import { eq } from "drizzle-orm";

const SEED_EMAIL = "jana.zwarg@example-schule.de";
const SEED_NAME = "Jana Zwarg";
const SEED_SCHOOL_NAME = "Gemeinschaftsschule Musterstadt";

/**
 * Passwort aus Umgebungsvariable; Fallback nur für DEV, niemals produktiv nutzen.
 */
function getSeedPassword(): string {
  return process.env.SEED_USER_PASSWORD ?? "dev-change-me-2026!";
}

export interface SeedUserResult {
  userId: string;
  schoolId: string;
  teacherProfileId: string;
  userCreated: boolean;
  schoolCreated: boolean;
  teacherProfileCreated: boolean;
}

export async function seedUser(seedDb = db): Promise<SeedUserResult> {
  console.log("🌱 Starting user seed...");

  // ── 1. School ──────────────────────────────────────────────────────────────
  let schoolId: string;
  let schoolCreated = false;

  const existingSchools = await seedDb
    .select()
    .from(school)
    .where(eq(school.name, SEED_SCHOOL_NAME))
    .limit(1);

  if (existingSchools.length > 0) {
    schoolId = existingSchools[0].id;
    console.log(`⏭️  School already exists: ${SEED_SCHOOL_NAME} (${schoolId})`);
  } else {
    const [inserted] = await seedDb
      .insert(school)
      .values({ name: SEED_SCHOOL_NAME })
      .returning({ id: school.id });
    schoolId = inserted.id;
    schoolCreated = true;
    console.log(`✅ School created: ${SEED_SCHOOL_NAME} (${schoolId})`);
  }

  // ── 2. User via better-auth Server-API ────────────────────────────────────
  let userId: string;
  let userCreated = false;

  const existingUsers = await seedDb
    .select()
    .from(userTable)
    .where(eq(userTable.email, SEED_EMAIL))
    .limit(1);

  if (existingUsers.length > 0) {
    userId = existingUsers[0].id;
    console.log(`⏭️  User already exists: ${SEED_EMAIL} (${userId})`);
  } else {
    // Passwort-Hashing obliegt better-auth – kein manuelles Hashen.
    const response = await auth.api.signUpEmail({
      body: {
        name: SEED_NAME,
        email: SEED_EMAIL,
        password: getSeedPassword(),
      },
    });

    if (!response?.user?.id) {
      throw new Error(
        `better-auth signUpEmail returned unexpected response: ${JSON.stringify(response)}`,
      );
    }

    userId = response.user.id;
    userCreated = true;
    // Passwort wird nie geloggt.
    console.log(`✅ User created via better-auth: ${SEED_EMAIL} (${userId})`);
  }

  // ── 3. teacherProfile sicherstellen ──────────────────────────────────────
  let teacherProfileId: string;
  let teacherProfileCreated = false;

  const existingProfiles = await seedDb
    .select()
    .from(teacherProfile)
    .where(eq(teacherProfile.userId, userId))
    .limit(1);

  if (existingProfiles.length > 0) {
    teacherProfileId = existingProfiles[0].id;
    console.log(`⏭️  teacherProfile already exists (${teacherProfileId})`);
  } else {
    const [inserted] = await seedDb
      .insert(teacherProfile)
      .values({
        userId,
        schoolId,
        role: "LEHRKRAFT",
        displayName: SEED_NAME,
      })
      .returning({ id: teacherProfile.id });

    teacherProfileId = inserted.id;
    teacherProfileCreated = true;
    console.log(`✅ teacherProfile created (${teacherProfileId})`);
  }

  console.log(
    `\n✨ User seed complete: school=${schoolCreated ? "created" : "existing"}, ` +
      `user=${userCreated ? "created" : "existing"}, ` +
      `teacherProfile=${teacherProfileCreated ? "created" : "existing"}`,
  );

  return { userId, schoolId, teacherProfileId, userCreated, schoolCreated, teacherProfileCreated };
}

// CLI entry point – analog zu seed-sources.ts
seedUser()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error("❌ User seed failed:", error);
    process.exit(1);
  });
