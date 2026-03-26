import { homedir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getGlobalConfigDir, getProjectConfigPath } from "../paths.js";

describe("getGlobalConfigDir", () => {
  let originalPlatform: NodeJS.Platform;

  beforeEach(() => {
    originalPlatform = process.platform;
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
    vi.unstubAllEnvs();
  });

  it("returns ~/Library/Preferences/diricode on macOS", () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    const result = getGlobalConfigDir();
    expect(result).toBe(join(homedir(), "Library", "Preferences", "diricode"));
  });

  it("returns $XDG_CONFIG_HOME/diricode on Linux when XDG_CONFIG_HOME is set", () => {
    Object.defineProperty(process, "platform", { value: "linux" });
    vi.stubEnv("XDG_CONFIG_HOME", "/custom/config");
    const result = getGlobalConfigDir();
    expect(result).toBe("/custom/config/diricode");
  });

  it("returns ~/.config/diricode on Linux when XDG_CONFIG_HOME is not set", () => {
    Object.defineProperty(process, "platform", { value: "linux" });
    vi.stubEnv("XDG_CONFIG_HOME", "");
    const result = getGlobalConfigDir();
    expect(result).toBe(join(homedir(), ".config", "diricode"));
  });

  it("returns ~/.config/diricode on Linux when XDG_CONFIG_HOME is undefined", () => {
    Object.defineProperty(process, "platform", { value: "linux" });
    vi.stubEnv("XDG_CONFIG_HOME", undefined as unknown as string);
    const result = getGlobalConfigDir();
    expect(result).toBe(join(homedir(), ".config", "diricode"));
  });

  it("throws on unsupported platform (win32)", () => {
    Object.defineProperty(process, "platform", { value: "win32" });
    expect(() => getGlobalConfigDir()).toThrow('Unsupported platform: "win32"');
  });

  it("throws on other unsupported platforms", () => {
    Object.defineProperty(process, "platform", { value: "freebsd" });
    expect(() => getGlobalConfigDir()).toThrow('Unsupported platform: "freebsd"');
  });
});

describe("getProjectConfigPath", () => {
  it("returns .dc/config.jsonc relative to process.cwd() by default", () => {
    const result = getProjectConfigPath();
    expect(result).toBe(join(process.cwd(), ".dc", "config.jsonc"));
  });

  it("returns .dc/config.jsonc relative to custom dir", () => {
    const result = getProjectConfigPath("/custom/dir");
    expect(result).toBe("/custom/dir/.dc/config.jsonc");
  });

  it("resolves correctly with trailing slash in custom dir", () => {
    const result = getProjectConfigPath("/some/project");
    expect(result).toBe(join("/some/project", ".dc", "config.jsonc"));
  });
});
