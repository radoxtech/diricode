import { mkdtemp, rm, writeFile, mkdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { globTool } from "../index.js";

describe("globTool", () => {
  let workspaceRoot: string;
  const emittedEvents: { event: string; payload: unknown }[] = [];

  const makeContext = (): { workspaceRoot: string; emit: (event: string, payload: unknown) => void } => ({
    workspaceRoot,
    emit: (event: string, payload: unknown) => {
      emittedEvents.push({ event, payload });
    },
  });

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), "diricode-glob-test-"));
    emittedEvents.length = 0;
  });

  afterEach(async () => {
    await rm(workspaceRoot, { recursive: true, force: true });
  });

  it("returns sorted .ts files matching **/*.ts", async () => {
    await writeFile(join(workspaceRoot, "zebra.ts"), "", "utf-8");
    await writeFile(join(workspaceRoot, "alpha.ts"), "", "utf-8");
    await writeFile(join(workspaceRoot, "middle.ts"), "", "utf-8");

    const result = await globTool.execute({ pattern: "**/*.ts" }, makeContext());

    expect(result.success).toBe(true);
    expect(result.data.files).toEqual(["alpha.ts", "middle.ts", "zebra.ts"]);
  });

  it("scopes results to path subdirectory and returns workspace-relative paths", async () => {
    await mkdir(join(workspaceRoot, "src"), { recursive: true });
    await mkdir(join(workspaceRoot, "other"), { recursive: true });
    await writeFile(join(workspaceRoot, "src", "a.ts"), "", "utf-8");
    await writeFile(join(workspaceRoot, "src", "b.ts"), "", "utf-8");
    await writeFile(join(workspaceRoot, "other", "c.ts"), "", "utf-8");

    const result = await globTool.execute({ pattern: "**/*.ts", path: "src" }, makeContext());

    expect(result.success).toBe(true);
    expect(result.data.files).toContain("src/a.ts");
    expect(result.data.files).toContain("src/b.ts");
    expect(result.data.files).not.toContain("other/c.ts");
  });

  it("respects maxResults and sets truncated: true when exceeded", async () => {
    for (let i = 0; i < 10; i++) {
      await writeFile(join(workspaceRoot, `file${String(i)}.txt`), "", "utf-8");
    }

    const result = await globTool.execute({ pattern: "**/*.txt", maxResults: 5 }, makeContext());

    expect(result.success).toBe(true);
    expect(result.data.files).toHaveLength(5);
    expect(result.data.truncated).toBe(true);
    expect(result.data.count).toBe(5);
  });

  it("sets truncated: false when results do not exceed maxResults", async () => {
    await writeFile(join(workspaceRoot, "a.txt"), "", "utf-8");
    await writeFile(join(workspaceRoot, "b.txt"), "", "utf-8");

    const result = await globTool.execute({ pattern: "**/*.txt", maxResults: 100 }, makeContext());

    expect(result.success).toBe(true);
    expect(result.data.truncated).toBe(false);
  });

  it("excludes node_modules by default", async () => {
    await mkdir(join(workspaceRoot, "node_modules", "pkg"), { recursive: true });
    await writeFile(join(workspaceRoot, "node_modules", "pkg", "index.js"), "", "utf-8");
    await writeFile(join(workspaceRoot, "real.js"), "", "utf-8");

    const result = await globTool.execute({ pattern: "**/*.js" }, makeContext());

    expect(result.success).toBe(true);
    expect(result.data.files).toEqual(["real.js"]);
  });

  it("excludes .git directory by default", async () => {
    await mkdir(join(workspaceRoot, ".git"), { recursive: true });
    await writeFile(join(workspaceRoot, ".git", "config"), "", "utf-8");
    await writeFile(join(workspaceRoot, "README.md"), "", "utf-8");

    const result = await globTool.execute({ pattern: "**/*" }, makeContext());

    expect(result.success).toBe(true);
    const gitFiles = result.data.files.filter((f) => f.startsWith(".git/"));
    expect(gitFiles).toHaveLength(0);
  });

  it("returns empty array for no matches — not an error", async () => {
    const result = await globTool.execute({ pattern: "nonexistent/**/*.xyz" }, makeContext());

    expect(result.success).toBe(true);
    expect(result.data.files).toEqual([]);
    expect(result.data.count).toBe(0);
    expect(result.data.truncated).toBe(false);
  });

  it("rejects empty pattern via Zod", () => {
    const parseResult = globTool.parameters.safeParse({ pattern: "" });
    expect(parseResult.success).toBe(false);
  });

  it("rejects maxResults: 0 via Zod", () => {
    const parseResult = globTool.parameters.safeParse({ pattern: "**/*", maxResults: 0 });
    expect(parseResult.success).toBe(false);
  });

  it("rejects maxResults: 10001 via Zod", () => {
    const parseResult = globTool.parameters.safeParse({ pattern: "**/*", maxResults: 10001 });
    expect(parseResult.success).toBe(false);
  });

  it("returns results in deterministic sorted order on multiple runs", async () => {
    await writeFile(join(workspaceRoot, "z.txt"), "", "utf-8");
    await writeFile(join(workspaceRoot, "a.txt"), "", "utf-8");
    await writeFile(join(workspaceRoot, "m.txt"), "", "utf-8");

    const result1 = await globTool.execute({ pattern: "**/*.txt" }, makeContext());
    const result2 = await globTool.execute({ pattern: "**/*.txt" }, makeContext());

    expect(result1.data.files).toEqual(result2.data.files);
    expect(result1.data.files).toEqual(["a.txt", "m.txt", "z.txt"]);
  });

  it("emits tool.start and tool.end events", async () => {
    await writeFile(join(workspaceRoot, "file.ts"), "", "utf-8");

    await globTool.execute({ pattern: "**/*.ts" }, makeContext());

    expect(emittedEvents[0]?.event).toBe("tool.start");
    expect(emittedEvents[1]?.event).toBe("tool.end");
  });

  it("throws INVALID_PATTERN for absolute pattern", async () => {
    await expect(
      globTool.execute({ pattern: "/etc/passwd" }, makeContext()),
    ).rejects.toMatchObject({ code: "INVALID_PATTERN" });
  });

  it("throws PATH_OUTSIDE_WORKSPACE for path traversal", async () => {
    await expect(
      globTool.execute({ pattern: "**/*", path: "../../../etc" }, makeContext()),
    ).rejects.toMatchObject({ code: "PATH_OUTSIDE_WORKSPACE" });
  });

  it("includes dot-files by default", async () => {
    await writeFile(join(workspaceRoot, ".env"), "SECRET=123", "utf-8");
    await writeFile(join(workspaceRoot, ".eslintrc"), "{}", "utf-8");
    await writeFile(join(workspaceRoot, "regular.txt"), "", "utf-8");

    const result = await globTool.execute({ pattern: "**/*" }, makeContext());

    expect(result.success).toBe(true);
    expect(result.data.files).toContain(".env");
    expect(result.data.files).toContain(".eslintrc");
  });

  it("returns paths relative to workspace root when path param scopes the search", async () => {
    await mkdir(join(workspaceRoot, "lib"), { recursive: true });
    await writeFile(join(workspaceRoot, "lib", "util.ts"), "", "utf-8");

    const result = await globTool.execute({ pattern: "*.ts", path: "lib" }, makeContext());

    expect(result.success).toBe(true);
    expect(result.data.files).toEqual(["lib/util.ts"]);
  });

  it("returns files sorted alphabetically across nested directories", async () => {
    await mkdir(join(workspaceRoot, "b"), { recursive: true });
    await mkdir(join(workspaceRoot, "a"), { recursive: true });
    await writeFile(join(workspaceRoot, "b", "file.ts"), "", "utf-8");
    await writeFile(join(workspaceRoot, "a", "file.ts"), "", "utf-8");
    await writeFile(join(workspaceRoot, "root.ts"), "", "utf-8");

    const result = await globTool.execute({ pattern: "**/*.ts" }, makeContext());

    expect(result.success).toBe(true);
    expect(result.data.files).toEqual(["a/file.ts", "b/file.ts", "root.ts"]);
  });

  it("follows symlinks within workspace", async () => {
    await mkdir(join(workspaceRoot, "real-dir"), { recursive: true });
    await writeFile(join(workspaceRoot, "real-dir", "target.ts"), "", "utf-8");
    await symlink(join(workspaceRoot, "real-dir"), join(workspaceRoot, "linked-dir"));

    const result = await globTool.execute({ pattern: "linked-dir/*.ts" }, makeContext());

    expect(result.success).toBe(true);
    expect(result.data.files).toContain("linked-dir/target.ts");
  });

  it("returns pattern in result data", async () => {
    const result = await globTool.execute({ pattern: "**/*.ts" }, makeContext());

    expect(result.data.pattern).toBe("**/*.ts");
  });

  it("accepts maxResults: 1 as boundary value", () => {
    const parseResult = globTool.parameters.safeParse({ pattern: "**/*", maxResults: 1 });
    expect(parseResult.success).toBe(true);
  });

  it("accepts maxResults: 10000 as boundary value", () => {
    const parseResult = globTool.parameters.safeParse({ pattern: "**/*", maxResults: 10000 });
    expect(parseResult.success).toBe(true);
  });
});
