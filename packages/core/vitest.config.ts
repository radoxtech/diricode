import { defineConfig } from "vitest/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    preserveSymlinks: true,
  },
  test: {
    pool: "forks",
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
