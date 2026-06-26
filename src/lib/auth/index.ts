import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { teacherProfile } from "@/lib/db/schema/tenant";
import { auth } from "./auth";

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

/**
 * Aktiver Lehrer-Kontext für Server-Actions.
 *
 * Login ist auf Maintainer-Entscheidung deaktiviert (Abweichung von ADR 0007):
 * mit gültiger Session wird deren Profil verwendet, ohne Session fällt der
 * single-tenant-Betrieb auf das erste/einzige Teacher-Profil zurück. So laufen
 * Generierung/Export ohne Login, der Ownership-Kontext (userId/schoolId) bleibt erhalten.
 */
export async function getActiveTeacher(): Promise<CurrentTeacher | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.id) {
      const t = await getCurrentTeacher(session.user.id);
      if (t) return t;
    }
  } catch {
    // Session-Read fehlgeschlagen → Fallback unten
  }
  const [row] = await db.select().from(teacherProfile).limit(1);
  if (!row) return null;
  return { userId: row.userId, schoolId: row.schoolId, role: row.role, displayName: row.displayName };
}

export function requireRole(teacher: CurrentTeacher, role: CurrentTeacher["role"]): void {
  if (teacher.role !== role && teacher.role !== "ADMIN") {
    throw new Error(`Rolle ${role} erforderlich`);
  }
}
