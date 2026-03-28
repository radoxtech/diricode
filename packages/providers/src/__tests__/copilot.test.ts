import { describe, expect, it, vi } from "vitest";

const mockGetPassword = vi.hoisted(() => vi.fn<() => string | null>().mockReturnValue(null));

vi.mock("@napi-rs/keyring", () => {
  class MockEntry {
    getPassword = mockGetPassword;
    setPassword = vi.fn();
    deletePassword = vi.fn<() => boolean>().mockReturnValue(true);
  }
  return { Entry: MockEntry, findCredentials: vi.fn().mockReturnValue([]) };
});

import { CopilotProvider, createCopilotProvider } from "../copilot/adapter.js";
import { DEFAULT_COPILOT_MODEL, getGithubModelInfo, isKnownModel } from "../copilot/models.js";
import { getGithubToken, hasGithubAuth } from "../copilot/auth.js";
import { Registry, ProviderPriorities } from "../index.js";

describe("CopilotProvider", () => {
  describe("constructor", () => {
    it("creates provider with default model", () => {
      const provider = new CopilotProvider("test-token");
      expect(provider.name).toBe("copilot");
      expect(provider.defaultModel.modelId).toBe(DEFAULT_COPILOT_MODEL);
    });

    it("accepts explicit token", () => {
      const provider = new CopilotProvider("my-token");
      expect(provider.isAvailable()).toBe(true);
    });
  });

  describe("isAvailable", () => {
    it("returns false when no token provided and no env var", () => {
      vi.stubEnv("DC_GITHUB_TOKEN", "");
      vi.stubEnv("GITHUB_TOKEN", "");
      vi.stubEnv("GH_TOKEN", "");
      const provider = new CopilotProvider();
      expect(provider.isAvailable()).toBe(false);
    });

    it("returns true when token provided", () => {
      const provider = new CopilotProvider("test-token");
      expect(provider.isAvailable()).toBe(true);
    });
  });

  describe("model resolution", () => {
    it("resolves known model gpt-5-mini", () => {
      const info = getGithubModelInfo("gpt-5-mini");
      expect(info).toBeDefined();
      expect(info?.modelId).toBe("openai/gpt-5-mini");
    });

    it("returns undefined for unknown model", () => {
      const info = getGithubModelInfo("unknown-model");
      expect(info).toBeUndefined();
    });

    it("isKnownModel returns true for known models", () => {
      expect(isKnownModel("gpt-5-mini")).toBe(true);
      expect(isKnownModel("claude-3.5-sonnet")).toBe(true);
      expect(isKnownModel("grok-3")).toBe(true);
    });

    it("isKnownModel returns false for unknown models", () => {
      expect(isKnownModel("unknown-model")).toBe(false);
    });
  });

  describe("registration in Registry", () => {
    it("registers successfully with priority 1", () => {
      const reg = new Registry();
      const provider = new CopilotProvider("test-token");
      reg.register(provider, ProviderPriorities.COPILOT);
      expect(reg.has("copilot")).toBe(true);
      expect(reg.getDefault()).toBe(provider);
    });

    it("throws when registering duplicate", () => {
      const reg = new Registry();
      const provider = new CopilotProvider("test-token");
      reg.register(provider, ProviderPriorities.COPILOT);
      expect(() => reg.register(provider, ProviderPriorities.COPILOT)).toThrow();
    });
  });

  describe("createCopilotProvider", () => {
    it("creates a CopilotProvider instance", () => {
      const provider = createCopilotProvider("test-token");
      expect(provider.name).toBe("copilot");
    });
  });
});

describe("auth helpers", () => {
  it("getGithubToken returns undefined when no env vars set", () => {
    vi.stubEnv("DC_GITHUB_TOKEN", "");
    vi.stubEnv("GITHUB_TOKEN", "");
    vi.stubEnv("GH_TOKEN", "");
    expect(getGithubToken()).toBeUndefined();
  });

  it("hasGithubAuth returns false when no token", () => {
    vi.stubEnv("DC_GITHUB_TOKEN", "");
    vi.stubEnv("GITHUB_TOKEN", "");
    vi.stubEnv("GH_TOKEN", "");
    expect(hasGithubAuth()).toBe(false);
  });
});
