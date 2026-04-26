import { describe, expect, test } from "vitest";
import { PickRequestSchema, ChatRequestSchema } from "../playground/types.js";
import { renderPlayground } from "../playground/html.js";
import { SEMANTIC_EXPLAINABILITY_VISIBILITY_THRESHOLD } from "../llm-picker/model-resolver.js";

describe("PickRequestSchema", () => {
  test("playground form includes default agent.id field", () => {
    const html = renderPlayground();
    expect(html).toContain('name="agent.id"');
    expect(html).toContain('value="playground-agent"');
  });

  test("valid PickRequest passes validation", () => {
    const validPickRequest = {
      agent: { id: "agent-1", role: "coder" },
      task: { type: "code", description: "Write a function" },
      modelDimensions: {
        tier: "heavy",
        modelAttributes: ["reasoning", "quality"],
        fallbackType: null,
      },
    };
    expect(() => PickRequestSchema.parse(validPickRequest)).not.toThrow();
  });

  test("PickRequest missing required field modelDimensions throws ZodError", () => {
    const invalidPickRequest = {
      agent: { role: "coder" },
      task: { type: "code" },
    };
    expect(() => PickRequestSchema.parse(invalidPickRequest)).toThrow();
  });

  test("PickRequest with invalid tier throws ZodError", () => {
    const invalidPickRequest = {
      agent: { role: "coder" },
      task: { type: "code" },
      modelDimensions: {
        tier: "invalid-tier",
        modelAttributes: [],
        fallbackType: null,
      },
    };
    expect(() => PickRequestSchema.parse(invalidPickRequest)).toThrow();
  });
});

describe("ChatRequestSchema", () => {
  test("valid ChatRequest passes validation", () => {
    const validChatRequest = {
      prompt: "Hello, world!",
      provider: "gemini",
      model: "gemini-pro",
      maxTokens: 100,
      temperature: 1.5,
    };
    expect(() => ChatRequestSchema.parse(validChatRequest)).not.toThrow();
  });

  test("ChatRequest with temperature > 2 throws ZodError", () => {
    const invalidChatRequest = {
      prompt: "Hello",
      temperature: 3,
    };
    expect(() => ChatRequestSchema.parse(invalidChatRequest)).toThrow();
  });

  test("ChatRequest with empty prompt throws ZodError", () => {
    const invalidChatRequest = {
      prompt: "",
    };
    expect(() => ChatRequestSchema.parse(invalidChatRequest)).toThrow();
  });
});

describe("renderPlayground semantic visibility", () => {
  test("embeds semantic visibility threshold and hides weak semantic cards", () => {
    const html = renderPlayground();
    expect(html).toContain(
      `const SEMANTIC_VISIBILITY_THRESHOLD = ${SEMANTIC_EXPLAINABILITY_VISIBILITY_THRESHOLD};`,
    );
    expect(html).toContain("function isSemanticExplainabilityVisible(bd)");
    expect(html).toContain("if (isSemanticExplainabilityVisible(bd)) {");
    expect(html).toContain(
      ".filter(c => c.status !== 'excluded' && isSemanticExplainabilityVisible(c.scoresBreakdown))",
    );
  });
});
