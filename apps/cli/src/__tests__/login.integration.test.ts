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
    if (name === "kimi") {
      return {
        name: "kimi",
        authMethod: "api_key",
        envVars: ["DC_KIMI_API_KEY"],
        isLoggedIn: () => true,
        login: vi.fn().mockResolvedValue(undefined),
        description: "Moonshot Kimi via API key",
      };
    }
    return undefined;
  }),
}));

import { runLogin } from "../commands/login.js";

describe("login integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows selecting a provider", async () => {
    const { select } = await import("@inquirer/prompts");
    vi.mocked(select).mockResolvedValue("copilot");

    await runLogin({});

    expect(select).toHaveBeenCalled();
  });
});
