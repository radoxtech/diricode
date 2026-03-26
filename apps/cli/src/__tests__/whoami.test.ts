import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@diricode/providers", () => ({
  hasGithubAuth: vi.fn(),
  getGithubTokenSource: vi.fn(),
  getGithubTokenWithFallback: vi.fn(),
  validateGithubToken: vi.fn(),
}));

vi.mock("@diricode/core", () => ({
  getGlobalConfigDir: vi.fn().mockReturnValue("/tmp/dc-test-whoami"),
}));

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(false),
}));

import {
  hasGithubAuth,
  getGithubTokenSource,
  getGithubTokenWithFallback,
  validateGithubToken,
} from "@diricode/providers";
import { existsSync, readFileSync } from "node:fs";
import { runWhoami } from "../commands/whoami.js";

describe("runWhoami", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  it("shows not-logged-in message when no auth", async () => {
    vi.mocked(hasGithubAuth).mockReturnValue(false);

    await runWhoami();

    expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining("Not logged in"));
  });

  it("shows login, source, and default model when authenticated", async () => {
    vi.mocked(hasGithubAuth).mockReturnValue(true);
    vi.mocked(getGithubTokenSource).mockReturnValue("keychain");
    vi.mocked(getGithubTokenWithFallback).mockReturnValue("ghp_test");
    vi.mocked(validateGithubToken).mockResolvedValue({
      login: "octocat",
      name: "The Octocat",
    });
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('{"providers":{"copilot":{"defaultModel":"gpt-4o"}}}');

    await runWhoami();

    const calls = vi.mocked(process.stdout.write).mock.calls.map((c) => String(c[0]));
    expect(calls.join("")).toContain("octocat");
    expect(calls.join("")).toContain("keychain");
    expect(calls.join("")).toContain("gpt-4o");
  });

  it("shows env token source when token comes from env", async () => {
    vi.mocked(hasGithubAuth).mockReturnValue(true);
    vi.mocked(getGithubTokenSource).mockReturnValue("env");
    vi.mocked(getGithubTokenWithFallback).mockReturnValue("ghp_env");
    vi.mocked(validateGithubToken).mockResolvedValue({ login: "devuser" });

    await runWhoami();

    const output = vi
      .mocked(process.stdout.write)
      .mock.calls.map((c) => String(c[0]))
      .join("");
    expect(output).toContain("env");
  });

  it("shows fallback message when default model not set", async () => {
    vi.mocked(hasGithubAuth).mockReturnValue(true);
    vi.mocked(getGithubTokenSource).mockReturnValue("keychain");
    vi.mocked(getGithubTokenWithFallback).mockReturnValue("ghp_test");
    vi.mocked(validateGithubToken).mockResolvedValue({ login: "octocat" });
    vi.mocked(existsSync).mockReturnValue(false);

    await runWhoami();

    const output = vi
      .mocked(process.stdout.write)
      .mock.calls.map((c) => String(c[0]))
      .join("");
    expect(output).toContain("not set");
  });
});
