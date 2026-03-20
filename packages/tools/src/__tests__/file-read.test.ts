import { mkdtemp, rm, writeFile, mkdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fileReadTool } from "../index.js";

describe("fileReadTool", () => {
  let workspaceRoot: string;
  const emittedEvents: { event: string; payload: unknown }[] = [];

  const makeContext = (): { workspaceRoot: string; emit: (event: string, payload: unknown) => void } => ({
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

  it("reads an existing file and returns its content", async () => {
    await writeFile(join(workspaceRoot, "hello.txt"), "hello\nworld\n", "utf-8");

    const result = await fileReadTool.execute({ path: "hello.txt" }, makeContext());

    expect(result.success).toBe(true);
    expect(result.data.content).toBe("hello\nworld");
    expect(result.data.lineCount).toBe(2);
    expect(result.data.totalLines).toBe(2);
    expect(result.data.truncated).toBe(false);
  });

  it("throws FILE_NOT_FOUND for nonexistent file", async () => {
    await expect(
      fileReadTool.execute({ path: "nonexistent.txt" }, makeContext()),
    ).rejects.toMatchObject({ code: "FILE_NOT_FOUND" });
  });

  it("throws FILE_NOT_FOUND when path is a directory", async () => {
    await mkdir(join(workspaceRoot, "somedir"));

    await expect(
      fileReadTool.execute({ path: "somedir" }, makeContext()),
    ).rejects.toMatchObject({ code: "FILE_NOT_FOUND" });
  });

  it("returns lines 5-14 with offset: 5, limit: 10", async () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line ${String(i + 1)}`);
    await writeFile(join(workspaceRoot, "numbered.txt"), lines.join("\n") + "\n", "utf-8");

    const result = await fileReadTool.execute(
      { path: "numbered.txt", offset: 5, limit: 10 },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.lineCount).toBe(10);
    expect(result.data.totalLines).toBe(20);
    expect(result.data.content).toBe(
      Array.from({ length: 10 }, (_, i) => `line ${String(i + 5)}`).join("\n"),
    );
  });

  it("handles offset beyond file length gracefully", async () => {
    await writeFile(join(workspaceRoot, "short.txt"), "line 1\nline 2\n", "utf-8");

    const result = await fileReadTool.execute(
      { path: "short.txt", offset: 100 },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.lineCount).toBe(0);
    expect(result.data.content).toBe("");
  });

  it("clamps limit when offset + limit exceeds file length", async () => {
    const lines = Array.from({ length: 5 }, (_, i) => `line ${String(i + 1)}`);
    await writeFile(join(workspaceRoot, "five.txt"), lines.join("\n") + "\n", "utf-8");

    const result = await fileReadTool.execute(
      { path: "five.txt", offset: 3, limit: 100 },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.lineCount).toBe(3);
    expect(result.data.content).toBe("line 3\nline 4\nline 5");
  });

  it("throws BINARY_FILE for binary content", async () => {
    const binaryBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0d, 0x0a]);
    await writeFile(join(workspaceRoot, "image.png"), binaryBuffer);

    await expect(
      fileReadTool.execute({ path: "image.png" }, makeContext()),
    ).rejects.toMatchObject({ code: "BINARY_FILE" });
  });

  it("returns empty content for an empty file", async () => {
    await writeFile(join(workspaceRoot, "empty.txt"), "", "utf-8");

    const result = await fileReadTool.execute({ path: "empty.txt" }, makeContext());

    expect(result.success).toBe(true);
    expect(result.data.content).toBe("");
    expect(result.data.lineCount).toBe(0);
    expect(result.data.totalLines).toBe(0);
    expect(result.data.truncated).toBe(false);
  });

  it("handles file without trailing newline correctly", async () => {
    await writeFile(join(workspaceRoot, "no-newline.txt"), "line 1\nline 2", "utf-8");

    const result = await fileReadTool.execute({ path: "no-newline.txt" }, makeContext());

    expect(result.success).toBe(true);
    expect(result.data.lineCount).toBe(2);
    expect(result.data.totalLines).toBe(2);
    expect(result.data.content).toBe("line 1\nline 2");
  });

  it("throws PATH_OUTSIDE_WORKSPACE for path traversal", async () => {
    await expect(
      fileReadTool.execute({ path: "../../../etc/passwd" }, makeContext()),
    ).rejects.toMatchObject({ code: "PATH_OUTSIDE_WORKSPACE" });
  });

  it("throws PATH_OUTSIDE_WORKSPACE for absolute path outside workspace", async () => {
    await expect(
      fileReadTool.execute({ path: "/etc/passwd" }, makeContext()),
    ).rejects.toMatchObject({ code: "PATH_OUTSIDE_WORKSPACE" });
  });

  it("follows symlinks within workspace", async () => {
    await writeFile(join(workspaceRoot, "target.txt"), "symlink content\n", "utf-8");
    await symlink(join(workspaceRoot, "target.txt"), join(workspaceRoot, "link.txt"));

    const result = await fileReadTool.execute({ path: "link.txt" }, makeContext());

    expect(result.success).toBe(true);
    expect(result.data.content).toBe("symlink content");
  });

  it("rejects symlinks pointing outside workspace", async () => {
    await symlink("/etc/hostname", join(workspaceRoot, "evil-link.txt"));

    await expect(
      fileReadTool.execute({ path: "evil-link.txt" }, makeContext()),
    ).rejects.toMatchObject({ code: "PATH_OUTSIDE_WORKSPACE" });
  });

  it("rejects invalid params: missing path", () => {
    const parseResult = fileReadTool.parameters.safeParse({});
    expect(parseResult.success).toBe(false);
  });

  it("rejects invalid params: negative offset", () => {
    const parseResult = fileReadTool.parameters.safeParse({ path: "file.txt", offset: -1 });
    expect(parseResult.success).toBe(false);
  });

  it("rejects invalid params: zero offset", () => {
    const parseResult = fileReadTool.parameters.safeParse({ path: "file.txt", offset: 0 });
    expect(parseResult.success).toBe(false);
  });

  it("rejects invalid params: float limit", () => {
    const parseResult = fileReadTool.parameters.safeParse({ path: "file.txt", limit: 1.5 });
    expect(parseResult.success).toBe(false);
  });

  it("emits tool.start and tool.end events", async () => {
    await writeFile(join(workspaceRoot, "events.txt"), "data\n", "utf-8");

    await fileReadTool.execute({ path: "events.txt" }, makeContext());

    expect(emittedEvents[0]?.event).toBe("tool.start");
    expect(emittedEvents[1]?.event).toBe("tool.end");
  });

  it("truncates content exceeding MAX_OUTPUT_BYTES and sets truncated: true", async () => {
    const largeLine = "x".repeat(200_000);
    const lines = Array.from({ length: 10 }, () => largeLine);
    await writeFile(join(workspaceRoot, "huge.txt"), lines.join("\n") + "\n", "utf-8");

    const result = await fileReadTool.execute({ path: "huge.txt" }, makeContext());

    expect(result.success).toBe(true);
    expect(result.data.truncated).toBe(true);
    expect(Buffer.byteLength(result.data.content, "utf-8")).toBeLessThanOrEqual(1024 * 1024);
  });

  it("reads files in nested directories", async () => {
    await mkdir(join(workspaceRoot, "a", "b", "c"), { recursive: true });
    await writeFile(join(workspaceRoot, "a", "b", "c", "deep.txt"), "deep content\n", "utf-8");

    const result = await fileReadTool.execute({ path: "a/b/c/deep.txt" }, makeContext());

    expect(result.success).toBe(true);
    expect(result.data.content).toBe("deep content");
  });

  it("resolves relative path with dots correctly within workspace", async () => {
    await mkdir(join(workspaceRoot, "dir"), { recursive: true });
    await writeFile(join(workspaceRoot, "dir", "file.txt"), "content\n", "utf-8");

    const result = await fileReadTool.execute({ path: "dir/../dir/file.txt" }, makeContext());

    expect(result.success).toBe(true);
    expect(result.data.content).toBe("content");
  });
});
