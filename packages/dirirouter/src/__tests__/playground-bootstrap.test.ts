import { describe, expect, test } from "vitest";
import { buildCopilotAvailability } from "../playground/bootstrap.js";

describe("buildCopilotAvailability", () => {
  test("creates availability for a model with full capabilities", () => {
    const result = buildCopilotAvailability({
      id: "gpt-4o",
      capabilities: { tool_calls: true, streaming: true, vision: true },
    });

    expect(result.model_id).toBe("gpt-4o");
    expect(result.provider).toBe("copilot");
    expect(result.family).toBe("gpt-standard");
    expect(result.stability).toBe("stable");
    expect(result.available).toBe(true);
    expect(result.context_window).toBe(200_000);
    expect(result.supports_tool_calling).toBe(true);
    expect(result.supports_vision).toBe(true);
    expect(result.supports_structured_output).toBe(true);
    expect(result.supports_streaming).toBe(true);
    expect(result.input_cost_per_1k).toBe(0);
    expect(result.output_cost_per_1k).toBe(0);
    expect(result.trusted).toBe(true);
    expect(result.id).toBe("copilot-gpt-4o");
  });

  test("derives family as gpt-reasoning for o-series models", () => {
    const result = buildCopilotAvailability({
      id: "o1-preview",
      capabilities: { tool_calls: false, streaming: false, vision: false },
    });

    expect(result.family).toBe("gpt-reasoning");
    expect(result.stability).toBe("preview");
  });

  test("derives family as claude-sonnet for claude models", () => {
    const result = buildCopilotAvailability({
      id: "claude-sonnet-4",
      capabilities: { tool_calls: true, streaming: true, vision: true },
    });

    expect(result.family).toBe("claude-sonnet");
    expect(result.stability).toBe("stable");
  });

  test("defaults capabilities to true when not provided", () => {
    const result = buildCopilotAvailability({ id: "unknown-model" });

    expect(result.supports_tool_calling).toBe(true);
    expect(result.supports_streaming).toBe(true);
    expect(result.supports_structured_output).toBe(true);
    expect(result.supports_vision).toBe(false);
  });

  test("uses tool_calling alias from capabilities", () => {
    const result = buildCopilotAvailability({
      id: "model-with-tool-calling",
      capabilities: { tool_calling: true, streaming: false, vision: false },
    });

    expect(result.supports_tool_calling).toBe(true);
  });
});
