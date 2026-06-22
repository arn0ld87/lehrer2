import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db/client";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  // Single-tenant MVP: keine Organization-Plugins aktiv, aber Schema org-ready (school/teacher_profile).
});

export type Session = typeof auth.$Infer.Session;
