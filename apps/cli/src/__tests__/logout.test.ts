import { describe, it, expect, vi, beforeEach } from "vitest";

const mockKeychainDelete = vi.hoisted(() => vi.fn<() => boolean>());

vi.mock("@diricode/providers", () => {
  function MockKeychain() {}
  MockKeychain.prototype.delete = mockKeychainDelete;

  return {
    KeychainService: MockKeychain,
    KEYCHAIN_SERVICE: "diricode",
    KEYCHAIN_ACCOUNT: "github-token",
    KeychainUnavailableError: class KeychainUnavailableError extends Error {},
  };
});

import { runLogout } from "../commands/logout.js";

describe("runLogout()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes the keychain entry and reports success", async () => {
    mockKeychainDelete.mockReturnValue(true);
    const out: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((s) => {
      out.push(String(s));
      return true;
    });
    await runLogout();
    expect(mockKeychainDelete).toHaveBeenCalledWith("diricode", "github-token");
    expect(out.join("")).toContain("Logged out successfully");
  });

  it("reports no token when delete returns false", async () => {
    mockKeychainDelete.mockReturnValue(false);
    const out: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((s) => {
      out.push(String(s));
      return true;
    });
    await runLogout();
    expect(out.join("")).toContain("No keychain token found");
  });

  it("handles KeychainUnavailableError gracefully", async () => {
    const { KeychainUnavailableError } = await import("@diricode/providers");
    mockKeychainDelete.mockImplementation(() => {
      throw new KeychainUnavailableError("unavailable");
    });
    const out: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((s) => {
      out.push(String(s));
      return true;
    });
    await runLogout();
    expect(out.join("")).toContain("No keychain token found");
  });
});
