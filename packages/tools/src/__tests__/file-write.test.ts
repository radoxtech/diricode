import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type ToolContext, ToolError, fileWriteTool } from "../index.js";

describe("fileWriteTool", () => {
  let workspaceRoot: string;
  const emittedEvents: { event: string; payload: unknown }[] = [];

  const makeContext = (): ToolContext => ({
    workspaceRoot,
    emit: (event: string, payload: unknown) => {
      emittedEvents.push({ event, payload });
    },
  });

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), "diricode-test-"));
    emittedEvents.length = 0;
  });

  afterEach(async () => {
    await rm(workspaceRoot, { recursive: true, force: true });
  });

  it("creates a new file and returns created: true with correct bytesWritten", async () => {
    const result = await fileWriteTool.execute(
      { path: "hello.txt", content: "hello", createParents: true },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.created).toBe(true);
    expect(result.data.bytesWritten).toBe(5);
  });

  it("overwrites an existing file and returns created: false", async () => {
    const ctx = makeContext();
    await fileWriteTool.execute(
      { path: "existing.txt", content: "first", createParents: true },
      ctx,
    );

    const result = await fileWriteTool.execute(
      { path: "existing.txt", content: "second content", createParents: true },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.created).toBe(false);
  });

  it("creates parent directories when createParents is true", async () => {
    const result = await fileWriteTool.execute(
      { path: "a/b/c/file.txt", content: "nested", createParents: true },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.created).toBe(true);
  });

  it("throws DIR_NOT_FOUND when parent missing and createParents is false", async () => {
    await expect(
      fileWriteTool.execute(
        { path: "nonexistent/dir/file.txt", content: "data", createParents: false },
        makeContext(),
      ),
    ).rejects.toMatchObject({ code: "DIR_NOT_FOUND" });
  });

  it("throws PATH_OUTSIDE_WORKSPACE for path traversal", async () => {
    await expect(
      fileWriteTool.execute(
        { path: "../../../etc/passwd", content: "evil", createParents: false },
        makeContext(),
      ),
    ).rejects.toMatchObject({ code: "PATH_OUTSIDE_WORKSPACE" });
  });

  it("throws PATH_OUTSIDE_WORKSPACE for absolute path outside workspace", async () => {
    await expect(
      fileWriteTool.execute(
        { path: "/etc/passwd", content: "evil", createParents: false },
        makeContext(),
      ),
    ).rejects.toMatchObject({ code: "PATH_OUTSIDE_WORKSPACE" });
  });

  it("rejects invalid params: missing path", () => {
    const parseResult = fileWriteTool.parameters.safeParse({ content: "data" });
    expect(parseResult.success).toBe(false);
  });

  it("rejects invalid params: missing content", () => {
    const parseResult = fileWriteTool.parameters.safeParse({ path: "file.txt" });
    expect(parseResult.success).toBe(false);
  });

  it("emits tool.start and tool.end events", async () => {
    await fileWriteTool.execute(
      { path: "events.txt", content: "data", createParents: true },
      makeContext(),
    );

    expect(emittedEvents[0]?.event).toBe("tool.start");
    expect(emittedEvents[1]?.event).toBe("tool.end");
  });

  it("creates an empty file with bytesWritten: 0", async () => {
    const result = await fileWriteTool.execute(
      { path: "empty.txt", content: "", createParents: true },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.bytesWritten).toBe(0);
    expect(result.data.created).toBe(true);
  });

  it("ToolError is an instance of Error with correct code", () => {
    const err = new ToolError("TEST_CODE", "test message");
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("TEST_CODE");
    expect(err.name).toBe("ToolError");
    expect(err.message).toBe("test message");
  });
});
