import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@napi-rs/keyring", () => {
  const mockEntry = vi.fn();
  mockEntry.prototype.getPassword = vi.fn().mockReturnValue(null);
  mockEntry.prototype.setPassword = vi.fn();
  mockEntry.prototype.deletePassword = vi.fn().mockReturnValue(true);
  return {
    Entry: mockEntry,
    findCredentials: vi.fn().mockReturnValue([]),
  };
});

import { getGithubToken, hasGithubAuth, getGithubTokenFromKeychain } from "../copilot/auth.js";
import { Entry } from "@napi-rs/keyring";

describe("getGithubToken() with keychain fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns DC_GITHUB_TOKEN when set (env wins over keychain)", () => {
    vi.stubEnv("DC_GITHUB_TOKEN", "env-token");
    vi.mocked(Entry.prototype.getPassword).mockReturnValue("keychain-token");
    expect(getGithubToken()).toBe("env-token");
  });

  it("returns GITHUB_TOKEN when DC_GITHUB_TOKEN not set", () => {
    vi.stubEnv("DC_GITHUB_TOKEN", "");
    vi.stubEnv("GITHUB_TOKEN", "github-env-token");
    expect(getGithubToken()).toBe("github-env-token");
  });

  it("returns GH_TOKEN as last env var fallback", () => {
    vi.stubEnv("DC_GITHUB_TOKEN", "");
    vi.stubEnv("GITHUB_TOKEN", "");
    vi.stubEnv("GH_TOKEN", "gh-token");
    expect(getGithubToken()).toBe("gh-token");
  });

  it("returns keychain token when no env vars set", () => {
    vi.stubEnv("DC_GITHUB_TOKEN", "");
    vi.stubEnv("GITHUB_TOKEN", "");
    vi.stubEnv("GH_TOKEN", "");
    vi.mocked(Entry.prototype.getPassword).mockReturnValue("keychain-token");
    expect(getGithubToken()).toBe("keychain-token");
  });

  it("returns undefined when neither env vars nor keychain has a token", () => {
    vi.stubEnv("DC_GITHUB_TOKEN", "");
    vi.stubEnv("GITHUB_TOKEN", "");
    vi.stubEnv("GH_TOKEN", "");
    vi.mocked(Entry.prototype.getPassword).mockReturnValue(null);
    expect(getGithubToken()).toBeUndefined();
  });
});

describe("getGithubTokenFromKeychain()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns token from keychain when available", () => {
    vi.mocked(Entry.prototype.getPassword).mockReturnValue("keychain-token");
    expect(getGithubTokenFromKeychain()).toBe("keychain-token");
  });

  it("returns undefined when keychain has no token", () => {
    vi.mocked(Entry.prototype.getPassword).mockReturnValue(null);
    expect(getGithubTokenFromKeychain()).toBeUndefined();
  });
});

describe("hasGithubAuth()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns true when env var is set", () => {
    vi.stubEnv("DC_GITHUB_TOKEN", "some-token");
    expect(hasGithubAuth()).toBe(true);
  });

  it("returns true when keychain has token", () => {
    vi.stubEnv("DC_GITHUB_TOKEN", "");
    vi.stubEnv("GITHUB_TOKEN", "");
    vi.stubEnv("GH_TOKEN", "");
    vi.mocked(Entry.prototype.getPassword).mockReturnValue("keychain-token");
    expect(hasGithubAuth()).toBe(true);
  });

  it("returns false when neither env nor keychain has a token", () => {
    vi.stubEnv("DC_GITHUB_TOKEN", "");
    vi.stubEnv("GITHUB_TOKEN", "");
    vi.stubEnv("GH_TOKEN", "");
    vi.mocked(Entry.prototype.getPassword).mockReturnValue(null);
    expect(hasGithubAuth()).toBe(false);
  });
});
