import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockGetPassword = vi.hoisted(() => vi.fn<() => string | null>().mockReturnValue(null));
const mockSetPassword = vi.hoisted(() => vi.fn());
const mockDeletePassword = vi.hoisted(() => vi.fn<() => boolean>().mockReturnValue(true));

vi.mock("@napi-rs/keyring", () => {
  class MockEntry {
    getPassword = mockGetPassword;
    setPassword = mockSetPassword;
    deletePassword = mockDeletePassword;
  }

  return {
    Entry: MockEntry,
    findCredentials: vi.fn().mockReturnValue([]),
  };
});

import { getGithubToken, hasGithubAuth, getGithubTokenFromKeychain } from "../copilot/auth.js";

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
    mockGetPassword.mockReturnValue("keychain-token");
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
    mockGetPassword.mockReturnValue("keychain-token");
    expect(getGithubToken()).toBe("keychain-token");
  });

  it("returns undefined when neither env vars nor keychain has a token", () => {
    vi.stubEnv("DC_GITHUB_TOKEN", "");
    vi.stubEnv("GITHUB_TOKEN", "");
    vi.stubEnv("GH_TOKEN", "");
    mockGetPassword.mockReturnValue(null);
    expect(getGithubToken()).toBeUndefined();
  });
});

describe("getGithubTokenFromKeychain()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns token from keychain when available", () => {
    mockGetPassword.mockReturnValue("keychain-token");
    expect(getGithubTokenFromKeychain()).toBe("keychain-token");
  });

  it("returns undefined when keychain has no token", () => {
    mockGetPassword.mockReturnValue(null);
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
    mockGetPassword.mockReturnValue("keychain-token");
    expect(hasGithubAuth()).toBe(true);
  });

  it("returns false when neither env nor keychain has a token", () => {
    vi.stubEnv("DC_GITHUB_TOKEN", "");
    vi.stubEnv("GITHUB_TOKEN", "");
    vi.stubEnv("GH_TOKEN", "");
    mockGetPassword.mockReturnValue(null);
    expect(hasGithubAuth()).toBe(false);
  });
});
