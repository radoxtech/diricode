import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@diricode/providers", () => ({
  KeychainService: vi.fn().mockImplementation(() => ({
    set: vi.fn(),
    get: vi.fn().mockReturnValue(null),
  })),
  KEYCHAIN_SERVICE: "diricode",
  KEYCHAIN_ACCOUNT: "github-token",
  validateGithubToken: vi.fn(),
  InvalidTokenError: class InvalidTokenError extends Error {
    constructor(message = "invalid") {
      super(message);
      this.name = "InvalidTokenError";
    }
  },
  fetchAvailableModels: vi.fn(),
}));

vi.mock("@inquirer/prompts", () => ({
  password: vi.fn(),
  confirm: vi.fn(),
  select: vi.fn(),
}));

vi.mock("@diricode/core", () => ({
  getGlobalConfigDir: vi.fn().mockReturnValue("/tmp/dc-test-config"),
}));

vi.mock("node:fs", () => ({
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn().mockReturnValue("{}"),
  existsSync: vi.fn().mockReturnValue(false),
}));

import { password, confirm, select } from "@inquirer/prompts";
import {
  validateGithubToken,
  InvalidTokenError,
  KeychainService,
  fetchAvailableModels,
} from "@diricode/providers";
import { mkdirSync, writeFileSync } from "node:fs";
import { runLogin } from "../commands/login.js";

describe("runLogin", () => {
  let keychainSetMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    keychainSetMock = vi.fn();
    vi.mocked(KeychainService).mockImplementation(
      () =>
        ({ set: keychainSetMock, get: vi.fn() }) as unknown as InstanceType<typeof KeychainService>,
    );
    vi.mocked(fetchAvailableModels).mockResolvedValue([
      { id: "gpt-4o", provider: "openai", modelId: "gpt-4o", supportsStreaming: true },
    ]);
    vi.mocked(select).mockResolvedValue("gpt-4o");
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  it("saves token to keychain on successful validation", async () => {
    vi.mocked(password).mockResolvedValue("ghp_valid_token");
    vi.mocked(validateGithubToken).mockResolvedValue({
      login: "octocat",
      name: "The Octocat",
    });

    await runLogin();

    expect(keychainSetMock).toHaveBeenCalledWith("diricode", "github-token", "ghp_valid_token");
  });

  it("saves default model to global config after token is saved", async () => {
    vi.mocked(password).mockResolvedValue("ghp_valid_token");
    vi.mocked(validateGithubToken).mockResolvedValue({ login: "octocat" });
    vi.mocked(select).mockResolvedValue("gpt-4o");

    await runLogin();

    expect(mkdirSync).toHaveBeenCalled();
    expect(writeFileSync).toHaveBeenCalled();
  });

  it("uses non-interactive token and model when provided via options", async () => {
    vi.mocked(validateGithubToken).mockResolvedValue({ login: "octocat" });

    await runLogin({ token: "ghp_provided", model: "claude-3-5-sonnet" });

    expect(password).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
    expect(keychainSetMock).toHaveBeenCalledWith("diricode", "github-token", "ghp_provided");
    const written = vi.mocked(writeFileSync).mock.calls[0];
    expect(written?.[1]).toContain("claude-3-5-sonnet");
  });

  it("exits with code 1 on InvalidTokenError", async () => {
    vi.mocked(password).mockResolvedValue("ghp_bad");
    vi.mocked(validateGithubToken).mockRejectedValue(new InvalidTokenError("token rejected"));

    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);

    await expect(runLogin()).rejects.toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("aborts when user declines to save unverified token", async () => {
    vi.mocked(password).mockResolvedValue("ghp_unverified");
    vi.mocked(validateGithubToken).mockRejectedValue(new Error("network error"));
    vi.mocked(confirm).mockResolvedValue(false);

    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);

    await expect(runLogin()).rejects.toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(keychainSetMock).not.toHaveBeenCalled();
  });

  it("saves token when user confirms saving unverified token", async () => {
    vi.mocked(password).mockResolvedValue("ghp_unverified");
    vi.mocked(validateGithubToken).mockRejectedValue(new Error("network error"));
    vi.mocked(confirm).mockResolvedValue(true);

    await runLogin();

    expect(keychainSetMock).toHaveBeenCalledWith("diricode", "github-token", "ghp_unverified");
  });
});
