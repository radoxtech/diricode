import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { astGrepReplaceTool } from "../index.js";
import type { ToolContext } from "@diricode/core";

describe("astGrepReplaceTool", () => {
  let workspaceRoot: string;
  const emittedEvents: { event: string; payload: unknown }[] = [];

  const makeContext = (): ToolContext => ({
    workspaceRoot,
    emit: (event: string, payload: unknown) => {
      emittedEvents.push({ event, payload });
    },
  });

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), "diricode-ast-grep-replace-test-"));
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

  it("AC1: dry-run returns changes with applied=false and does NOT modify files", async () => {
    const filePath = await writeWorkspaceFile("a.ts", 'console.log("hello");\n');
    const originalContent = await readFile(filePath, "utf-8");

    const result = await astGrepReplaceTool.execute(
      {
        pattern: "console.log($MSG)",
        replacement: "logger.info($MSG)",
        language: "typescript",
        dryRun: true,
        maxResults: 100,
      },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.applied).toBe(false);
    expect(result.data.count).toBeGreaterThan(0);
    expect(result.data.changes[0]?.applied).toBe(false);
    expect(result.data.filesModified).toBe(0);

    const afterContent = await readFile(filePath, "utf-8");
    expect(afterContent).toBe(originalContent);
  });

  it("AC2: apply mode (dryRun=false) modifies files with correct replacements", async () => {
    const filePath = await writeWorkspaceFile("b.ts", 'console.log("world");\n');

    const result = await astGrepReplaceTool.execute(
      {
        pattern: "console.log($MSG)",
        replacement: "logger.info($MSG)",
        language: "typescript",
        dryRun: false,
        maxResults: 100,
      },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.applied).toBe(true);
    expect(result.data.filesModified).toBe(1);
    expect(result.data.changes[0]?.applied).toBe(true);

    const updatedContent = await readFile(filePath, "utf-8");
    expect(updatedContent).toContain("logger.info");
    expect(updatedContent).not.toContain("console.log");
  });

  it("AC3: $VAR matching captures single token and uses it in replacement", async () => {
    await writeWorkspaceFile("c.ts", "const x = foo;\n");

    const result = await astGrepReplaceTool.execute(
      {
        pattern: "const $VAR = foo",
        replacement: "const $VAR = bar",
        language: "typescript",
        dryRun: true,
        maxResults: 100,
      },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.count).toBeGreaterThan(0);
    expect(result.data.changes[0]?.replacement).toContain("bar");
    expect(result.data.changes[0]?.matchedText).toContain("foo");
  });

  it("AC4: $$$ matching captures multi-line content", async () => {
    await writeWorkspaceFile("d.ts", "function greet() {\n  return 42;\n}\n");

    const result = await astGrepReplaceTool.execute(
      {
        pattern: "function greet() {\n  $$$\n}",
        replacement: "function greet() {\n  return 0;\n}",
        language: "typescript",
        dryRun: true,
        maxResults: 100,
      },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.count).toBeGreaterThan(0);
    expect(result.data.changes[0]?.matchedText).toContain("function greet");
  });

  it("AC5: directory search applies changes across multiple matching files", async () => {
    await writeWorkspaceFile("e1.ts", "console.log(1);\n");
    await writeWorkspaceFile("e2.ts", "console.log(2);\n");

    const result = await astGrepReplaceTool.execute(
      {
        pattern: "console.log($N)",
        replacement: "logger.debug($N)",
        language: "typescript",
        dryRun: false,
        maxResults: 100,
      },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.count).toBe(2);
    expect(result.data.filesModified).toBe(2);
  });

  it("AC6: returns empty changes with count 0 when pattern has no matches", async () => {
    await writeWorkspaceFile("f.ts", "const x = 1;\n");

    const result = await astGrepReplaceTool.execute(
      {
        pattern: "nonExistentPattern123",
        replacement: "something",
        language: "typescript",
        dryRun: true,
        maxResults: 100,
      },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.count).toBe(0);
    expect(result.data.changes).toHaveLength(0);
  });

  it("AC7: throws PATH_OUTSIDE_WORKSPACE for paths escaping workspace root", async () => {
    await expect(
      astGrepReplaceTool.execute(
        {
          pattern: "const $VAR = 1",
          replacement: "const $VAR = 2",
          language: "typescript",
          path: "../outside",
          dryRun: true,
          maxResults: 100,
        },
        makeContext(),
      ),
    ).rejects.toMatchObject({ code: "PATH_OUTSIDE_WORKSPACE" });
  });

  it("AC8: skips binary files without error", async () => {
    const binPath = join(workspaceRoot, "binary.ts");
    await writeFile(binPath, Buffer.from([0x00, 0x01, 0x02, 0x03, 0x61, 0x62, 0x63]));

    const result = await astGrepReplaceTool.execute(
      {
        pattern: "abc",
        replacement: "xyz",
        language: "typescript",
        dryRun: true,
        maxResults: 100,
      },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.filesSearched).toBe(0);
  });

  it("AC9: truncates results at maxResults limit", async () => {
    await writeWorkspaceFile("g.ts", "foo(1);\nfoo(2);\nfoo(3);\nfoo(4);\nfoo(5);\n");

    const result = await astGrepReplaceTool.execute(
      {
        pattern: "foo($N)",
        replacement: "bar($N)",
        language: "typescript",
        dryRun: true,
        maxResults: 2,
      },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.count).toBeLessThanOrEqual(2);
    expect(result.data.truncated).toBe(true);
  });

  it("AC10: safety gate rejects writes to .git directory in apply mode", async () => {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(join(workspaceRoot, ".git"), { recursive: true });
    await writeFile(join(workspaceRoot, ".git", "config.ts"), "const x = 1;\n", "utf-8");

    await expect(
      astGrepReplaceTool.execute(
        {
          pattern: "const $VAR = 1",
          replacement: "const $VAR = 2",
          language: "typescript",
          path: ".git",
          dryRun: false,
          maxResults: 100,
        },
        makeContext(),
      ),
    ).rejects.toMatchObject({ code: "PROTECTED_PATH" });
  });

  it("emits tool.start and tool.end events", async () => {
    await writeWorkspaceFile("h.ts", "const x = 1;\n");

    await astGrepReplaceTool.execute(
      {
        pattern: "const $VAR = 1",
        replacement: "const $VAR = 2",
        language: "typescript",
        dryRun: true,
        maxResults: 100,
      },
      makeContext(),
    );

    expect(emittedEvents[0]?.event).toBe("tool.start");
    expect(emittedEvents[1]?.event).toBe("tool.end");
  });

  it("dry-run is the default behavior when dryRun is omitted", async () => {
    const filePath = await writeWorkspaceFile("i.ts", "const a = 1;\n");
    const originalContent = await readFile(filePath, "utf-8");

    const parseResult = astGrepReplaceTool.parameters.safeParse({
      pattern: "const $VAR = 1",
      replacement: "const $VAR = 2",
    });
    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      expect(parseResult.data.dryRun).toBe(true);
    }

    const afterContent = await readFile(filePath, "utf-8");
    expect(afterContent).toBe(originalContent);
  });

  it("apply mode preserves file mode permissions", async () => {
    const { chmod, stat } = await import("node:fs/promises");
    const filePath = await writeWorkspaceFile("j.ts", "const x = 1;\n");
    await chmod(filePath, 0o644);

    await astGrepReplaceTool.execute(
      {
        pattern: "const $VAR = 1",
        replacement: "const $VAR = 2",
        language: "typescript",
        dryRun: false,
        maxResults: 100,
      },
      makeContext(),
    );

    const s = await stat(filePath);
    expect(s.mode & 0o777).toBe(0o644);
  });

  it("returns filesSearched count correctly", async () => {
    await writeWorkspaceFile("k1.ts", "const a = 1;\n");
    await writeWorkspaceFile("k2.ts", "const b = 2;\n");

    const result = await astGrepReplaceTool.execute(
      {
        pattern: "const $VAR = 1",
        replacement: "const $VAR = 99",
        language: "typescript",
        dryRun: true,
        maxResults: 100,
      },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.data.filesSearched).toBeGreaterThanOrEqual(1);
  });

  it("empty pattern is rejected by Zod schema", () => {
    const parseResult = astGrepReplaceTool.parameters.safeParse({
      pattern: "",
      replacement: "something",
    });
    expect(parseResult.success).toBe(false);
  });

  it("empty replacement is rejected by Zod schema", () => {
    const parseResult = astGrepReplaceTool.parameters.safeParse({
      pattern: "something",
      replacement: "",
    });
    expect(parseResult.success).toBe(false);
  });

  it("vi.fn is available for mocking emit in test context", () => {
    const mockEmit = vi.fn();
    const ctx: ToolContext = { workspaceRoot, emit: mockEmit };
    expect(ctx.emit).toBeDefined();
  });
});
