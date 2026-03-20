import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "vmForks",
    include: ["src/__tests__/**/*.test.ts"],
  },
});
