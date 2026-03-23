import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "/@vite/env": "/tmp/vite-env-stub.mjs",
      "@vite/env": "/tmp/vite-env-stub.mjs",
    },
    preserveSymlinks: true,
  },
  root: resolve(__dirname),
  test: {
    root: resolve(__dirname),
    pool: "forks",
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
