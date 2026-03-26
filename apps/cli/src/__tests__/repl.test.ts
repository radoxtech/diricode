import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { type ReplOptions, type ReplStatus } from "../commands/repl.js";

vi.mock("@diricode/providers", () => ({
  hasGithubAuth: vi.fn<() => boolean>().mockReturnValue(true),
}));

vi.mock("node:readline/promises", () => ({
  createInterface: vi.fn().mockReturnValue({
    question: vi.fn().mockResolvedValue("/exit"),
    close: vi.fn(),
  }),
}));

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

describe("startRepl() auth prompt", () => {
  let consoleOutput: string[];
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleOutput = [];
    consoleSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      consoleOutput.push(args.map(String).join(" "));
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    vi.clearAllMocks();
  });

  it("shows no-auth message when no GitHub token and promptOnMissing is default", async () => {
    vi.resetModules();
    vi.doMock("@diricode/providers", () => ({ hasGithubAuth: () => false }));
    vi.doMock("node:readline/promises", () => ({
      createInterface: vi.fn().mockReturnValue({
        question: vi.fn().mockResolvedValue("/exit"),
        close: vi.fn(),
      }),
    }));
    const { startRepl } = await import("../commands/repl.js");
    const config = {} as import("@diricode/core").DiriCodeConfig;
    await startRepl(config, {});
    expect(consoleOutput.some((line) => line.includes("No GitHub token found"))).toBe(true);
  });

  it("shows no message when GitHub token is present", async () => {
    vi.resetModules();
    vi.doMock("@diricode/providers", () => ({ hasGithubAuth: () => true }));
    vi.doMock("node:readline/promises", () => ({
      createInterface: vi.fn().mockReturnValue({
        question: vi.fn().mockResolvedValue("/exit"),
        close: vi.fn(),
      }),
    }));
    const { startRepl } = await import("../commands/repl.js");
    const config = {} as import("@diricode/core").DiriCodeConfig;
    consoleOutput = [];
    await startRepl(config, {});
    expect(consoleOutput.some((line) => line.includes("No GitHub token found"))).toBe(false);
  });
});
