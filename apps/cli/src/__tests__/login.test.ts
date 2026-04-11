import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@inquirer/prompts", () => ({
  select: vi.fn(),
}));

vi.mock("../providers/login-providers.js", () => ({
  LOGIN_PROVIDERS: [
    {
      name: "copilot",
      authMethod: "oauth",
      envVars: ["GITHUB_TOKEN"],
      isLoggedIn: () => false,
      login: vi.fn().mockResolvedValue(undefined),
      description: "GitHub Copilot via OAuth",
    },
    {
      name: "kimi",
      authMethod: "api_key",
      envVars: ["DC_KIMI_API_KEY"],
      isLoggedIn: () => true,
      login: vi.fn().mockResolvedValue(undefined),
      description: "Moonshot Kimi via API key",
    },
  ],
  getLoginProvider: vi.fn((name: string) => {
    if (name === "copilot") {
      return {
        name: "copilot",
        authMethod: "oauth",
        envVars: ["GITHUB_TOKEN"],
        isLoggedIn: () => false,
        login: vi.fn().mockResolvedValue(undefined),
        description: "GitHub Copilot via OAuth",
      };
    }
    return undefined;
  }),
}));

import { runLogin } from "../commands/login.js";

describe("runLogin()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows provider selection when no provider specified", async () => {
    const { select } = await import("@inquirer/prompts");
    vi.mocked(select).mockResolvedValue("copilot");

    await runLogin({});

    expect(select).toHaveBeenCalled();
  });

  it("logs in specified provider", async () => {
    const { getLoginProvider } = await import("../providers/login-providers.js");
    const mockLogin = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getLoginProvider).mockReturnValue({
      name: "copilot",
      authMethod: "oauth",
      envVars: ["GITHUB_TOKEN"],
      isLoggedIn: () => false,
      login: mockLogin,
      description: "GitHub Copilot via OAuth",
    });

    await runLogin({ provider: "copilot" });

    expect(mockLogin).toHaveBeenCalled();
  });

  it.skip("shows error for unknown provider", async () => {
    const errOut: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((s) => {
      errOut.push(String(s));
      return true;
    });

    await runLogin({ provider: "nonexistent" });

    expect(errOut.join("")).toContain("Unknown provider");
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});
