import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  lspGotoDefinitionTool,
  lspFindReferencesTool,
  lspPrepareRenameTool,
  lspRenameSymbolTool,
  lspFileDiagnosticsTool,
} from "../index.js";

describe("lsp-navigation tools", () => {
  let workspaceRoot: string;
  const emittedEvents: { event: string; payload: unknown }[] = [];

  const makeContext = (): {
    workspaceRoot: string;
    emit: (event: string, payload: unknown) => void;
  } => ({
    workspaceRoot,
    emit: (event: string, payload: unknown) => {
      emittedEvents.push({ event, payload });
    },
  });

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), "diricode-lsp-nav-test-"));
    emittedEvents.length = 0;
  });

  afterEach(async () => {
    await rm(workspaceRoot, { recursive: true, force: true });
  });

  describe("lspGotoDefinitionTool", () => {
    it("emits tool.start and tool.end events", async () => {
      await writeFile(join(workspaceRoot, "a.ts"), "export function greet() {}\n", "utf-8");

      await lspGotoDefinitionTool.execute({ file: "a.ts", line: 1, character: 17 }, makeContext());

      expect(emittedEvents[0]?.event).toBe("tool.start");
      expect(emittedEvents[1]?.event).toBe("tool.end");
    });

    it("returns workspace-relative definition location", async () => {
      await writeFile(
        join(workspaceRoot, "utils.ts"),
        "export function greet(name: string) { return name; }\n",
        "utf-8",
      );

      const result = await lspGotoDefinitionTool.execute(
        { file: "utils.ts", line: 1, character: 17 },
        makeContext(),
      );

      expect(result.success).toBe(true);
      expect(result.data.token).toBe("greet");
      expect(result.data.definitions.length).toBeGreaterThanOrEqual(1);
      expect(result.data.definitions[0]?.file).toBe("utils.ts");
      expect(result.data.definitions[0]?.line).toBe(1);
    });

    it("returns deterministic count across repeated calls", async () => {
      await writeFile(join(workspaceRoot, "foo.ts"), "export function doThing() {}\n", "utf-8");

      const r1 = await lspGotoDefinitionTool.execute(
        { file: "foo.ts", line: 1, character: 17 },
        makeContext(),
      );
      const r2 = await lspGotoDefinitionTool.execute(
        { file: "foo.ts", line: 1, character: 17 },
        makeContext(),
      );

      expect(r1.data.count).toBe(r2.data.count);
    });

    it("throws FILE_NOT_FOUND for missing file", async () => {
      await expect(
        lspGotoDefinitionTool.execute({ file: "missing.ts", line: 1, character: 1 }, makeContext()),
      ).rejects.toMatchObject({ code: "FILE_NOT_FOUND" });
    });

    it("throws PATH_OUTSIDE_WORKSPACE for traversal", async () => {
      await expect(
        lspGotoDefinitionTool.execute(
          { file: "../../../etc/passwd", line: 1, character: 1 },
          makeContext(),
        ),
      ).rejects.toMatchObject({ code: "PATH_OUTSIDE_WORKSPACE" });
    });

    it("throws UNSUPPORTED_LANGUAGE for .json file", async () => {
      await writeFile(join(workspaceRoot, "data.json"), '{"key": "value"}', "utf-8");

      await expect(
        lspGotoDefinitionTool.execute({ file: "data.json", line: 1, character: 2 }, makeContext()),
      ).rejects.toMatchObject({ code: "UNSUPPORTED_LANGUAGE" });
    });

    it("throws NO_SYMBOL when position is on whitespace", async () => {
      await writeFile(join(workspaceRoot, "b.ts"), "   \n", "utf-8");

      await expect(
        lspGotoDefinitionTool.execute({ file: "b.ts", line: 1, character: 1 }, makeContext()),
      ).rejects.toMatchObject({ code: "NO_SYMBOL" });
    });

    it("rejects invalid params: line 0", () => {
      const r = lspGotoDefinitionTool.parameters.safeParse({
        file: "a.ts",
        line: 0,
        character: 1,
      });
      expect(r.success).toBe(false);
    });

    it("rejects invalid params: empty file", () => {
      const r = lspGotoDefinitionTool.parameters.safeParse({
        file: "",
        line: 1,
        character: 1,
      });
      expect(r.success).toBe(false);
    });
  });

  describe("lspFindReferencesTool", () => {
    it("emits tool.start and tool.end events", async () => {
      await writeFile(
        join(workspaceRoot, "ref.ts"),
        "export function hello() {}\nhello();\n",
        "utf-8",
      );

      await lspFindReferencesTool.execute(
        { file: "ref.ts", line: 1, character: 17, includeDeclaration: true },
        makeContext(),
      );

      expect(emittedEvents[0]?.event).toBe("tool.start");
      expect(emittedEvents[1]?.event).toBe("tool.end");
    });

    it("finds all occurrences of a token including declaration", async () => {
      await writeFile(
        join(workspaceRoot, "mod.ts"),
        "export function compute() {}\ncompute();\nconst x = compute;\n",
        "utf-8",
      );

      const result = await lspFindReferencesTool.execute(
        { file: "mod.ts", line: 1, character: 17, includeDeclaration: true },
        makeContext(),
      );

      expect(result.success).toBe(true);
      expect(result.data.token).toBe("compute");
      expect(result.data.count).toBeGreaterThanOrEqual(3);
    });

    it("excludes declaration when includeDeclaration: false", async () => {
      await writeFile(
        join(workspaceRoot, "decl.ts"),
        "export function alpha() {}\nalpha();\nalpha();\n",
        "utf-8",
      );

      const withDecl = await lspFindReferencesTool.execute(
        { file: "decl.ts", line: 1, character: 17, includeDeclaration: true },
        makeContext(),
      );
      const withoutDecl = await lspFindReferencesTool.execute(
        { file: "decl.ts", line: 1, character: 17, includeDeclaration: false },
        makeContext(),
      );

      expect(withDecl.data.count).toBeGreaterThan(withoutDecl.data.count);
    });

    it("returns workspace-relative paths", async () => {
      await mkdir(join(workspaceRoot, "src"), { recursive: true });
      await writeFile(
        join(workspaceRoot, "src", "util.ts"),
        "export function myFunc() {}\n",
        "utf-8",
      );

      const result = await lspFindReferencesTool.execute(
        { file: "src/util.ts", line: 1, character: 17, includeDeclaration: true },
        makeContext(),
      );

      expect(result.success).toBe(true);
      expect(result.data.references.every((r) => !r.file.startsWith("/"))).toBe(true);
    });

    it("throws FILE_NOT_FOUND for missing file", async () => {
      await expect(
        lspFindReferencesTool.execute(
          { file: "nope.ts", line: 1, character: 1, includeDeclaration: true },
          makeContext(),
        ),
      ).rejects.toMatchObject({ code: "FILE_NOT_FOUND" });
    });

    it("throws UNSUPPORTED_LANGUAGE for unsupported extension", async () => {
      await writeFile(join(workspaceRoot, "style.css"), "body { color: red; }", "utf-8");

      await expect(
        lspFindReferencesTool.execute(
          { file: "style.css", line: 1, character: 1, includeDeclaration: true },
          makeContext(),
        ),
      ).rejects.toMatchObject({ code: "UNSUPPORTED_LANGUAGE" });
    });
  });

  describe("lspPrepareRenameTool", () => {
    it("emits tool.start and tool.end events", async () => {
      await writeFile(join(workspaceRoot, "p.ts"), "export function rename() {}\n", "utf-8");

      await lspPrepareRenameTool.execute({ file: "p.ts", line: 1, character: 17 }, makeContext());

      expect(emittedEvents[0]?.event).toBe("tool.start");
      expect(emittedEvents[1]?.event).toBe("tool.end");
    });

    it("returns token, range, and prepareToken for valid symbol", async () => {
      await writeFile(join(workspaceRoot, "q.ts"), "export function calculate() {}\n", "utf-8");

      const result = await lspPrepareRenameTool.execute(
        { file: "q.ts", line: 1, character: 17 },
        makeContext(),
      );

      expect(result.success).toBe(true);
      expect(result.data.token).toBe("calculate");
      expect(result.data.file).toBe("q.ts");
      expect(result.data.line).toBe(1);
      expect(result.data.length).toBe("calculate".length);
      expect(typeof result.data.prepareToken).toBe("string");
      expect(result.data.prepareToken.length).toBeGreaterThan(0);
    });

    it("prepareToken is a valid base64-encoded envelope with expected payload fields", async () => {
      await writeFile(join(workspaceRoot, "tok.ts"), "export function processData() {}\n", "utf-8");

      const result = await lspPrepareRenameTool.execute(
        { file: "tok.ts", line: 1, character: 17 },
        makeContext(),
      );

      const envelope = JSON.parse(
        Buffer.from(result.data.prepareToken, "base64").toString("utf-8"),
      ) as { body: string; sig: string };

      expect(typeof envelope.body).toBe("string");
      expect(typeof envelope.sig).toBe("string");

      const payload = JSON.parse(envelope.body) as {
        file: string;
        line: number;
        character: number;
        token: string;
      };

      expect(payload.token).toBe("processData");
      expect(payload.file).toBe("tok.ts");
      expect(payload.line).toBe(1);
    });

    it("throws NO_SYMBOL when character is on whitespace", async () => {
      await writeFile(join(workspaceRoot, "ws.ts"), "   \n", "utf-8");

      await expect(
        lspPrepareRenameTool.execute({ file: "ws.ts", line: 1, character: 1 }, makeContext()),
      ).rejects.toMatchObject({ code: "NO_SYMBOL" });
    });

    it("throws FILE_NOT_FOUND for missing file", async () => {
      await expect(
        lspPrepareRenameTool.execute(
          { file: "nonexistent.ts", line: 1, character: 1 },
          makeContext(),
        ),
      ).rejects.toMatchObject({ code: "FILE_NOT_FOUND" });
    });

    it("throws UNSUPPORTED_LANGUAGE for .txt file", async () => {
      await writeFile(join(workspaceRoot, "readme.txt"), "hello world", "utf-8");

      await expect(
        lspPrepareRenameTool.execute({ file: "readme.txt", line: 1, character: 1 }, makeContext()),
      ).rejects.toMatchObject({ code: "UNSUPPORTED_LANGUAGE" });
    });

    it("throws PATH_OUTSIDE_WORKSPACE for traversal", async () => {
      await expect(
        lspPrepareRenameTool.execute(
          { file: "../../outside.ts", line: 1, character: 1 },
          makeContext(),
        ),
      ).rejects.toMatchObject({ code: "PATH_OUTSIDE_WORKSPACE" });
    });
  });

  describe("lspRenameSymbolTool", () => {
    async function getPrepareToken(file: string, line: number, character: number): Promise<string> {
      const r = await lspPrepareRenameTool.execute({ file, line, character }, makeContext());
      return r.data.prepareToken;
    }

    it("emits tool.start and tool.end events", async () => {
      await writeFile(
        join(workspaceRoot, "r.ts"),
        "export function myThing() {}\nmyThing();\n",
        "utf-8",
      );
      const prepareToken = await getPrepareToken("r.ts", 1, 17);
      emittedEvents.length = 0;

      await lspRenameSymbolTool.execute(
        { prepareToken, newName: "yourThing", dryRun: true },
        makeContext(),
      );

      expect(emittedEvents[0]?.event).toBe("tool.start");
      expect(emittedEvents[1]?.event).toBe("tool.end");
    });

    it("dryRun returns edits without writing files", async () => {
      await writeFile(
        join(workspaceRoot, "dry.ts"),
        "export function oldName() {}\noldName();\n",
        "utf-8",
      );
      const prepareToken = await getPrepareToken("dry.ts", 1, 17);

      const result = await lspRenameSymbolTool.execute(
        { prepareToken, newName: "newName", dryRun: true },
        makeContext(),
      );

      expect(result.success).toBe(true);
      expect(result.data.dryRun).toBe(true);
      expect(result.data.token).toBe("oldName");
      expect(result.data.newName).toBe("newName");
      expect(result.data.editCount).toBeGreaterThanOrEqual(2);

      const { readFile: rf } = await import("node:fs/promises");
      const content = (await rf(join(workspaceRoot, "dry.ts"))).toString("utf-8");
      expect(content).toContain("oldName");
      expect(content).not.toContain("newName");
    });

    it("applies rename across all occurrences when dryRun: false", async () => {
      await writeFile(
        join(workspaceRoot, "live.ts"),
        "export function alpha() {}\nalpha();\nalpha();\n",
        "utf-8",
      );
      const prepareToken = await getPrepareToken("live.ts", 1, 17);

      const result = await lspRenameSymbolTool.execute(
        { prepareToken, newName: "beta", dryRun: false },
        makeContext(),
      );

      expect(result.success).toBe(true);
      expect(result.data.dryRun).toBe(false);
      expect(result.data.editCount).toBeGreaterThanOrEqual(3);

      const { readFile: rf } = await import("node:fs/promises");
      const content = (await rf(join(workspaceRoot, "live.ts"))).toString("utf-8");
      expect(content).toContain("beta");
      expect(content).not.toContain("alpha");
    });

    it("throws BROAD_RENAME when edits exceed broadRenameThreshold", async () => {
      const lines = Array.from({ length: 10 }, (_, i) => `const x${String(i)} = common;\n`).join(
        "",
      );
      await writeFile(
        join(workspaceRoot, "many.ts"),
        "export const common = 1;\n" + lines,
        "utf-8",
      );
      const prepareToken = await getPrepareToken("many.ts", 1, 14);

      await expect(
        lspRenameSymbolTool.execute(
          { prepareToken, newName: "renamed", broadRenameThreshold: 3, dryRun: true },
          makeContext(),
        ),
      ).rejects.toMatchObject({ code: "BROAD_RENAME" });
    });

    it("throws INVALID_PREPARE_TOKEN for garbage token", async () => {
      await expect(
        lspRenameSymbolTool.execute(
          { prepareToken: "notbase64!!!", newName: "x", dryRun: true },
          makeContext(),
        ),
      ).rejects.toMatchObject({ code: "INVALID_PREPARE_TOKEN" });
    });

    it("throws INVALID_PREPARE_TOKEN for a forged token (valid base64 JSON but no HMAC)", async () => {
      await writeFile(join(workspaceRoot, "forge.ts"), "export function realFn() {}\n", "utf-8");

      const fakePayload = JSON.stringify({
        file: "forge.ts",
        line: 1,
        character: 17,
        token: "realFn",
      });
      const forgedToken = Buffer.from(
        JSON.stringify({ body: fakePayload, sig: "deadbeef" }),
      ).toString("base64");

      await expect(
        lspRenameSymbolTool.execute(
          { prepareToken: forgedToken, newName: "evil", dryRun: true },
          makeContext(),
        ),
      ).rejects.toMatchObject({ code: "INVALID_PREPARE_TOKEN" });
    });

    it("throws INVALID_PREPARE_TOKEN for a token signed for a different workspace", async () => {
      await writeFile(join(workspaceRoot, "cross.ts"), "export function crossFn() {}\n", "utf-8");

      const otherWorkspace = "/some/other/workspace";
      const payload = JSON.stringify({
        file: "cross.ts",
        line: 1,
        character: 17,
        token: "crossFn",
      });
      const { createHmac: hmac } = await import("node:crypto");
      const sig = hmac("sha256", otherWorkspace).update(payload).digest("hex");
      const foreignToken = Buffer.from(JSON.stringify({ body: payload, sig })).toString("base64");

      await expect(
        lspRenameSymbolTool.execute(
          { prepareToken: foreignToken, newName: "evil", dryRun: true },
          makeContext(),
        ),
      ).rejects.toMatchObject({ code: "INVALID_PREPARE_TOKEN" });
    });

    it("throws STALE_PREPARE_TOKEN when file has changed since prepare", async () => {
      await writeFile(join(workspaceRoot, "stale.ts"), "export function oldFn() {}\n", "utf-8");
      const prepareToken = await getPrepareToken("stale.ts", 1, 17);

      await writeFile(
        join(workspaceRoot, "stale.ts"),
        "export function differentFn() {}\n",
        "utf-8",
      );

      await expect(
        lspRenameSymbolTool.execute(
          { prepareToken, newName: "renamed", dryRun: true },
          makeContext(),
        ),
      ).rejects.toMatchObject({ code: "STALE_PREPARE_TOKEN" });
    });

    it("throws STALE_PREPARE_TOKEN when the prepared file is deleted", async () => {
      await writeFile(join(workspaceRoot, "deleted.ts"), "export function gone() {}\n", "utf-8");
      const prepareToken = await getPrepareToken("deleted.ts", 1, 17);

      const { rm: rmFile } = await import("node:fs/promises");
      await rmFile(join(workspaceRoot, "deleted.ts"));

      await expect(
        lspRenameSymbolTool.execute(
          { prepareToken, newName: "resurrected", dryRun: true },
          makeContext(),
        ),
      ).rejects.toMatchObject({ code: "STALE_PREPARE_TOKEN" });
    });

    it("does not rename occurrences inside string literals", async () => {
      await writeFile(
        join(workspaceRoot, "strlit.ts"),
        'export function myFunc() {}\nconst msg = "call myFunc here";\nmyFunc();\n',
        "utf-8",
      );
      const prepareToken = await getPrepareToken("strlit.ts", 1, 17);

      const result = await lspRenameSymbolTool.execute(
        { prepareToken, newName: "renamed", dryRun: true },
        makeContext(),
      );

      const stringLiteralEdit = result.data.edits.find((e) => e.line === 2);
      expect(stringLiteralEdit).toBeUndefined();
      const callEdit = result.data.edits.find((e) => e.line === 3);
      expect(callEdit).toBeDefined();
    });

    it("does not rename occurrences inside line comments", async () => {
      await writeFile(
        join(workspaceRoot, "comment.ts"),
        "export function helperFn() {}\n// helperFn does important stuff\nhelperFn();\n",
        "utf-8",
      );
      const prepareToken = await getPrepareToken("comment.ts", 1, 17);

      const result = await lspRenameSymbolTool.execute(
        { prepareToken, newName: "utilFn", dryRun: true },
        makeContext(),
      );

      const commentEdit = result.data.edits.find((e) => e.line === 2);
      expect(commentEdit).toBeUndefined();
      const callEdit = result.data.edits.find((e) => e.line === 3);
      expect(callEdit).toBeDefined();
    });

    it("applies rename to code but not to string/comment occurrences when dryRun: false", async () => {
      await writeFile(
        join(workspaceRoot, "mixed.ts"),
        'export function target() {}\n// target comment\nconst s = "target string";\ntarget();\n',
        "utf-8",
      );
      const prepareToken = await getPrepareToken("mixed.ts", 1, 17);

      await lspRenameSymbolTool.execute(
        { prepareToken, newName: "replaced", dryRun: false },
        makeContext(),
      );

      const { readFile: rf } = await import("node:fs/promises");
      const content = (await rf(join(workspaceRoot, "mixed.ts"))).toString("utf-8");
      expect(content).toContain("function replaced()");
      expect(content).toContain("replaced();");
      expect(content).toContain("// target comment");
      expect(content).toContain('"target string"');
    });

    it("rejects newName with invalid identifier characters via Zod", () => {
      const r = lspRenameSymbolTool.parameters.safeParse({
        prepareToken: "abc",
        newName: "123invalid",
      });
      expect(r.success).toBe(false);
    });

    it("rejects empty newName via Zod", () => {
      const r = lspRenameSymbolTool.parameters.safeParse({
        prepareToken: "abc",
        newName: "",
      });
      expect(r.success).toBe(false);
    });

    it("returns filesAffected count", async () => {
      await writeFile(
        join(workspaceRoot, "f1.ts"),
        "export function shared() {}\nshared();\n",
        "utf-8",
      );
      await writeFile(
        join(workspaceRoot, "f2.ts"),
        "import { shared } from './f1.js';\nshared();\n",
        "utf-8",
      );
      const prepareToken = await getPrepareToken("f1.ts", 1, 17);

      const result = await lspRenameSymbolTool.execute(
        { prepareToken, newName: "unified", dryRun: true },
        makeContext(),
      );

      expect(result.data.filesAffected).toBeGreaterThanOrEqual(2);
    });
  });

  describe("lspFileDiagnosticsTool", () => {
    it("emits tool.start and tool.end events", async () => {
      await writeFile(join(workspaceRoot, "clean.ts"), "export const x = 1;\n", "utf-8");

      await lspFileDiagnosticsTool.execute({ file: "clean.ts" }, makeContext());

      expect(emittedEvents[0]?.event).toBe("tool.start");
      expect(emittedEvents[1]?.event).toBe("tool.end");
    });

    it("returns empty diagnostics for a clean file", async () => {
      await writeFile(join(workspaceRoot, "clean.ts"), "export const x = 1;\n", "utf-8");

      const result = await lspFileDiagnosticsTool.execute({ file: "clean.ts" }, makeContext());

      expect(result.success).toBe(true);
      expect(result.data.diagnostics).toHaveLength(0);
      expect(result.data.errorCount).toBe(0);
    });

    it("detects console.log as DIAG-001 hint", async () => {
      await writeFile(join(workspaceRoot, "debug.ts"), "console.log('test');\n", "utf-8");

      const result = await lspFileDiagnosticsTool.execute({ file: "debug.ts" }, makeContext());

      const d = result.data.diagnostics.find((x) => x.code === "DIAG-001");
      expect(d).toBeDefined();
      expect(d?.severity).toBe("hint");
      expect(d?.line).toBe(1);
    });

    it("detects TODO comment as DIAG-002 info", async () => {
      await writeFile(
        join(workspaceRoot, "todo.ts"),
        "// TODO: implement this\nexport const x = 1;\n",
        "utf-8",
      );

      const result = await lspFileDiagnosticsTool.execute({ file: "todo.ts" }, makeContext());

      const d = result.data.diagnostics.find((x) => x.code === "DIAG-002");
      expect(d).toBeDefined();
      expect(d?.severity).toBe("info");
    });

    it("detects explicit any type as DIAG-003 warning", async () => {
      await writeFile(
        join(workspaceRoot, "anytype.ts"),
        "function foo(x: any): any { return x; }\n",
        "utf-8",
      );

      const result = await lspFileDiagnosticsTool.execute({ file: "anytype.ts" }, makeContext());

      const anyDiags = result.data.diagnostics.filter((x) => x.code === "DIAG-003");
      expect(anyDiags.length).toBeGreaterThanOrEqual(1);
      expect(anyDiags[0]?.severity).toBe("warning");
    });

    it("detects @ts-ignore as DIAG-005 warning", async () => {
      await writeFile(join(workspaceRoot, "suppress.ts"), "// @ts-ignore\nconst x = 1;\n", "utf-8");

      const result = await lspFileDiagnosticsTool.execute({ file: "suppress.ts" }, makeContext());

      const d = result.data.diagnostics.find((x) => x.code === "DIAG-005");
      expect(d).toBeDefined();
      expect(d?.severity).toBe("warning");
    });

    it("returns structured fields: file, line, character, severity, code, message", async () => {
      await writeFile(join(workspaceRoot, "struct.ts"), "console.log('x');\n", "utf-8");

      const result = await lspFileDiagnosticsTool.execute({ file: "struct.ts" }, makeContext());

      const d = result.data.diagnostics[0];
      expect(typeof d?.file).toBe("string");
      expect(typeof d?.line).toBe("number");
      expect(typeof d?.character).toBe("number");
      expect(typeof d?.severity).toBe("string");
      expect(typeof d?.code).toBe("string");
      expect(typeof d?.message).toBe("string");
    });

    it("returns workspace-relative file paths in diagnostics", async () => {
      await mkdir(join(workspaceRoot, "sub"), { recursive: true });
      await writeFile(join(workspaceRoot, "sub", "deep.ts"), "console.log('hi');\n", "utf-8");

      const result = await lspFileDiagnosticsTool.execute({ file: "sub/deep.ts" }, makeContext());

      expect(result.data.file).toBe("sub/deep.ts");
      expect(result.data.diagnostics[0]?.file).toBe("sub/deep.ts");
    });

    it("respects maxDiagnostics limit", async () => {
      const lines = Array.from({ length: 20 }, () => "console.log('x');").join("\n") + "\n";
      await writeFile(join(workspaceRoot, "many.ts"), lines, "utf-8");

      const result = await lspFileDiagnosticsTool.execute(
        { file: "many.ts", maxDiagnostics: 5 },
        makeContext(),
      );

      expect(result.data.diagnostics.length).toBeLessThanOrEqual(5);
    });

    it("sets truncated: true when diagnostics are capped", async () => {
      const lines = Array.from({ length: 20 }, () => "console.log('x');").join("\n") + "\n";
      await writeFile(join(workspaceRoot, "cap.ts"), lines, "utf-8");

      const result = await lspFileDiagnosticsTool.execute(
        { file: "cap.ts", maxDiagnostics: 3 },
        makeContext(),
      );

      expect(result.data.truncated).toBe(true);
    });

    it("throws UNSUPPORTED_LANGUAGE for .md file", async () => {
      await writeFile(join(workspaceRoot, "README.md"), "# Hello\n", "utf-8");

      await expect(
        lspFileDiagnosticsTool.execute({ file: "README.md" }, makeContext()),
      ).rejects.toMatchObject({ code: "UNSUPPORTED_LANGUAGE" });
    });

    it("throws FILE_NOT_FOUND for missing file", async () => {
      await expect(
        lspFileDiagnosticsTool.execute({ file: "ghost.ts" }, makeContext()),
      ).rejects.toMatchObject({ code: "FILE_NOT_FOUND" });
    });

    it("throws PATH_OUTSIDE_WORKSPACE for traversal", async () => {
      await expect(
        lspFileDiagnosticsTool.execute({ file: "../../outside.ts" }, makeContext()),
      ).rejects.toMatchObject({ code: "PATH_OUTSIDE_WORKSPACE" });
    });

    it("rejects maxDiagnostics: 0 via Zod", () => {
      const r = lspFileDiagnosticsTool.parameters.safeParse({
        file: "a.ts",
        maxDiagnostics: 0,
      });
      expect(r.success).toBe(false);
    });

    it("identifies language correctly", async () => {
      await writeFile(join(workspaceRoot, "lang.ts"), "export const x = 1;\n", "utf-8");

      const result = await lspFileDiagnosticsTool.execute({ file: "lang.ts" }, makeContext());

      expect(result.data.language).toBe("typescript");
    });
  });
});
