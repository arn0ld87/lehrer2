import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

/** Schule = Mandant. MVP single-tenant, aber als Tabelle vorhanden (org-ready, ADR 0007). */
export const school = pgTable("school", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Verknüpft Better-Auth-User mit Schule + Rolle. */
export const teacherProfile = pgTable("teacher_profile", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => school.id, { onDelete: "restrict" }),
  role: text("role", { enum: ["LEHRKRAFT", "ADMIN"] }).notNull().default("LEHRKRAFT"),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
