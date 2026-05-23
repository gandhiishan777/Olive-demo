import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    testTimeout: 10_000,
    setupFiles: ["src/__tests__/setup.ts"],
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
