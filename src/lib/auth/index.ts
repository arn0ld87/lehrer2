import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { teacherProfile } from "@/lib/db/schema/tenant";

export interface CurrentTeacher {
  userId: string;
  schoolId: string;
  role: "LEHRKRAFT" | "ADMIN";
  displayName: string;
}

/** Lädt das Teacher-Profil zu einem authentifizierten User. Null, wenn keins existiert. */
export async function getCurrentTeacher(userId: string): Promise<CurrentTeacher | null> {
  const [row] = await db
    .select()
    .from(teacherProfile)
    .where(eq(teacherProfile.userId, userId))
    .limit(1);
  if (!row) return null;
  return { userId: row.userId, schoolId: row.schoolId, role: row.role, displayName: row.displayName };
}

export function requireRole(teacher: CurrentTeacher, role: CurrentTeacher["role"]): void {
  if (teacher.role !== role && teacher.role !== "ADMIN") {
    throw new Error(`Rolle ${role} erforderlich`);
  }
}
