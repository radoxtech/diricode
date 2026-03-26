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

import { Entry } from "@napi-rs/keyring";
import {
  getGithubToken,
  getGithubTokenFromKeychain,
  getGithubTokenWithFallback,
  getGithubTokenSource,
  hasGithubAuth,
} from "../copilot/auth.js";

describe("getGithubToken", () => {
  beforeEach(() => {
    vi.stubEnv("DC_GITHUB_TOKEN", "");
    vi.stubEnv("GITHUB_TOKEN", "");
    vi.stubEnv("GH_TOKEN", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns undefined when no env vars set", () => {
    expect(getGithubToken()).toBeUndefined();
  });

  it("returns DC_GITHUB_TOKEN when set", () => {
    vi.stubEnv("DC_GITHUB_TOKEN", "ghp_dc_token");
    expect(getGithubToken()).toBe("ghp_dc_token");
  });

  it("returns GITHUB_TOKEN when DC_GITHUB_TOKEN not set", () => {
    vi.stubEnv("GITHUB_TOKEN", "ghp_gh_token");
    expect(getGithubToken()).toBe("ghp_gh_token");
  });

  it("returns GH_TOKEN as last fallback", () => {
    vi.stubEnv("GH_TOKEN", "ghp_alt_token");
    expect(getGithubToken()).toBe("ghp_alt_token");
  });

  it("prefers DC_GITHUB_TOKEN over GITHUB_TOKEN", () => {
    vi.stubEnv("DC_GITHUB_TOKEN", "ghp_dc");
    vi.stubEnv("GITHUB_TOKEN", "ghp_gh");
    expect(getGithubToken()).toBe("ghp_dc");
  });

  it("trims whitespace from token", () => {
    vi.stubEnv("GITHUB_TOKEN", "  ghp_trimmed  ");
    expect(getGithubToken()).toBe("ghp_trimmed");
  });
});

describe("getGithubTokenFromKeychain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns undefined when keychain has no token", () => {
    vi.mocked(Entry.prototype.getPassword).mockReturnValue(null);
    expect(getGithubTokenFromKeychain()).toBeUndefined();
  });

  it("returns token when keychain has one", () => {
    vi.mocked(Entry.prototype.getPassword).mockReturnValue("ghp_keychain_token");
    expect(getGithubTokenFromKeychain()).toBe("ghp_keychain_token");
  });

  it("returns undefined when keychain throws", () => {
    vi.mocked(Entry.prototype.getPassword).mockImplementation(() => {
      throw new Error("unavailable");
    });
    expect(getGithubTokenFromKeychain()).toBeUndefined();
  });
});

describe("getGithubTokenWithFallback", () => {
  beforeEach(() => {
    vi.stubEnv("DC_GITHUB_TOKEN", "");
    vi.stubEnv("GITHUB_TOKEN", "");
    vi.stubEnv("GH_TOKEN", "");
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns env token when available", () => {
    vi.stubEnv("GITHUB_TOKEN", "ghp_env");
    vi.mocked(Entry.prototype.getPassword).mockReturnValue("ghp_keychain");
    expect(getGithubTokenWithFallback()).toBe("ghp_env");
  });

  it("falls back to keychain when no env token", () => {
    vi.mocked(Entry.prototype.getPassword).mockReturnValue("ghp_keychain");
    expect(getGithubTokenWithFallback()).toBe("ghp_keychain");
  });

  it("returns undefined when neither env nor keychain has a token", () => {
    vi.mocked(Entry.prototype.getPassword).mockReturnValue(null);
    expect(getGithubTokenWithFallback()).toBeUndefined();
  });
});

describe("getGithubTokenSource", () => {
  beforeEach(() => {
    vi.stubEnv("DC_GITHUB_TOKEN", "");
    vi.stubEnv("GITHUB_TOKEN", "");
    vi.stubEnv("GH_TOKEN", "");
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns "env" when token is in env var', () => {
    vi.stubEnv("GITHUB_TOKEN", "ghp_env");
    expect(getGithubTokenSource()).toBe("env");
  });

  it('returns "keychain" when token only in keychain', () => {
    vi.mocked(Entry.prototype.getPassword).mockReturnValue("ghp_keychain");
    expect(getGithubTokenSource()).toBe("keychain");
  });

  it('returns "none" when no token anywhere', () => {
    vi.mocked(Entry.prototype.getPassword).mockReturnValue(null);
    expect(getGithubTokenSource()).toBe("none");
  });
});

describe("hasGithubAuth (with keychain fallback)", () => {
  beforeEach(() => {
    vi.stubEnv("DC_GITHUB_TOKEN", "");
    vi.stubEnv("GITHUB_TOKEN", "");
    vi.stubEnv("GH_TOKEN", "");
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when no env vars and no keychain token", () => {
    vi.mocked(Entry.prototype.getPassword).mockReturnValue(null);
    expect(hasGithubAuth()).toBe(false);
  });

  it("returns true when env var is set", () => {
    vi.stubEnv("GITHUB_TOKEN", "ghp_env");
    expect(hasGithubAuth()).toBe(true);
  });

  it("returns true when only keychain has a token", () => {
    vi.mocked(Entry.prototype.getPassword).mockReturnValue("ghp_keychain");
    expect(hasGithubAuth()).toBe(true);
  });
});
