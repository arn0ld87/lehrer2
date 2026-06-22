import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://ua_lsa:change-me-locally@localhost:5432/ua_lsa",
  },
  strict: true,
  verbose: true,
});
