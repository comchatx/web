import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/web/testing/**/*.layout.ts"],
    environment: "happy-dom",
    fileParallelism: false,
    passWithNoTests: true,
    testTimeout: 120_000,
  },
});
