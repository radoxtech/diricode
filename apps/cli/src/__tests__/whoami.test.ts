import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetGithubToken = vi.hoisted(() => vi.fn<() => string | undefined>());
const mockGetGithubTokenSource = vi.hoisted(() => vi.fn<() => string>());
const mockValidateGithubToken = vi.hoisted(() =>
  vi.fn<(token: string) => Promise<{ login: string; name?: string }>>(),
);

vi.mock("@diricode/dirirouter", () => ({
  getGithubToken: mockGetGithubToken,
  getGithubTokenSource: mockGetGithubTokenSource,
  validateGithubToken: mockValidateGithubToken,
  InvalidTokenError: class InvalidTokenError extends Error {},
}));

import { runWhoami } from "../commands/whoami.js";

describe("runWhoami()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows not-logged-in message when no token", async () => {
    mockGetGithubToken.mockReturnValue(undefined);
    mockGetGithubTokenSource.mockReturnValue("none");
    const out: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((s) => {
      out.push(String(s));
      return true;
    });
    await runWhoami();
    expect(out.join("")).toContain("Not logged in");
    expect(out.join("")).toContain("dc login");
  });

  it("shows login and env var source when DC_GITHUB_TOKEN is set", async () => {
    mockGetGithubToken.mockReturnValue("ghp_env");
    mockGetGithubTokenSource.mockReturnValue("DC_GITHUB_TOKEN");
    mockValidateGithubToken.mockResolvedValue({ login: "octocat", name: "The Octocat" });
    const out: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((s) => {
      out.push(String(s));
      return true;
    });
    await runWhoami();
    const combined = out.join("");
    expect(combined).toContain("octocat");
    expect(combined).toContain("DC_GITHUB_TOKEN");
    expect(combined).toContain("env var");
  });

  it("shows keychain as source when token from keychain", async () => {
    mockGetGithubToken.mockReturnValue("ghp_keychain");
    mockGetGithubTokenSource.mockReturnValue("keychain");
    mockValidateGithubToken.mockResolvedValue({ login: "octocat" });
    const out: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((s) => {
      out.push(String(s));
      return true;
    });
    await runWhoami();
    expect(out.join("")).toContain("OS Keychain");
  });

  it("shows invalid-token message when validation fails", async () => {
    mockGetGithubToken.mockReturnValue("ghp_bad");
    mockGetGithubTokenSource.mockReturnValue("GITHUB_TOKEN");
    const { InvalidTokenError } = await import("@diricode/dirirouter");
    mockValidateGithubToken.mockRejectedValue(new InvalidTokenError("Bad credentials"));
    const out: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((s) => {
      out.push(String(s));
      return true;
    });
    await runWhoami();
    expect(out.join("")).toContain("invalid");
    expect(out.join("")).toContain("dc login");
  });
});
