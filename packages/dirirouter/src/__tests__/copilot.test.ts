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
    it("creates provider with default model gpt-4o", () => {
      const provider = new CopilotProvider("test-token");
      expect(provider.name).toBe("copilot");
      expect(provider.defaultModel.modelId).toBe("gpt-4o");
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
        { id: "gpt-4o", name: "GPT-4o", capabilities: {} },
        { id: "claude-3.5-sonnet", name: "Claude 3.5 Sonnet", capabilities: {} },
      ]);
      const provider = new CopilotProvider("test-token");
      const models = await provider.listModels();
      expect(models).toHaveLength(2);
      if (!models[0]) throw new Error("Expected models[0] to exist");
      if (!models[1]) throw new Error("Expected models[1] to exist");
      expect(models[0].id).toBe("gpt-4o");
      expect(models[1].id).toBe("claude-3.5-sonnet");
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
        model: "gpt-4o",
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
        model: "gpt-4o",
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

  describe("discoverAvailability", () => {
    it("returns unavailable status when no token is available", async () => {
      vi.stubEnv("DC_GITHUB_TOKEN", "");
      vi.stubEnv("GITHUB_TOKEN", "");
      vi.stubEnv("GH_TOKEN", "");
      const provider = new CopilotProvider();
      const result = await provider.discoverAvailability();
      expect(result.status.available).toBe(false);
      expect(result.availabilities).toHaveLength(0);
      expect(result.status.error).toContain("No token");
    });

    it("maps live models to provider-produced availabilities", async () => {
      mockListModels.mockResolvedValue([
        {
          id: "gpt-5.4",
          name: "GPT-5.4",
          capabilities: { tool_calls: true, streaming: true, vision: false },
        },
        {
          id: "claude-sonnet-4.6",
          name: "Claude Sonnet 4.6",
          capabilities: { tool_calls: true, streaming: true, vision: true },
        },
      ]);

      const provider = new CopilotProvider("test-token");
      const result = await provider.discoverAvailability();

      expect(result.status.available).toBe(true);
      expect(result.availabilities).toHaveLength(2);
      expect(result.availabilities[0]?.model_id).toBe("gpt-5.4");
      expect(result.availabilities[0]?.provider).toBe("copilot");
      expect(result.availabilities[1]?.model_id).toBe("claude-sonnet-4.6");
      expect(result.availabilities[1]?.supports_vision).toBe(true);
      expect(mockStop).toHaveBeenCalled();
    });

    it("deduplicates models by id", async () => {
      mockListModels.mockResolvedValue([
        { id: "gpt-4o", name: "GPT-4o", capabilities: {} },
        { id: "gpt-4o", name: "GPT-4o dup", capabilities: {} },
      ]);

      const provider = new CopilotProvider("test-token");
      const result = await provider.discoverAvailability();

      expect(result.availabilities).toHaveLength(1);
      expect(result.availabilities[0]?.model_id).toBe("gpt-4o");
    });

    it("returns error status when listModels throws", async () => {
      mockListModels.mockRejectedValue(new Error("Network error"));
      const provider = new CopilotProvider("test-token");
      const result = await provider.discoverAvailability();

      expect(result.status.available).toBe(false);
      expect(result.status.error).toContain("Network error");
      expect(result.availabilities).toHaveLength(0);
      expect(mockStop).toHaveBeenCalled();
    });

    it("does not depend on hardcoded fallback constants", async () => {
      mockListModels.mockResolvedValue([
        { id: "totally-new-model", name: "New", capabilities: {} },
      ]);

      const provider = new CopilotProvider("test-token");
      const result = await provider.discoverAvailability();

      expect(result.status.available).toBe(true);
      expect(result.availabilities[0]?.model_id).toBe("totally-new-model");
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
