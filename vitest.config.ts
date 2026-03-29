import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@napi-rs/keyring": resolve(__dirname, "test-support/keyring-shim.ts"),
    },
  },
  test: {
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
