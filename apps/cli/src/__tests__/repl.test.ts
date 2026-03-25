import { describe, it, expect } from "vitest";
import { type ReplOptions, type ReplStatus } from "../commands/repl.js";

describe("ReplStatus", () => {
  it("has correct shape", () => {
    const status: ReplStatus = {
      session: "test-session",
      mode: "streaming",
      historySize: 42,
    };
    expect(status.session).toBe("test-session");
    expect(status.mode).toBe("streaming");
    expect(status.historySize).toBe(42);
  });

  it("has idle mode", () => {
    const status: ReplStatus = { session: null, mode: "idle", historySize: 0 };
    expect(status.mode).toBe("idle");
  });
});

describe("ReplOptions", () => {
  it("accepts session option", () => {
    const options: ReplOptions = { session: "my-session" };
    expect(options.session).toBe("my-session");
  });

  it("accepts empty options", () => {
    const options: ReplOptions = {};
    expect(options.session).toBeUndefined();
  });
});
