import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Required: native modules (e.g. @napi-rs/keyring) segfault with threads pool
    pool: "forks",
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    server: {
      deps: {
        external: ["@napi-rs/keyring"],
      },
    },
  },
});
