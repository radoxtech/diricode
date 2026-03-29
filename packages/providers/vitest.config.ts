import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@napi-rs/keyring": resolve(__dirname, "../../test-support/keyring-shim.ts"),
    },
  },
  test: {
    // Required: native modules (e.g. @napi-rs/keyring) segfault with threads pool
    pool: "forks",
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    server: {
      deps: {
        external: ["@napi-rs/keyring"],
      },
    },
  },
});
