import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetPassword = vi.hoisted(() => vi.fn<() => string | null>().mockReturnValue(null));
const mockSetPassword = vi.hoisted(() => vi.fn());
const mockDeletePassword = vi.hoisted(() => vi.fn<() => boolean>().mockReturnValue(true));
const mockFindCredentials = vi.hoisted(() =>
  vi.fn<() => { account: string; password: string }[]>().mockReturnValue([]),
);

vi.mock("@napi-rs/keyring", () => {
  class MockEntry {
    getPassword = mockGetPassword;
    setPassword = mockSetPassword;
    deletePassword = mockDeletePassword;
  }

  return {
    Entry: MockEntry,
    findCredentials: mockFindCredentials,
  };
});

import { KeychainService, KeychainUnavailableError } from "../copilot/keychain.js";

describe("KeychainService", () => {
  let service: KeychainService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new KeychainService();
  });

  describe("get()", () => {
    it("returns null when entry not found (getPassword returns null)", () => {
      mockGetPassword.mockReturnValue(null);
      const result = service.get("diricode", "github-token");
      expect(result).toBeNull();
    });

    it("returns the password when entry exists", () => {
      mockGetPassword.mockReturnValue("ghp_test_token");
      const result = service.get("diricode", "github-token");
      expect(result).toBe("ghp_test_token");
    });

    it("constructs Entry with correct service and account", () => {
      mockGetPassword.mockReturnValue(null);
      service.get("my-service", "my-account");
      expect(mockGetPassword).toHaveBeenCalled();
    });

    it("returns null when keychain throws (unavailable)", () => {
      mockGetPassword.mockImplementation(() => {
        throw new Error("Keychain unavailable");
      });
      const result = service.get("diricode", "github-token");
      expect(result).toBeNull();
    });
  });

  describe("set()", () => {
    it("calls Entry.setPassword with the value", () => {
      service.set("diricode", "github-token", "ghp_new_token");
      expect(mockSetPassword).toHaveBeenCalledWith("ghp_new_token");
    });

    it("constructs Entry with correct service and account", () => {
      service.set("my-service", "my-account", "secret");
      expect(mockSetPassword).toHaveBeenCalled();
    });

    it("throws KeychainUnavailableError when keychain is unavailable", () => {
      mockSetPassword.mockImplementation(() => {
        throw new Error("Keychain service unreachable");
      });
      expect(() => {
        service.set("diricode", "github-token", "token");
      }).toThrow(KeychainUnavailableError);
    });
  });

  describe("delete()", () => {
    it("calls Entry.deletePassword", () => {
      mockDeletePassword.mockReturnValue(true);
      const result = service.delete("diricode", "github-token");
      expect(mockDeletePassword).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("returns false when entry does not exist", () => {
      mockDeletePassword.mockReturnValue(false);
      const result = service.delete("diricode", "github-token");
      expect(result).toBe(false);
    });

    it("returns false gracefully when keychain throws", () => {
      mockDeletePassword.mockImplementation(() => {
        throw new Error("Keychain unavailable");
      });
      const result = service.delete("diricode", "github-token");
      expect(result).toBe(false);
    });
  });

  describe("getAll()", () => {
    it("returns empty array when no credentials found", () => {
      mockFindCredentials.mockReturnValue([]);
      const result = service.getAll("diricode");
      expect(result).toEqual([]);
    });

    it("returns credentials found for the service", () => {
      mockFindCredentials.mockReturnValue([
        { account: "github-token", password: "ghp_abc" },
        { account: "other-account", password: "secret" },
      ]);
      const result = service.getAll("diricode");
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ account: "github-token", password: "ghp_abc" });
    });

    it("calls findCredentials with the service name", () => {
      mockFindCredentials.mockReturnValue([]);
      service.getAll("my-service");
      expect(mockFindCredentials).toHaveBeenCalledWith("my-service");
    });

    it("returns empty array when findCredentials throws", () => {
      mockFindCredentials.mockImplementation(() => {
        throw new Error("Keychain unavailable");
      });
      const result = service.getAll("diricode");
      expect(result).toEqual([]);
    });
  });
});
