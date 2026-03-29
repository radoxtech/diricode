import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../paths.js", () => ({
  getGlobalConfigDir: () => join(tmpdir(), "dc-test-global-config-does-not-exist"),
}));

import { loadConfig } from "../loader.js";

function makeTempDir(): string {
  const dir = join(
    tmpdir(),
    `dc-test-${String(Date.now())}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("loadConfig", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it("returns Zod defaults when no config files exist", async () => {
    const result = await loadConfig({ cwd: tempDir });
    expect(result.config.providers).toEqual({});
    expect(result.config.agents).toEqual({});
    expect(result.config.workMode.verbosity).toBe("normal");
    expect(result.config.workMode.autonomy).toBe("guided");
  });

  it("includes defaults layer in result.layers", async () => {
    const result = await loadConfig({ cwd: tempDir });
    expect(result.layers.some((l) => l.source === "defaults")).toBe(true);
  });

  it("loads project JSONC config from .dc/config.jsonc", async () => {
    const dcDir = join(tempDir, ".dc");
    mkdirSync(dcDir, { recursive: true });
    writeFileSync(
      join(dcDir, "config.jsonc"),
      JSON.stringify({
        providers: { openai: { apiKey: "test-key" } },
      }),
    );

    const result = await loadConfig({ cwd: tempDir });
    expect(result.config.providers.openai?.apiKey).toBe("test-key");
  });

  it("deep merges project config over defaults", async () => {
    const dcDir = join(tempDir, ".dc");
    mkdirSync(dcDir, { recursive: true });
    writeFileSync(
      join(dcDir, "config.jsonc"),
      JSON.stringify({
        workMode: { verbosity: "verbose" },
      }),
    );

    const result = await loadConfig({ cwd: tempDir });
    expect(result.config.workMode.verbosity).toBe("verbose");
    expect(result.config.workMode.autonomy).toBe("guided");
  });

  it("CLI overrides take highest priority over project config", async () => {
    const dcDir = join(tempDir, ".dc");
    mkdirSync(dcDir, { recursive: true });
    writeFileSync(
      join(dcDir, "config.jsonc"),
      JSON.stringify({
        workMode: { verbosity: "silent" },
      }),
    );

    const result = await loadConfig({
      cwd: tempDir,
      overrides: { workMode: { verbosity: "verbose" } },
    });
    expect(result.config.workMode.verbosity).toBe("verbose");
  });

  it("DC_PROVIDER env var creates provider entry", async () => {
    vi.stubEnv("DC_PROVIDER", "anthropic");

    const result = await loadConfig({ cwd: tempDir });
    expect(result.config.providers.anthropic).toBeDefined();
  });

  it("DC_MODEL env var sets agents.default.model", async () => {
    vi.stubEnv("DC_MODEL", "gpt-4o");

    const result = await loadConfig({ cwd: tempDir });
    expect(result.config.agents.default?.model).toBe("gpt-4o");
  });

  it('DC_VERBOSE=1 sets workMode.verbosity to "verbose"', async () => {
    vi.stubEnv("DC_VERBOSE", "1");

    const result = await loadConfig({ cwd: tempDir });
    expect(result.config.workMode.verbosity).toBe("verbose");
  });

  it('DC_VERBOSE=true sets workMode.verbosity to "verbose"', async () => {
    vi.stubEnv("DC_VERBOSE", "true");

    const result = await loadConfig({ cwd: tempDir });
    expect(result.config.workMode.verbosity).toBe("verbose");
  });

  it("validates final config with Zod (rejects invalid merged output)", async () => {
    await expect(
      loadConfig({
        cwd: tempDir,
        overrides: { workMode: { verbosity: "invalid-value" as "verbose" } },
      }),
    ).rejects.toThrow();
  });

  it("handles missing global config file gracefully", async () => {
    await expect(loadConfig({ cwd: tempDir })).resolves.toBeDefined();
  });

  it("handles missing project config file gracefully", async () => {
    const result = await loadConfig({ cwd: tempDir });
    expect(result.config).toBeDefined();
    expect(result.configFile).toBeUndefined();
  });

  it("returns layer info in result", async () => {
    const result = await loadConfig({ cwd: tempDir });
    expect(Array.isArray(result.layers)).toBe(true);
    expect(result.layers.length).toBeGreaterThan(0);
  });

  it("includes project layer when project config file exists", async () => {
    const dcDir = join(tempDir, ".dc");
    mkdirSync(dcDir, { recursive: true });
    writeFileSync(join(dcDir, "config.jsonc"), JSON.stringify({ project: { name: "my-project" } }));

    const result = await loadConfig({ cwd: tempDir });
    expect(result.layers.some((l) => l.source === "project")).toBe(true);
  });

  it("includes runtime layer when env vars are set", async () => {
    vi.stubEnv("DC_VERBOSE", "1");

    const result = await loadConfig({ cwd: tempDir });
    expect(result.layers.some((l) => l.source === "runtime")).toBe(true);
  });

  it("CLI overrides take priority over DC_* env vars", async () => {
    vi.stubEnv("DC_VERBOSE", "1");

    const result = await loadConfig({
      cwd: tempDir,
      overrides: { workMode: { verbosity: "silent" } },
    });
    expect(result.config.workMode.verbosity).toBe("silent");
  });
});
