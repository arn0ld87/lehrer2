import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://ua_lsa:change-me-locally@localhost:5432/ua_lsa";

// Eine Verbindung pro Prozess; max niedrig halten (self-hosted Schulnetz).
const queryClient = postgres(connectionString, { max: 10 });

export const db = drizzle(queryClient, { schema });
export type Db = typeof db;
