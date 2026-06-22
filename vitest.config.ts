import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
    globalSetup: "./src/lib/db/__tests__/global-setup.ts",
    testTimeout: 60_000, // Testcontainers-Start
    fileParallelism: false, // gemeinsame Test-DB
  },
});
