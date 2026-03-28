import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ToolError, hashlineEditTool, computeLineHash, formatAnchor } from "../index.js";
import type { ToolContext } from "@diricode/core";

describe("hashlineEditTool", () => {
  let workspaceRoot: string;
  const emittedEvents: { event: string; payload: unknown }[] = [];

  const makeContext = (): ToolContext => ({
    workspaceRoot,
    emit: (event: string, payload: unknown) => {
      emittedEvents.push({ event, payload });
    },
  });

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), "diricode-hashline-edit-test-"));
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

  async function readFileContent(name: string): Promise<string> {
    const { readFile } = await import("node:fs/promises");
    return readFile(join(workspaceRoot, name), "utf-8");
  }

  it("edits line at exact anchor match", async () => {
    await writeWorkspaceFile("f.txt", "line one\nline two\nline three\n");

    const anchor = formatAnchor(2, computeLineHash(2, "line two"));
    const result = await hashlineEditTool.execute(
      { path: "f.txt", anchor, newContent: "line TWO" },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.anchorStatus.kind).toBe("exact");
    expect(result.data.resolvedLine).toBe(2);
    expect(result.data.previousContent).toBe("line two");

    const content = await readFileContent("f.txt");
    expect(content).toBe("line one\nline TWO\nline three\n");
  });

  it("edits line when anchor has drifted", async () => {
    await writeWorkspaceFile("f.txt", "line one\nline two\nline three\n");

    const anchor = formatAnchor(2, computeLineHash(2, "line two"));

    await writeFile(
      join(workspaceRoot, "f.txt"),
      "INSERTED\nline one\nline two\nline three\n",
      "utf-8",
    );

    const result = await hashlineEditTool.execute(
      { path: "f.txt", anchor, newContent: "line TWO" },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.anchorStatus.kind).toBe("drifted");
    expect(result.data.resolvedLine).toBe(3);

    const content = await readFileContent("f.txt");
    expect(content).toBe("INSERTED\nline one\nline TWO\nline three\n");
  });

  it("throws ANCHOR_CONFLICT when anchor cannot be resolved", async () => {
    await writeWorkspaceFile("f.txt", "line one\nline two\nline three\n");

    await expect(
      hashlineEditTool.execute(
        { path: "f.txt", anchor: "999#ZZ", newContent: "new" },
        makeContext(),
      ),
    ).rejects.toMatchObject({ code: "ANCHOR_CONFLICT" });
  });

  it("throws FILE_NOT_FOUND for nonexistent file", async () => {
    await expect(
      hashlineEditTool.execute(
        { path: "missing.txt", anchor: "1#ZZ", newContent: "new" },
        makeContext(),
      ),
    ).rejects.toMatchObject({ code: "FILE_NOT_FOUND" });
  });

  it("throws PATH_OUTSIDE_WORKSPACE for path traversal", async () => {
    await expect(
      hashlineEditTool.execute(
        { path: "../outside.txt", anchor: "1#ZZ", newContent: "new" },
        makeContext(),
      ),
    ).rejects.toMatchObject({ code: "PATH_OUTSIDE_WORKSPACE" });
  });

  it("throws BINARY_FILE for binary content", async () => {
    const binPath = join(workspaceRoot, "binary.bin");
    await writeFile(binPath, Buffer.from([0x00, 0x01, 0x02, 0x03]));

    await expect(
      hashlineEditTool.execute(
        { path: "binary.bin", anchor: "1#ZZ", newContent: "new" },
        makeContext(),
      ),
    ).rejects.toMatchObject({ code: "BINARY_FILE" });
  });

  it("is a no-op when newContent matches existing line", async () => {
    await writeWorkspaceFile("f.txt", "line one\nline two\nline three\n");

    const anchor = formatAnchor(2, computeLineHash(2, "line two"));
    const result = await hashlineEditTool.execute(
      { path: "f.txt", anchor, newContent: "line two" },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.preview).toBe("");
  });

  it("emits tool.start and tool.end events", async () => {
    await writeWorkspaceFile("f.txt", "line one\nline two\nline three\n");

    const anchor = formatAnchor(2, computeLineHash(2, "line two"));
    await hashlineEditTool.execute(
      { path: "f.txt", anchor, newContent: "line TWO" },
      makeContext(),
    );

    expect(emittedEvents[0]?.event).toBe("tool.start");
    expect(emittedEvents[1]?.event).toBe("tool.end");
  });

  it("returns preview with context around edited line", async () => {
    await writeWorkspaceFile("f.txt", "alpha\nbeta\ngamma\ndelta\n");

    const anchor = formatAnchor(2, computeLineHash(2, "beta"));
    const result = await hashlineEditTool.execute(
      { path: "f.txt", anchor, newContent: "BETA" },
      makeContext(),
    );

    expect(result.data.preview).toContain("alpha");
    expect(result.data.preview).toContain("BETA");
    expect(result.data.preview).toContain("gamma");
  });
});
