import { describe, it, expect, vi, beforeEach } from "vitest";

const mockKeychainSet = vi.hoisted(() => vi.fn());
const mockGetGithubToken = vi.hoisted(() => vi.fn<() => string | undefined>());
const mockGetGithubTokenSource = vi.hoisted(() => vi.fn<() => string>());
const mockSaveDefaultModel = vi.hoisted(() => vi.fn());

vi.mock("@diricode/providers", () => {
  class MockKeychain {
    set = mockKeychainSet;
    get = vi.fn().mockReturnValue(null);
  }

  return {
    KeychainService: MockKeychain,
    KEYCHAIN_SERVICE: "diricode",
    KEYCHAIN_ACCOUNT: "github-token",
    validateGithubToken: vi.fn().mockResolvedValue({ login: "octocat", name: "The Octocat" }),
    fetchAvailableModels: vi.fn().mockResolvedValue([
      {
        id: "gpt-5-mini",
        name: "GPT-5 Mini",
        registry: "openai",
        publisher: "openai",
        capabilities: [],
        rate_limit_tier: "standard",
      },
    ]),
    getGithubToken: mockGetGithubToken,
    getGithubTokenSource: mockGetGithubTokenSource,
    InvalidTokenError: class InvalidTokenError extends Error {},
  };
});

vi.mock("@inquirer/prompts", () => ({
  password: vi.fn().mockResolvedValue("ghp_test_token"),
  select: vi.fn().mockResolvedValue("gpt-5-mini"),
}));

vi.mock("@diricode/core", () => ({
  getGlobalConfigDir: vi.fn().mockImplementation(() => {
    throw new Error("Unsupported platform");
  }),
}));

vi.mock("node:fs", async () => {
  const actual: Record<string, unknown> = await vi.importActual("node:fs");
  return {
    ...actual,
    mkdirSync: mockSaveDefaultModel,
    writeFileSync: vi.fn(),
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn(),
  };
});

import { runLogin } from "../commands/login.js";
import { validateGithubToken, fetchAvailableModels } from "@diricode/providers";
import { password, select } from "@inquirer/prompts";

describe("runLogin()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGithubToken.mockReturnValue(undefined);
    mockGetGithubTokenSource.mockReturnValue("none");
  });

  it("prompts for token when not provided", async () => {
    await runLogin({});
    expect(password).toHaveBeenCalled();
  });

  it("skips token prompt when --token provided", async () => {
    await runLogin({ token: "ghp_provided" });
    expect(password).not.toHaveBeenCalled();
  });

  it("validates the token", async () => {
    await runLogin({ token: "ghp_test" });
    expect(validateGithubToken).toHaveBeenCalledWith("ghp_test");
  });

  it("prompts for model selection when --model not provided", async () => {
    await runLogin({ token: "ghp_test" });
    expect(fetchAvailableModels).toHaveBeenCalled();
    expect(select).toHaveBeenCalled();
  });

  it("skips model prompt when --model provided", async () => {
    await runLogin({ token: "ghp_test", model: "gpt-5-mini" });
    expect(select).not.toHaveBeenCalled();
  });

  it("shows already-authenticated message when token exists and no --token flag", async () => {
    mockGetGithubToken.mockReturnValue("existing-token");
    mockGetGithubTokenSource.mockReturnValue("DC_GITHUB_TOKEN");
    const out: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((s) => {
      out.push(String(s));
      return true;
    });
    await runLogin({});
    expect(out.join("")).toContain("Already authenticated");
    expect(validateGithubToken).not.toHaveBeenCalled();
  });

  it("proceeds with re-auth when --token flag is passed even if already logged in", async () => {
    mockGetGithubToken.mockReturnValue("existing-token");
    mockGetGithubTokenSource.mockReturnValue("keychain");
    await runLogin({ token: "ghp_new_token", model: "gpt-5-mini" });
    expect(validateGithubToken).toHaveBeenCalledWith("ghp_new_token");
  });

  it("shows error and sets exitCode=1 on invalid token", async () => {
    const { InvalidTokenError } = await import("@diricode/providers");
    vi.mocked(validateGithubToken).mockRejectedValueOnce(new InvalidTokenError("Bad credentials"));
    const errOut: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((s) => {
      errOut.push(String(s));
      return true;
    });
    process.exitCode = 0;
    await runLogin({ token: "bad-token", model: "gpt-5-mini" });
    expect(errOut.join("")).toContain("Invalid token");
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});
