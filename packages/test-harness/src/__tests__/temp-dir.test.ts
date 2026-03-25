import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { TempDir } from "../temp-dir.js";
import { stat } from "node:fs/promises";

describe("TempDir", () => {
  let tempDir: TempDir;

  beforeEach(() => {
    tempDir = new TempDir();
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  it("should create a temporary directory on setup", async () => {
    const path = await tempDir.setup();
    const stats = await stat(path);
    expect(stats.isDirectory()).toBe(true);
  });

  it("should return the same path after setup", async () => {
    const setupPath = await tempDir.setup();
    expect(tempDir.path).toBe(setupPath);
  });

  it("should throw when accessing path before setup", () => {
    expect(() => tempDir.path).toThrow("TempDir not initialized");
  });

  it("should resolve paths relative to temp directory", async () => {
    await tempDir.setup();
    const resolvedPath = tempDir.resolve("subdir", "file.txt");
    expect(resolvedPath).toContain("subdir");
    expect(resolvedPath).toContain("file.txt");
  });

  it("should clean up the directory on cleanup", async () => {
    const path = await tempDir.setup();
    await tempDir.cleanup();
    await expect(stat(path)).rejects.toThrow();
  });

  it("should allow custom prefix", async () => {
    const customDir = new TempDir("custom-prefix-");
    const path = await customDir.setup();
    expect(path).toContain("custom-prefix-");
    await customDir.cleanup();
  });
});
