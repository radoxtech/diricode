import { describe, it, expect } from "vitest";
import { validateFlags, flagsToConfigOverlay } from "../flags.js";

describe("validateFlags", () => {
  it("accepts empty object and returns empty flags", () => {
    const result = validateFlags({});
    expect(result).toEqual({});
  });

  it("accepts all valid flag values", () => {
    const result = validateFlags({
      session: "sess-123",
      config: "/path/to/config.jsonc",
      provider: "openai",
      mode: "safe",
      model: "gpt-4o",
      json: true,
      verbose: false,
    });
    expect(result.session).toBe("sess-123");
    expect(result.config).toBe("/path/to/config.jsonc");
    expect(result.provider).toBe("openai");
    expect(result.mode).toBe("safe");
    expect(result.model).toBe("gpt-4o");
    expect(result.json).toBe(true);
    expect(result.verbose).toBe(false);
  });

  it("accepts all valid provider values", () => {
    const providers = [
      "openai",
      "anthropic",
      "google",
      "mistral",
      "cohere",
      "groq",
      "ollama",
      "azure-openai",
    ] as const;
    for (const provider of providers) {
      const result = validateFlags({ provider });
      expect(result.provider).toBe(provider);
    }
  });

  it("accepts all valid mode presets", () => {
    for (const mode of ["safe", "yolo", "auto"] as const) {
      const result = validateFlags({ mode });
      expect(result.mode).toBe(mode);
    }
  });

  it("throws ZodError for invalid provider", () => {
    expect(() => validateFlags({ provider: "invalid-provider" })).toThrow();
  });

  it("throws ZodError for invalid mode", () => {
    expect(() => validateFlags({ mode: "turbo" })).toThrow();
  });

  it("throws ZodError for empty session string", () => {
    expect(() => validateFlags({ session: "" })).toThrow();
  });

  it("throws ZodError for empty model string", () => {
    expect(() => validateFlags({ model: "" })).toThrow();
  });
});

describe("flagsToConfigOverlay", () => {
  it("returns empty object when no flags set", () => {
    const overlay = flagsToConfigOverlay({});
    expect(overlay).toEqual({});
  });

  it("maps --verbose to workMode.verbosity = verbose", () => {
    const overlay = flagsToConfigOverlay({ verbose: true });
    expect(overlay.workMode?.verbosity).toBe("verbose");
  });

  it("maps --provider to providers map", () => {
    const overlay = flagsToConfigOverlay({ provider: "anthropic" });
    expect(overlay.providers).toBeDefined();
    expect("anthropic" in (overlay.providers ?? {})).toBe(true);
  });

  it("maps --model to agents.default.model", () => {
    const overlay = flagsToConfigOverlay({ model: "claude-3-5-sonnet" });
    expect(overlay.agents?.default?.model).toBe("claude-3-5-sonnet");
  });

  it("maps --mode safe to correct workMode dimensions", () => {
    const overlay = flagsToConfigOverlay({ mode: "safe" });
    expect(overlay.workMode?.autonomy).toBe("manual");
    expect(overlay.workMode?.riskTolerance).toBe("safe");
    expect(overlay.workMode?.creativity).toBe("precise");
  });

  it("maps --mode yolo to full-auto workMode dimensions", () => {
    const overlay = flagsToConfigOverlay({ mode: "yolo" });
    expect(overlay.workMode?.autonomy).toBe("full-auto");
    expect(overlay.workMode?.riskTolerance).toBe("aggressive");
    expect(overlay.workMode?.creativity).toBe("exploratory");
  });

  it("maps --mode auto to semi-auto workMode dimensions", () => {
    const overlay = flagsToConfigOverlay({ mode: "auto" });
    expect(overlay.workMode?.autonomy).toBe("semi-auto");
    expect(overlay.workMode?.riskTolerance).toBe("moderate");
    expect(overlay.workMode?.creativity).toBe("balanced");
  });

  it("--verbose overrides verbosity from --mode preset", () => {
    const overlay = flagsToConfigOverlay({ mode: "yolo", verbose: true });
    expect(overlay.workMode?.verbosity).toBe("verbose");
  });
});
