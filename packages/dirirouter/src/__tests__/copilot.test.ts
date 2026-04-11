import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetPassword = vi.hoisted(() => vi.fn<() => string | null>().mockReturnValue(null));

vi.mock("@napi-rs/keyring", () => {
  class MockEntry {
    getPassword = mockGetPassword;
    setPassword = vi.fn();
    deletePassword = vi.fn<() => boolean>().mockReturnValue(true);
  }

  return {
    Entry: MockEntry,
    findCredentials: vi.fn().mockReturnValue([]),
  };
});

const mockListModels = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockStart = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockStop = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@github/copilot-sdk", () => {
  class MockCopilotClient {
    listModels = mockListModels;
    start = mockStart;
    stop = mockStop;
    createSession = vi.fn();
  }
  return {
    CopilotClient: MockCopilotClient,
    approveAll: vi.fn(),
  };
});

import { CopilotProvider, createCopilotProvider } from "../copilot/adapter.js";
import { getGithubToken, hasGithubAuth } from "../copilot/auth.js";
import { ClassifiedError, Registry, ProviderPriorities } from "../index.js";
import * as auth from "../copilot/auth.js";

describe("CopilotProvider", () => {
  beforeEach(() => {
    vi.spyOn(auth, "getGithubTokenFromKeychain").mockReturnValue(undefined);
    mockListModels.mockReset().mockResolvedValue([]);
    mockStart.mockReset().mockResolvedValue(undefined);
    mockStop.mockReset().mockResolvedValue(undefined);
  });

  describe("constructor", () => {
    it("creates provider with default model gpt-4.1", () => {
      const provider = new CopilotProvider("test-token");
      expect(provider.name).toBe("copilot");
      expect(provider.defaultModel.modelId).toBe("gpt-4.1");
    });

    it("accepts explicit token", () => {
      const provider = new CopilotProvider("my-token");
      expect(provider.name).toBe("copilot");
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

  describe("listModels", () => {
    it("returns models from SDK client", async () => {
      mockListModels.mockResolvedValue([
        { id: "gpt-4.1", name: "GPT 4.1", capabilities: {} },
        { id: "claude-sonnet-4", name: "Claude Sonnet 4", capabilities: {} },
      ]);
      const provider = new CopilotProvider("test-token");
      const models = await provider.listModels();
      expect(models).toHaveLength(2);
      if (!models[0]) throw new Error("Expected models[0] to exist");
      if (!models[1]) throw new Error("Expected models[1] to exist");
      expect(models[0].id).toBe("gpt-4.1");
      expect(models[1].id).toBe("claude-sonnet-4");
      expect(mockStart).toHaveBeenCalled();
    });
  });

  describe("generate", () => {
    it("throws ClassifiedError when no token is available", async () => {
      vi.stubEnv("DC_GITHUB_TOKEN", "");
      vi.stubEnv("GITHUB_TOKEN", "");
      vi.stubEnv("GH_TOKEN", "");

      const provider = new CopilotProvider();
      const request = provider.generate({ prompt: "Hello" });

      await expect(request).rejects.toMatchObject({
        kind: "auth_error",
        provider: "copilot",
        model: "gpt-4.1",
        retryable: false,
      });
      await expect(request).rejects.toBeInstanceOf(ClassifiedError);
    });
  });

  describe("stream", () => {
    it("throws ClassifiedError when no token is available", async () => {
      vi.stubEnv("DC_GITHUB_TOKEN", "");
      vi.stubEnv("GITHUB_TOKEN", "");
      vi.stubEnv("GH_TOKEN", "");

      const provider = new CopilotProvider();
      const stream = provider.stream({ prompt: "Hello" });

      await expect(stream[Symbol.asyncIterator]().next()).rejects.toMatchObject({
        kind: "auth_error",
        provider: "copilot",
        model: "gpt-4.1",
        retryable: false,
      });
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
