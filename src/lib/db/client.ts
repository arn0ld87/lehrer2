import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://ua_lsa:change-me-locally@localhost:5432/ua_lsa";

declare global {
  var __postgresClient: ReturnType<typeof postgres> | undefined;
}

const queryClient = globalThis.__postgresClient ?? postgres(connectionString, { max: 10 });
if (process.env.NODE_ENV !== "production") globalThis.__postgresClient = queryClient;

export const db = drizzle(queryClient, { schema });
export type Db = typeof db;
