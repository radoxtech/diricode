import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@diricode/providers", () => ({
  KeychainService: vi.fn().mockImplementation(() => ({
    delete: vi.fn().mockReturnValue(true),
  })),
  KEYCHAIN_SERVICE: "diricode",
  KEYCHAIN_ACCOUNT: "github-token",
}));

import { KeychainService } from "@diricode/providers";
import { runLogout } from "../commands/logout.js";

describe("runLogout", () => {
  let keychainDeleteMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    keychainDeleteMock = vi.fn();
    vi.mocked(KeychainService).mockImplementation(
      () =>
        ({
          delete: keychainDeleteMock,
        }) as unknown as InstanceType<typeof KeychainService>,
    );
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  it("deletes the token and shows confirmation when token exists", async () => {
    keychainDeleteMock.mockReturnValue(true);

    await runLogout();

    expect(keychainDeleteMock).toHaveBeenCalledWith("diricode", "github-token");
    expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining("logged out"));
  });

  it("shows already-logged-out message when no token found", async () => {
    keychainDeleteMock.mockReturnValue(false);

    await runLogout();

    expect(keychainDeleteMock).toHaveBeenCalledWith("diricode", "github-token");
    expect(process.stdout.write).toHaveBeenCalledWith(
      expect.stringContaining("already logged out"),
    );
  });
});
