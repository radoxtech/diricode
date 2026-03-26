import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const keychainStore = new Map<string, string>();

const mockValidateGithubToken = vi.hoisted(() =>
  vi.fn<(token: string) => Promise<{ login: string; name?: string }>>(),
);
const mockFetchAvailableModels = vi.hoisted(() => vi.fn());
const mockGetGithubToken = vi.hoisted(() => vi.fn<() => string | undefined>());
const mockGetGithubTokenSource = vi.hoisted(() => vi.fn<() => string>());
const mockMkdirSync = vi.hoisted(() => vi.fn());
const mockWriteFileSync = vi.hoisted(() => vi.fn());
const mockExistsSync = vi.hoisted(() => vi.fn<() => boolean>().mockReturnValue(false));
const mockReadFileSync = vi.hoisted(() => vi.fn());

vi.mock("@diricode/providers", () => {
  function MockKeychain() {}
  MockKeychain.prototype.get = vi.fn((service: string, account: string) => {
    return keychainStore.get(`${service}:${account}`) ?? null;
  });
  MockKeychain.prototype.set = vi.fn((service: string, account: string, value: string) => {
    keychainStore.set(`${service}:${account}`, value);
  });
  MockKeychain.prototype.delete = vi.fn((service: string, account: string) => {
    const key = `${service}:${account}`;
    const existed = keychainStore.has(key);
    keychainStore.delete(key);
    return existed;
  });

  return {
    KeychainService: MockKeychain,
    KEYCHAIN_SERVICE: "diricode",
    KEYCHAIN_ACCOUNT: "github-token",
    KeychainUnavailableError: class KeychainUnavailableError extends Error {},
    InvalidTokenError: class InvalidTokenError extends Error {
      constructor(message: string) {
        super(message);
        this.name = "InvalidTokenError";
      }
    },
    validateGithubToken: mockValidateGithubToken,
    fetchAvailableModels: mockFetchAvailableModels,
    getGithubToken: mockGetGithubToken,
    getGithubTokenSource: mockGetGithubTokenSource,
  };
});

vi.mock("@inquirer/prompts", () => ({
  password: vi.fn().mockResolvedValue("ghp_integration_token"),
  select: vi.fn().mockResolvedValue("gpt-5-mini"),
}));

vi.mock("@diricode/core", () => ({
  getGlobalConfigDir: vi.fn().mockImplementation(() => {
    throw new Error("Unsupported platform");
  }),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    mkdirSync: mockMkdirSync,
    writeFileSync: mockWriteFileSync,
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
  };
});

import { runLogin } from "../commands/login.js";
import { runWhoami } from "../commands/whoami.js";
import { runLogout } from "../commands/logout.js";

function captureStdout(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const spy = vi.spyOn(process.stdout, "write").mockImplementation((s) => {
    lines.push(String(s));
    return true;
  });
  return { lines, restore: () => spy.mockRestore() };
}

describe("login → whoami → logout integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    keychainStore.clear();
    mockGetGithubToken.mockReturnValue(undefined);
    mockGetGithubTokenSource.mockReturnValue("none");
    mockValidateGithubToken.mockResolvedValue({ login: "octocat", name: "The Octocat" });
    mockFetchAvailableModels.mockResolvedValue([
      {
        id: "gpt-5-mini",
        name: "GPT-5 Mini",
        registry: "openai",
        publisher: "openai",
        capabilities: [],
        rate_limit_tier: "standard",
      },
    ]);
    mockExistsSync.mockReturnValue(false);
    process.exitCode = 0;
  });

  afterEach(() => {
    process.exitCode = 0;
  });

  it("login stores token in keychain, whoami reads it, logout clears it", async () => {
    const loginOut = captureStdout();
    await runLogin({ token: "ghp_test_integration", model: "gpt-5-mini" });
    loginOut.restore();

    expect(loginOut.lines.join("")).toContain("Logged in as octocat");
    expect(keychainStore.get("diricode:github-token")).toBe("ghp_test_integration");

    mockGetGithubToken.mockReturnValue("ghp_test_integration");
    mockGetGithubTokenSource.mockReturnValue("keychain");

    const whoamiOut = captureStdout();
    await runWhoami();
    whoamiOut.restore();

    expect(whoamiOut.lines.join("")).toContain("octocat");
    expect(whoamiOut.lines.join("")).toContain("OS Keychain");

    const logoutOut = captureStdout();
    await runLogout();
    logoutOut.restore();

    expect(logoutOut.lines.join("")).toContain("Logged out successfully");
    expect(keychainStore.has("diricode:github-token")).toBe(false);
  });

  it("whoami after logout shows not-logged-in", async () => {
    await runLogin({ token: "ghp_test_integration", model: "gpt-5-mini" });

    const logoutOut = captureStdout();
    await runLogout();
    logoutOut.restore();
    expect(keychainStore.has("diricode:github-token")).toBe(false);

    mockGetGithubToken.mockReturnValue(undefined);
    mockGetGithubTokenSource.mockReturnValue("none");

    const whoamiOut = captureStdout();
    await runWhoami();
    whoamiOut.restore();

    expect(whoamiOut.lines.join("")).toContain("Not logged in");
  });

  it("login with invalid token rejects and does not store in keychain", async () => {
    const { InvalidTokenError } = await import("@diricode/providers");
    mockValidateGithubToken.mockRejectedValueOnce(new InvalidTokenError("Bad credentials"));

    const errLines: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((s) => {
      errLines.push(String(s));
      return true;
    });

    await runLogin({ token: "ghp_bad_token", model: "gpt-5-mini" });

    expect(errLines.join("")).toContain("Invalid token");
    expect(process.exitCode).toBe(1);
    expect(keychainStore.has("diricode:github-token")).toBe(false);
  });

  it("whoami with stale keychain token shows invalid-token error and re-auth hint", async () => {
    const { InvalidTokenError } = await import("@diricode/providers");
    mockGetGithubToken.mockReturnValue("ghp_stale");
    mockGetGithubTokenSource.mockReturnValue("keychain");
    mockValidateGithubToken.mockRejectedValueOnce(new InvalidTokenError("Token expired"));

    const whoamiOut = captureStdout();
    await runWhoami();
    whoamiOut.restore();

    const combined = whoamiOut.lines.join("");
    expect(combined).toContain("invalid");
    expect(combined).toContain("dc login");
  });

  it("login shows already-authenticated when token exists and no --token flag", async () => {
    mockGetGithubToken.mockReturnValue("ghp_existing");
    mockGetGithubTokenSource.mockReturnValue("DC_GITHUB_TOKEN");

    const loginOut = captureStdout();
    await runLogin({});
    loginOut.restore();

    expect(loginOut.lines.join("")).toContain("Already authenticated");
    expect(mockValidateGithubToken).not.toHaveBeenCalled();
    expect(keychainStore.has("diricode:github-token")).toBe(false);
  });

  it("second logout reports no token to remove", async () => {
    await runLogin({ token: "ghp_test", model: "gpt-5-mini" });

    const firstOut = captureStdout();
    await runLogout();
    firstOut.restore();
    expect(firstOut.lines.join("")).toContain("Logged out successfully");

    const secondOut = captureStdout();
    await runLogout();
    secondOut.restore();
    expect(secondOut.lines.join("")).toContain("No keychain token found");
  });
});
