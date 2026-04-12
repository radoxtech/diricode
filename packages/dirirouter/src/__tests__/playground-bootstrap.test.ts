import { describe, expect, test } from "vitest";
import type { ModelCard } from "../contracts/model-card.js";
import { buildCopilotModelCard } from "../playground/bootstrap.js";

describe("buildCopilotModelCard", () => {
  test("reuses matching static card metadata when model exists", () => {
    const staticCard: ModelCard = {
      model: "gpt-4o",
      family: "gpt-reasoning",
      capabilities: {
        tool_calling: true,
        streaming: true,
        json_mode: true,
        vision: true,
        max_context: 128_000,
      },
      reasoning_levels: ["low", "medium", "high"],
      known_for: {
        roles: ["coder"],
        complexities: ["moderate"],
        specializations: [],
      },
      benchmarks: {
        quality: { by_complexity_role: {}, by_specialization: {} },
        speed: { tokens_per_second_avg: 0, feedback_count: 0 },
      },
      pricing_tier: "standard",
      learned_from: 0,
    };

    const result = buildCopilotModelCard({ id: "gpt-4o" }, [staticCard]);
    expect(result).toBe(staticCard);
  });

  test("creates fallback metadata for live models not present in static list", () => {
    const result = buildCopilotModelCard(
      {
        id: "claude-sonnet-4",
        capabilities: { tool_calls: true, streaming: true, vision: true },
      },
      [],
    );

    expect(result.model).toBe("claude-sonnet-4");
    expect(result.family).toBe("claude");
    expect(result.capabilities.vision).toBe(true);
    expect(result.pricing_tier).toBe("standard");
  });
});
