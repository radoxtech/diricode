import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateGithubToken, InvalidTokenError } from "../copilot/validator.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("validateGithubToken()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user info on successful response", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        login: "octocat",
        name: "The Octocat",
        avatar_url: "https://example.com/avatar",
      }),
    });

    const user = await validateGithubToken("ghp_valid");
    expect(user).toEqual({
      login: "octocat",
      name: "The Octocat",
      avatar_url: "https://example.com/avatar",
    });
  });

  it("calls GitHub API with Bearer token and correct headers", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ login: "octocat" }),
    });

    await validateGithubToken("ghp_mytoken");

    expect(mockFetch).toHaveBeenCalledWith("https://api.github.com/user", {
      headers: expect.objectContaining({
        Authorization: "Bearer ghp_mytoken",
      }),
    });
  });

  it("throws InvalidTokenError on 401", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });
    await expect(validateGithubToken("bad-token")).rejects.toThrow(InvalidTokenError);
  });

  it("throws InvalidTokenError on 403", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403 });
    await expect(validateGithubToken("bad-token")).rejects.toThrow(InvalidTokenError);
  });

  it("throws InvalidTokenError on other non-ok status", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(validateGithubToken("bad-token")).rejects.toThrow(InvalidTokenError);
  });

  it("throws InvalidTokenError on network error", async () => {
    mockFetch.mockRejectedValue(new Error("Network failure"));
    await expect(validateGithubToken("any-token")).rejects.toThrow(InvalidTokenError);
  });

  it("error message includes HTTP status for non-401/403 errors", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503 });
    await expect(validateGithubToken("any-token")).rejects.toThrow("503");
  });
});
