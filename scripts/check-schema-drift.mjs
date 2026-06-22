import { execSync } from "node:child_process";

// drizzle-kit check: Schema (TS) gegen Migrationen — schlägt fehl bei Drift.
try {
  execSync("pnpm db:check", { stdio: "inherit" });
  console.log("Schema-Drift-Check: OK");
} catch {
  console.error(
    "Schema weicht von Migrationen ab — `pnpm db:generate` ausführen und committen.",
  );
  process.exit(1);
}
