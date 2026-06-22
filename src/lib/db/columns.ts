import { integer, timestamp } from "drizzle-orm/pg-core";
import { dataClassEnum } from "./enums";

/**
 * Konventionelle Felder aller Unterrichtsartefakte (DATA_MODEL.md §Unterrichtsartefakte):
 * Soft-Delete + Optimistic-Lock-Version + Audit-Timestamps.
 * `ownerTeacherId` wird je Tabelle gesetzt (FK → user.id, Task 2).
 */
export const artifactTimestamps = {
  dataClass: dataClassEnum("data_class").notNull().default("INTERNAL"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
};
