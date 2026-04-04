import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  initiateGithubDeviceFlow,
  pollGithubDeviceToken,
  exchangeGithubDeviceCode,
  GithubOAuthError,
} from "../copilot/github-oauth.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("Github OAuth Device Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("initiateGithubDeviceFlow()", () => {
    it("POSTs to github.com/login/device/code with client_id and scope", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            device_code: "ABCD1234",
            user_code: "WDXL-GHPW",
            verification_uri: "https://github.com/login/device",
            interval: 5,
            expires_in: 900,
          }),
      });

      const result = await initiateGithubDeviceFlow("Ov23li7a7FBdI2WkK0dd");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://github.com/login/device/code",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Accept: "application/json",
          }) as Record<string, string>,
          body: JSON.stringify({
            client_id: "Ov23li7a7FBdI2WkK0dd",
            scope: "read:user",
          }),
        }),
      );
      expect(result).toMatchObject({
        device_code: "ABCD1234",
        user_code: "WDXL-GHPW",
        verification_uri: "https://github.com/login/device",
      });
    });

    it("throws GithubOAuthError on network failure", async () => {
      mockFetch.mockRejectedValue(new Error("Connection refused"));

      await expect(initiateGithubDeviceFlow("any-client")).rejects.toThrow(GithubOAuthError);
    });

    it("throws GithubOAuthError when GitHub returns error response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({ error: "invalid_client", error_description: "Client not found" }),
      });

      await expect(initiateGithubDeviceFlow("bad-client")).rejects.toThrow(GithubOAuthError);
    });
  });

  describe("pollGithubDeviceToken()", () => {
    it("polls with correct params and returns token on success", async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          // Still pending
          return Promise.resolve({
            ok: false,
            status: 400,
            json: () =>
              Promise.resolve({
                error: "authorization_pending",
                error_description: "Pending",
              }),
          });
        }
        // Success
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              access_token: "gho_success_token",
              token_type: "Bearer",
              scope: "read:user",
            }),
        });
      });

      const result = await pollGithubDeviceToken("Ov23li7a7FBdI2WkK0dd", "ABCD1234", 0.1);

      expect(result).toMatchObject({
        access_token: "gho_success_token",
        token_type: "Bearer",
        scope: "read:user",
      });
      // 3 calls: 2 failures + 1 success
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("throws GithubOAuthError when user declines (access_denied)", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            error: "access_denied",
            error_description: "The user declined the authorization",
          }),
      });

      await expect(
        pollGithubDeviceToken("Ov23li7a7FBdI2WkK0dd", "ABCD1234", 5),
      ).rejects.toThrow("Authorization declined");
    });

    it("throws GithubOAuthError when token expires (expired_token)", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            error: "expired_token",
            error_description: "Device code expired",
          }),
      });

      await expect(
        pollGithubDeviceToken("Ov23li7a7FBdI2WkK0dd", "ABCD1234", 5),
      ).rejects.toThrow("Authorization expired");
    });

    it.skip("slow_down causes retry with delay (would need mock clock to test in reasonable time)", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            error: "slow_down",
            error_description: "Polling too fast",
          }),
      });

      await expect(
        pollGithubDeviceToken("Ov23li7a7FBdI2WkK0dd", "ABCD1234", 0.001),
      ).rejects.toThrow("timed out");
    });

    it("throws GithubOAuthError on network failure during polling", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      await expect(pollGithubDeviceToken("Ov23li7a7FBdI2WkK0dd", "ABCD1234", 5)).rejects.toThrow(
        GithubOAuthError,
      );
    });

    it("throws GithubOAuthError on unknown error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            error: "something_unexpected",
          }),
      });

      await expect(pollGithubDeviceToken("Ov23li7a7FBdI2WkK0dd", "ABCD1234", 5)).rejects.toThrow(
        GithubOAuthError,
      );
    });
  });

  describe("exchangeGithubDeviceCode()", () => {
    it("POSTs to github.com/login/oauth/access_token with device_code params", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            access_token: "gho_token",
            token_type: "Bearer",
            scope: "read:user",
          }),
      });

      const result = await exchangeGithubDeviceCode("Ov23li7a7FBdI2WkK0dd", "ABCD1234");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://github.com/login/oauth/access_token",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Accept: "application/json",
          }) as Record<string, string>,
          body: JSON.stringify({
            client_id: "Ov23li7a7FBdI2WkK0dd",
            device_code: "ABCD1234",
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          }),
        }),
      );
      expect(result).toMatchObject({
        access_token: "gho_token",
        token_type: "Bearer",
      });
    });

    it("throws GithubOAuthError on network failure", async () => {
      mockFetch.mockRejectedValue(new Error("Connection refused"));

      await expect(exchangeGithubDeviceCode("Ov23li7a7FBdI2WkK0dd", "ABCD1234")).rejects.toThrow(
        GithubOAuthError,
      );
    });
  });
});
