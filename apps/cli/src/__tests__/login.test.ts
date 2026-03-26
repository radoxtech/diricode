import { describe, it, expect, vi, beforeEach } from "vitest";

const mockKeychainSet = vi.hoisted(() => vi.fn());

vi.mock("@diricode/providers", () => {
  function MockKeychain() {}
  MockKeychain.prototype.set = mockKeychainSet;
  MockKeychain.prototype.get = vi.fn().mockReturnValue(null);

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
  };
});

vi.mock("@inquirer/prompts", () => ({
  password: vi.fn().mockResolvedValue("ghp_test_token"),
  select: vi.fn().mockResolvedValue("gpt-5-mini"),
}));

import { runLogin } from "../commands/login.js";
import { validateGithubToken, fetchAvailableModels } from "@diricode/providers";
import { password, select } from "@inquirer/prompts";

describe("runLogin()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
