import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "/@vite/env": "/tmp/vite-env-stub.mjs",
      "@vite/env": "/tmp/vite-env-stub.mjs",
    },
    preserveSymlinks: true,
  },
  root: "/tmp/diricode-24/packages/core",
  test: {
    root: "/tmp/diricode-24/packages/core",
    pool: "forks",
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
