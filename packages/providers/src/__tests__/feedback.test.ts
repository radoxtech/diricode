import { describe, expect, it, vi } from "vitest";
import { LogFeedbackCollector } from "../feedback.js";

describe("LogFeedbackCollector", () => {
  it("submits feedback by logging to console", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const collector = new LogFeedbackCollector();
    await collector.submit({
      chatId: "test-chat-123",
      requestId: "550e8400-e29b-41d4-a716-446655440000",
      outcome: {
        success: true,
        tokenCount: { input: 100, output: 50 },
        latencyMs: 1200,
        costUsd: 0.003,
      },
    });

    expect(consoleSpy).toHaveBeenCalledWith("[feedback]", {
      chatId: "test-chat-123",
      requestId: "550e8400-e29b-41d4-a716-446655440000",
      outcome: {
        success: true,
        tokenCount: { input: 100, output: 50 },
        latencyMs: 1200,
        costUsd: 0.003,
      },
    });

    consoleSpy.mockRestore();
  });
});
