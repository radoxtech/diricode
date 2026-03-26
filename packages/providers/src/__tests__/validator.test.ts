import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateGithubToken, InvalidTokenError } from "../copilot/validator.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : status === 401 ? "Unauthorized" : "Forbidden",
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe("validateGithubToken", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns user info on success", async () => {
    mockFetch.mockResolvedValue(
      makeResponse(200, {
        login: "octocat",
        name: "The Octocat",
        avatar_url: "https://github.com/octocat.png",
      }),
    );

    const result = await validateGithubToken("ghp_valid");
    expect(result.login).toBe("octocat");
    expect(result.name).toBe("The Octocat");
    expect(result.avatar_url).toBe("https://github.com/octocat.png");
  });

  it("throws InvalidTokenError on 401", async () => {
    mockFetch.mockResolvedValue(makeResponse(401, {}));
    await expect(validateGithubToken("ghp_bad")).rejects.toThrow(InvalidTokenError);
  });

  it("throws InvalidTokenError on 403", async () => {
    mockFetch.mockResolvedValue(makeResponse(403, {}));
    await expect(validateGithubToken("ghp_forbidden")).rejects.toThrow(InvalidTokenError);
  });

  it("throws generic Error on other non-2xx status", async () => {
    mockFetch.mockResolvedValue(makeResponse(500, {}));
    await expect(validateGithubToken("ghp_token")).rejects.toThrow(Error);
    await expect(validateGithubToken("ghp_token")).rejects.not.toThrow(InvalidTokenError);
  });

  it("sends Bearer token in Authorization header", async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { login: "user" }));
    await validateGithubToken("ghp_my_token");
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer ghp_my_token");
  });

  it("InvalidTokenError has correct name", async () => {
    mockFetch.mockResolvedValue(makeResponse(401, {}));
    try {
      await validateGithubToken("bad");
    } catch (err) {
      expect((err as Error).name).toBe("InvalidTokenError");
    }
  });
});
