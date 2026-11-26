import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/web/testing/**/*.rig.ts"],
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 600_000,
    hookTimeout: 600_000,
  },
});
