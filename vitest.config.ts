import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "@napi-rs/keyring": resolve(__dirname, "test-support/keyring-shim.ts"),
    },
  },
  test: {
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
