import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type ToolContext, ToolError, grepTool } from "../index.js";

describe("grepTool", () => {
  let workspaceRoot: string;
  const emittedEvents: { event: string; payload: unknown }[] = [];

  const makeContext = (): ToolContext => ({
    workspaceRoot,
    emit: (event: string, payload: unknown) => {
      emittedEvents.push({ event, payload });
    },
  });

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), "diricode-grep-test-"));
    emittedEvents.length = 0;
  });

  afterEach(async () => {
    await rm(workspaceRoot, { recursive: true, force: true });
  });

  async function writeWorkspaceFile(name: string, content: string): Promise<string> {
    const filePath = join(workspaceRoot, name);
    await mkdir(join(filePath, ".."), { recursive: true });
    await writeFile(filePath, content, "utf-8");
    return filePath;
  }

  it("AC1: returns matches with file, line, column, content for basic pattern", async () => {
    await writeWorkspaceFile("a.txt", "line one\nTODO: fix this\nline three\n");

    const result = await grepTool.execute(
      { pattern: "TODO", caseSensitive: true, maxResults: 500, contextLines: 0 },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.matches).toHaveLength(1);
    const m = result.data.matches[0];
    expect(m?.file).toContain("a.txt");
    expect(m?.line).toBe(2);
    expect(m?.column).toBe(1);
    expect(m?.content).toBe("TODO: fix this");
    expect(result.data.count).toBe(1);
    expect(result.data.truncated).toBe(false);
  });

  it("AC2: path parameter scopes search to subdirectory", async () => {
    await writeWorkspaceFile("src/a.ts", "TODO in src");
    await writeWorkspaceFile("other/b.ts", "TODO in other");

    const result = await grepTool.execute(
      { pattern: "TODO", path: "src", caseSensitive: true, maxResults: 500, contextLines: 0 },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.matches).toHaveLength(1);
    const match = result.data.matches[0];
    expect(match?.file).toContain("src");
    expect(match?.file).not.toContain("other");
  });

  it("AC3: include filter limits to matching file types", async () => {
    await writeWorkspaceFile("src/a.ts", "TODO in ts");
    await writeWorkspaceFile("src/b.js", "TODO in js");

    const result = await grepTool.execute(
      { pattern: "TODO", include: "*.ts", caseSensitive: true, maxResults: 500, contextLines: 0 },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.matches.every((m) => m.file.endsWith(".ts"))).toBe(true);
    expect(result.data.matches.some((m) => m.file.endsWith(".js"))).toBe(false);
  });

  it("AC4: caseSensitive:false matches todo, TODO, Todo", async () => {
    await writeWorkspaceFile("c.txt", "todo item\nTODO item\nTodo item\n");

    const result = await grepTool.execute(
      { pattern: "todo", caseSensitive: false, maxResults: 500, contextLines: 0 },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.matches).toHaveLength(3);
  });

  it("AC4: caseSensitive:true (default) does NOT match mixed-case", async () => {
    await writeWorkspaceFile("d.txt", "todo\nTODO\nTodo\n");

    const result = await grepTool.execute(
      { pattern: "TODO", caseSensitive: true, maxResults: 500, contextLines: 0 },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.matches).toHaveLength(1);
    const match = result.data.matches[0];
    expect(match?.content).toBe("TODO");
  });

  it("AC5: regex syntax works — function\\s+\\w+", async () => {
    await writeWorkspaceFile("e.ts", "function myFunc() {}\nconst x = 1;\nfunction another() {}\n");

    const result = await grepTool.execute(
      { pattern: "function\\s+\\w+", caseSensitive: true, maxResults: 500, contextLines: 0 },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.matches).toHaveLength(2);
  });

  it("AC6: invalid regex throws ToolError with INVALID_REGEX code", async () => {
    await expect(
      grepTool.execute(
        { pattern: "[invalid", caseSensitive: true, maxResults: 500, contextLines: 0 },
        makeContext(),
      ),
    ).rejects.toMatchObject({ code: "INVALID_REGEX" });
  });

  it("AC6: ToolError INVALID_REGEX is an instance of ToolError", async () => {
    try {
      await grepTool.execute(
        { pattern: "(unclosed", caseSensitive: true, maxResults: 500, contextLines: 0 },
        makeContext(),
      );
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ToolError);
      expect((err as ToolError).code).toBe("INVALID_REGEX");
    }
  });

  it("AC7: maxResults caps results and sets truncated:true when more exist", async () => {
    await writeWorkspaceFile("f.txt", "x\nx\nx\nx\nx\n");

    const result = await grepTool.execute(
      { pattern: "x", caseSensitive: true, maxResults: 3, contextLines: 0 },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.matches).toHaveLength(3);
    expect(result.data.truncated).toBe(true);
  });

  it("AC7: maxResults not exceeded when fewer matches exist", async () => {
    await writeWorkspaceFile("g.txt", "x\ny\nz\n");

    const result = await grepTool.execute(
      { pattern: "x", caseSensitive: true, maxResults: 3, contextLines: 0 },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.matches).toHaveLength(1);
    expect(result.data.truncated).toBe(false);
  });

  it("AC8: contextLines:2 returns 2 lines before and after each match", async () => {
    await writeWorkspaceFile("h.txt", "before2\nbefore1\nmatch me\nafter1\nafter2\n");

    const result = await grepTool.execute(
      { pattern: "match me", caseSensitive: true, maxResults: 500, contextLines: 2 },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.matches).toHaveLength(1);
    const m = result.data.matches[0];
    expect(m?.context.before).toEqual(["before2", "before1"]);
    expect(m?.context.after).toEqual(["after1", "after2"]);
  });

  it("AC8: contextLines:0 returns empty before/after arrays", async () => {
    await writeWorkspaceFile("h.txt", "before\nmatch me\nafter\n");

    const result = await grepTool.execute(
      { pattern: "match me", caseSensitive: true, maxResults: 500, contextLines: 0 },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.matches).toHaveLength(1);
    const m = result.data.matches[0];
    expect(m?.context.before).toEqual([]);
    expect(m?.context.after).toEqual([]);
  });

  it("AC9: binary files are skipped silently", async () => {
    const binPath = join(workspaceRoot, "binary.bin");
    await writeFile(binPath, Buffer.from([0x00, 0x01, 0x02, 0x61, 0x62, 0x63]));
    await writeWorkspaceFile("text.txt", "abc match here");

    const result = await grepTool.execute(
      { pattern: "abc", caseSensitive: true, maxResults: 500, contextLines: 0 },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.matches.every((m) => !m.file.endsWith(".bin"))).toBe(true);
  });

  it("AC10: no matches returns empty result, NOT an error", async () => {
    await writeWorkspaceFile("k.txt", "nothing to see here");

    const result = await grepTool.execute(
      { pattern: "ZZZNOMATCH", caseSensitive: true, maxResults: 500, contextLines: 0 },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.matches).toEqual([]);
    expect(result.data.count).toBe(0);
    expect(result.data.truncated).toBe(false);
  });

  it("AC11: emits tool.start and tool.end events", async () => {
    await writeWorkspaceFile("l.txt", "hello world");

    await grepTool.execute(
      { pattern: "hello", caseSensitive: true, maxResults: 500, contextLines: 0 },
      makeContext(),
    );

    expect(emittedEvents[0]?.event).toBe("tool.start");
    expect(emittedEvents[1]?.event).toBe("tool.end");
  });

  it("AC11: tool.start event carries params", async () => {
    await writeWorkspaceFile("m.txt", "hello world");

    await grepTool.execute(
      { pattern: "hello", caseSensitive: true, maxResults: 500, contextLines: 0 },
      makeContext(),
    );

    expect((emittedEvents[0]?.payload as { tool: string }).tool).toBe("grep");
  });

  it("default excludes: .git directory is skipped", async () => {
    await writeWorkspaceFile(".git/config", "TODO in git config");
    await writeWorkspaceFile("real.txt", "nothing");

    const result = await grepTool.execute(
      { pattern: "TODO", caseSensitive: true, maxResults: 500, contextLines: 0 },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.matches.every((m) => !m.file.startsWith(".git"))).toBe(true);
  });

  it("default excludes: node_modules directory is skipped", async () => {
    await writeWorkspaceFile("node_modules/pkg/index.js", "TODO in node_modules");
    await writeWorkspaceFile("src/code.ts", "nothing here");

    const result = await grepTool.execute(
      { pattern: "TODO", caseSensitive: true, maxResults: 500, contextLines: 0 },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.matches.every((m) => !m.file.startsWith("node_modules"))).toBe(true);
  });

  it("returns filesSearched count", async () => {
    await writeWorkspaceFile("file1.txt", "match");
    await writeWorkspaceFile("file2.txt", "match");
    await writeWorkspaceFile("file3.txt", "no");

    const result = await grepTool.execute(
      { pattern: "match|no", caseSensitive: true, maxResults: 500, contextLines: 0 },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.filesSearched).toBeGreaterThanOrEqual(3);
  });

  it("column is 1-based position of match start", async () => {
    await writeWorkspaceFile("col.txt", "   TODO here\n");

    const result = await grepTool.execute(
      { pattern: "TODO", caseSensitive: true, maxResults: 500, contextLines: 0 },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.matches[0]?.column).toBe(4);
  });

  it("path parameter accepts absolute path within workspace", async () => {
    await writeWorkspaceFile("sub/file.txt", "find me");

    const result = await grepTool.execute(
      { pattern: "find me", path: "sub", caseSensitive: true, maxResults: 500, contextLines: 0 },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.matches).toHaveLength(1);
  });

  it("PATH_OUTSIDE_WORKSPACE thrown for traversal path", async () => {
    await expect(
      grepTool.execute(
        { pattern: "x", path: "../outside", caseSensitive: true, maxResults: 500, contextLines: 0 },
        makeContext(),
      ),
    ).rejects.toMatchObject({ code: "PATH_OUTSIDE_WORKSPACE" });
  });

  it("Zod rejects empty pattern string", () => {
    const parseResult = grepTool.parameters.safeParse({ pattern: "" });
    expect(parseResult.success).toBe(false);
  });

  it("Zod rejects maxResults > 5000", () => {
    const parseResult = grepTool.parameters.safeParse({ pattern: "x", maxResults: 5001 });
    expect(parseResult.success).toBe(false);
  });

  it("Zod rejects contextLines > 10", () => {
    const parseResult = grepTool.parameters.safeParse({ pattern: "x", contextLines: 11 });
    expect(parseResult.success).toBe(false);
  });

  it("annotations are correctly set", () => {
    expect(grepTool.annotations.readOnlyHint).toBe(true);
    expect(grepTool.annotations.destructiveHint).toBe(false);
    expect(grepTool.annotations.idempotentHint).toBe(true);
  });

  it("nonexistent path returns empty result without error", async () => {
    const result = await grepTool.execute(
      {
        pattern: "x",
        path: "nonexistent-dir",
        caseSensitive: true,
        maxResults: 500,
        contextLines: 0,
      },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.matches).toEqual([]);
    expect(result.data.count).toBe(0);
  });

  it("multiple matches in single file are all returned", async () => {
    await writeWorkspaceFile("multi.ts", "const x = 1;\nconst y = x + 1;\nconst z = x * 2;\n");

    const result = await grepTool.execute(
      { pattern: "const", caseSensitive: true, maxResults: 500, contextLines: 0 },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.matches).toHaveLength(3);
  });
});
