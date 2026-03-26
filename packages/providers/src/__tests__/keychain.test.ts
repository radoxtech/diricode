import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @napi-rs/keyring before importing the module under test
vi.mock("@napi-rs/keyring", () => {
  const mockEntry = vi.fn();
  mockEntry.prototype.getPassword = vi.fn().mockReturnValue(null);
  mockEntry.prototype.setPassword = vi.fn();
  mockEntry.prototype.deletePassword = vi.fn().mockReturnValue(true);

  return {
    Entry: mockEntry,
    findCredentials: vi.fn().mockReturnValue([]),
  };
});

import { KeychainService, KeychainUnavailableError } from "../copilot/keychain.js";
import { Entry, findCredentials } from "@napi-rs/keyring";

describe("KeychainService", () => {
  let service: KeychainService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new KeychainService();
  });

  describe("get()", () => {
    it("returns null when entry not found (getPassword returns null)", () => {
      vi.mocked(Entry.prototype.getPassword).mockReturnValue(null);
      const result = service.get("diricode", "github-token");
      expect(result).toBeNull();
    });

    it("returns the password when entry exists", () => {
      vi.mocked(Entry.prototype.getPassword).mockReturnValue("ghp_test_token");
      const result = service.get("diricode", "github-token");
      expect(result).toBe("ghp_test_token");
    });

    it("constructs Entry with correct service and account", () => {
      vi.mocked(Entry.prototype.getPassword).mockReturnValue(null);
      service.get("my-service", "my-account");
      expect(Entry).toHaveBeenCalledWith("my-service", "my-account");
    });

    it("returns null when keychain throws (unavailable)", () => {
      vi.mocked(Entry.prototype.getPassword).mockImplementation(() => {
        throw new Error("Keychain unavailable");
      });
      const result = service.get("diricode", "github-token");
      expect(result).toBeNull();
    });
  });

  describe("set()", () => {
    it("calls Entry.setPassword with the value", () => {
      service.set("diricode", "github-token", "ghp_new_token");
      expect(Entry.prototype.setPassword).toHaveBeenCalledWith("ghp_new_token");
    });

    it("constructs Entry with correct service and account", () => {
      service.set("my-service", "my-account", "secret");
      expect(Entry).toHaveBeenCalledWith("my-service", "my-account");
    });

    it("throws KeychainUnavailableError when keychain is unavailable", () => {
      vi.mocked(Entry.prototype.setPassword).mockImplementation(() => {
        throw new Error("Keychain service unreachable");
      });
      expect(() => service.set("diricode", "github-token", "token")).toThrow(
        KeychainUnavailableError,
      );
    });
  });

  describe("delete()", () => {
    it("calls Entry.deletePassword", () => {
      vi.mocked(Entry.prototype.deletePassword).mockReturnValue(true);
      const result = service.delete("diricode", "github-token");
      expect(Entry.prototype.deletePassword).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("returns false when entry does not exist", () => {
      vi.mocked(Entry.prototype.deletePassword).mockReturnValue(false);
      const result = service.delete("diricode", "github-token");
      expect(result).toBe(false);
    });

    it("returns false gracefully when keychain throws", () => {
      vi.mocked(Entry.prototype.deletePassword).mockImplementation(() => {
        throw new Error("Keychain unavailable");
      });
      const result = service.delete("diricode", "github-token");
      expect(result).toBe(false);
    });
  });

  describe("getAll()", () => {
    it("returns empty array when no credentials found", () => {
      vi.mocked(findCredentials).mockReturnValue([]);
      const result = service.getAll("diricode");
      expect(result).toEqual([]);
    });

    it("returns credentials found for the service", () => {
      vi.mocked(findCredentials).mockReturnValue([
        { account: "github-token", password: "ghp_abc" },
        { account: "other-account", password: "secret" },
      ]);
      const result = service.getAll("diricode");
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ account: "github-token", password: "ghp_abc" });
    });

    it("calls findCredentials with the service name", () => {
      vi.mocked(findCredentials).mockReturnValue([]);
      service.getAll("my-service");
      expect(findCredentials).toHaveBeenCalledWith("my-service");
    });

    it("returns empty array when findCredentials throws", () => {
      vi.mocked(findCredentials).mockImplementation(() => {
        throw new Error("Keychain unavailable");
      });
      const result = service.getAll("diricode");
      expect(result).toEqual([]);
    });
  });
});
