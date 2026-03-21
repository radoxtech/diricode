import { chmod, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ToolError, fileEditTool } from "../index.js";

describe("fileEditTool", () => {
  let workspaceRoot: string;
  const emittedEvents: { event: string; payload: unknown }[] = [];

  const makeContext = () => ({
    workspaceRoot,
    emit: (event: string, payload: unknown) => {
      emittedEvents.push({ event, payload });
    },
  });

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), "diricode-file-edit-test-"));
    emittedEvents.length = 0;
  });

  afterEach(async () => {
    await rm(workspaceRoot, { recursive: true, force: true });
  });

  async function writeWorkspaceFile(name: string, content: string): Promise<string> {
    const filePath = join(workspaceRoot, name);
    await writeFile(filePath, content, "utf-8");
    return filePath;
  }

  it("AC1: replaces single occurrence and returns replacements: 1", async () => {
    await writeWorkspaceFile("f.txt", "hello foo world");
    const result = await fileEditTool.execute(
      { path: "f.txt", oldString: "foo", newString: "bar", replaceAll: false },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.replacements).toBe(1);
    expect(result.data.matchCount).toBe(1);
  });

  it("AC2: returns ToolError NO_MATCH when oldString not found", async () => {
    await writeWorkspaceFile("f.txt", "hello world");
    await expect(
      fileEditTool.execute({ path: "f.txt", oldString: "missing", newString: "x", replaceAll: false }, makeContext()),
    ).rejects.toMatchObject({ code: "NO_MATCH" });
  });

  it("AC3: returns ToolError MULTIPLE_MATCHES when >1 occurrence and replaceAll is false", async () => {
    await writeWorkspaceFile("f.txt", "dup dup dup");
    await expect(
      fileEditTool.execute({ path: "f.txt", oldString: "dup", newString: "x", replaceAll: false }, makeContext()),
    ).rejects.toMatchObject({ code: "MULTIPLE_MATCHES" });
  });

  it("AC4: replaceAll:true replaces all occurrences", async () => {
    await writeWorkspaceFile("f.txt", "dup dup dup");
    const result = await fileEditTool.execute(
      { path: "f.txt", oldString: "dup", newString: "x", replaceAll: true },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.replacements).toBe(3);
    expect(result.data.matchCount).toBe(3);
  });

  it("AC5: returns ToolError FILE_NOT_FOUND for nonexistent file", async () => {
    await expect(
      fileEditTool.execute(
        { path: "nonexistent.txt", oldString: "x", newString: "y", replaceAll: false },
        makeContext(),
      ),
    ).rejects.toMatchObject({ code: "FILE_NOT_FOUND" });
  });

  it("AC6: returns ToolError PATH_OUTSIDE_WORKSPACE for path traversal", async () => {
    await expect(
      fileEditTool.execute(
        { path: "../outside.txt", oldString: "x", newString: "y", replaceAll: false },
        makeContext(),
      ),
    ).rejects.toMatchObject({ code: "PATH_OUTSIDE_WORKSPACE" });
  });

  it("AC6: returns ToolError PATH_OUTSIDE_WORKSPACE for absolute path outside workspace", async () => {
    await expect(
      fileEditTool.execute(
        { path: "/etc/hosts", oldString: "localhost", newString: "x", replaceAll: false },
        makeContext(),
      ),
    ).rejects.toMatchObject({ code: "PATH_OUTSIDE_WORKSPACE" });
  });

  it("AC7: preserves file permissions after edit", async () => {
    const filePath = await writeWorkspaceFile("perms.txt", "hello foo world");
    await chmod(filePath, 0o644);

    await fileEditTool.execute(
      { path: "perms.txt", oldString: "foo", newString: "bar", replaceAll: false },
      makeContext(),
    );

    const s = await stat(filePath);
    expect(s.mode & 0o777).toBe(0o644);
  });

  it("AC7: preserves CRLF line endings", async () => {
    const { readFile } = await import("node:fs/promises");
    await writeWorkspaceFile("crlf.txt", "line1\r\nfoo\r\nline3\r\n");

    await fileEditTool.execute(
      { path: "crlf.txt", oldString: "foo", newString: "bar", replaceAll: false },
      makeContext(),
    );

    const updated = await readFile(join(workspaceRoot, "crlf.txt"), "utf-8");
    expect(updated).toBe("line1\r\nbar\r\nline3\r\n");
  });

  it("AC8: emits tool.start and tool.end events", async () => {
    await writeWorkspaceFile("events.txt", "hello foo");
    await fileEditTool.execute(
      { path: "events.txt", oldString: "foo", newString: "bar", replaceAll: false },
      makeContext(),
    );

    expect(emittedEvents[0]?.event).toBe("tool.start");
    expect(emittedEvents[1]?.event).toBe("tool.end");
  });

  it("AC9: returns ToolError BINARY_FILE for binary content", async () => {
    const binPath = join(workspaceRoot, "binary.bin");
    await writeFile(binPath, Buffer.from([0x00, 0x01, 0x02, 0x03, 0x61, 0x62, 0x63]));

    await expect(
      fileEditTool.execute({ path: "binary.bin", oldString: "abc", newString: "x", replaceAll: false }, makeContext()),
    ).rejects.toMatchObject({ code: "BINARY_FILE" });
  });

  it("AC10: oldString === newString is a no-op returning replacements: 0", async () => {
    const { readFile } = await import("node:fs/promises");
    await writeWorkspaceFile("noop.txt", "hello foo");

    const result = await fileEditTool.execute(
      { path: "noop.txt", oldString: "foo", newString: "foo", replaceAll: false },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.replacements).toBe(0);

    const content = await readFile(join(workspaceRoot, "noop.txt"), "utf-8");
    expect(content).toBe("hello foo");
  });

  it("AC11: empty oldString is rejected by Zod", () => {
    const parseResult = fileEditTool.parameters.safeParse({
      path: "file.txt",
      oldString: "",
      newString: "x",
    });
    expect(parseResult.success).toBe(false);
  });

  it("handles multiline oldString", async () => {
    const { readFile } = await import("node:fs/promises");
    await writeWorkspaceFile("multi.txt", "line1\nline2\nline3\n");

    const result = await fileEditTool.execute(
      { path: "multi.txt", oldString: "line1\nline2", newString: "replaced", replaceAll: false },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.replacements).toBe(1);
    const content = await readFile(join(workspaceRoot, "multi.txt"), "utf-8");
    expect(content).toBe("replaced\nline3\n");
  });

  it("returns correct path in result data", async () => {
    await writeWorkspaceFile("path-check.txt", "find me");
    const result = await fileEditTool.execute(
      { path: "path-check.txt", oldString: "find me", newString: "done", replaceAll: false },
      makeContext(),
    );

    expect(result.data.path).toContain("path-check.txt");
  });

  it("ToolError is an instance of Error with correct code", () => {
    const err = new ToolError("NO_MATCH", "not found");
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("NO_MATCH");
    expect(err.name).toBe("ToolError");
  });
});
