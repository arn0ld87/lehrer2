import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    globalSetup: "./src/lib/db/__tests__/global-setup.ts",
    testTimeout: 60_000, // Testcontainers-Start
    fileParallelism: false, // gemeinsame Test-DB
    pool: "forks", // env vars from globalSetup propagate reliably to forked child processes
  },
});
