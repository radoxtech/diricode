import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@diricode/core": resolve(__dirname, "packages/core/src/index.ts"),
      "@diricode/core/*": resolve(__dirname, "packages/core/src/*"),
      "@diricode/agents": resolve(__dirname, "packages/agents/src/index.ts"),
      "@diricode/agents/*": resolve(__dirname, "packages/agents/src/*"),
      "@diricode/providers": resolve(__dirname, "packages/providers/src/index.ts"),
      "@diricode/providers/*": resolve(__dirname, "packages/providers/src/*"),
      "@diricode/picker-contracts": resolve(__dirname, "packages/picker-contracts/src/index.ts"),
      "@diricode/picker-contracts/*": resolve(__dirname, "packages/picker-contracts/src/*"),
      "@diricode/tools": resolve(__dirname, "packages/tools/src/index.ts"),
      "@diricode/tools/*": resolve(__dirname, "packages/tools/src/*"),
      "@diricode/memory": resolve(__dirname, "packages/memory/src/index.ts"),
      "@diricode/memory/*": resolve(__dirname, "packages/memory/src/*"),
      "@diricode/server": resolve(__dirname, "packages/server/src/index.ts"),
      "@diricode/server/*": resolve(__dirname, "packages/server/src/*"),
      "@diricode/web": resolve(__dirname, "packages/web/src/index.ts"),
      "@diricode/web/*": resolve(__dirname, "packages/web/src/*"),
      "@diricode/github-mcp": resolve(__dirname, "packages/github-mcp/src/index.ts"),
      "@diricode/github-mcp/*": resolve(__dirname, "packages/github-mcp/src/*"),
      "@napi-rs/keyring": resolve(__dirname, "test-support/keyring-shim.ts"),
    },
  },
  test: {
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
