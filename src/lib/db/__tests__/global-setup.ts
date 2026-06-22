import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

let container: StartedPostgreSqlContainer;

export async function setup() {
  container = await new PostgreSqlContainer("postgres:16").start();
  const url = container.getConnectionUri();
  process.env.DATABASE_URL = url;
  const client = postgres(url, { max: 1 });
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  await client.end();
}

export async function teardown() {
  await container?.stop();
}
