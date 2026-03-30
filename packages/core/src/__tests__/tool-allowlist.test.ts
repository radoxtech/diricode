import { describe, expect, it, vi } from "vitest";
import type { Tool } from "../index.js";
import {
  filterToolsByAllowlist,
  isToolAllowed,
  createPolicyEnforcingTool,
  createPolicyEnforcingToolRegistry,
  ToolAccessDeniedError,
} from "../index.js";

function makeTool(name: string): Tool {
  return {
    name,
    description: `${name} tool`,
    parameters: { parse: (v: unknown) => v } as Tool["parameters"],
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    execute: async () => {
      await Promise.resolve();
      return { success: true, data: { name } };
    },
  };
}

describe("filterToolsByAllowlist", () => {
  it("returns all tools when policy is empty", () => {
    const tools = [makeTool("file-read"), makeTool("file-write"), makeTool("bash")];
    const result = filterToolsByAllowlist(tools, {});
    expect(result).toHaveLength(3);
  });

  it("returns all tools when allowedTools is undefined", () => {
    const tools = [makeTool("file-read"), makeTool("file-write")];
    const result = filterToolsByAllowlist(tools, { allowedTools: undefined });
    expect(result).toHaveLength(2);
  });

  it("returns empty array when allowedTools is empty array (block all)", () => {
    const tools = [makeTool("file-read"), makeTool("file-write")];
    const result = filterToolsByAllowlist(tools, { allowedTools: [] });
    expect(result).toHaveLength(0);
  });

  it("filters tools to only those in allowedTools", () => {
    const tools = [
      makeTool("file-read"),
      makeTool("file-write"),
      makeTool("bash"),
      makeTool("glob"),
    ];
    const result = filterToolsByAllowlist(tools, { allowedTools: ["file-read", "file-write"] });
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.name)).toEqual(["file-read", "file-write"]);
  });

  it("preserves tool order from original array", () => {
    const tools = [
      makeTool("bash"),
      makeTool("file-read"),
      makeTool("glob"),
      makeTool("file-write"),
    ];
    const result = filterToolsByAllowlist(tools, {
      allowedTools: ["file-read", "file-write", "glob"],
    });
    expect(result.map((t) => t.name)).toEqual(["file-read", "glob", "file-write"]);
  });

  it("returns empty array when no tools match allowlist", () => {
    const tools = [makeTool("bash"), makeTool("git-push")];
    const result = filterToolsByAllowlist(tools, { allowedTools: ["file-read"] });
    expect(result).toHaveLength(0);
  });

  it("does not modify original tools array", () => {
    const tools = [makeTool("file-read"), makeTool("bash")];
    filterToolsByAllowlist(tools, { allowedTools: ["file-read"] });
    expect(tools).toHaveLength(2);
  });
});

describe("isToolAllowed", () => {
  it("returns true when policy is empty", () => {
    expect(isToolAllowed("file-read", {})).toBe(true);
  });

  it("returns true when allowedTools is undefined", () => {
    expect(isToolAllowed("file-read", { allowedTools: undefined })).toBe(true);
  });

  it("returns false when allowedTools is empty array (block all)", () => {
    expect(isToolAllowed("file-read", { allowedTools: [] })).toBe(false);
  });

  it("returns true when tool is in allowedTools", () => {
    expect(isToolAllowed("file-read", { allowedTools: ["file-read", "file-write"] })).toBe(true);
  });

  it("returns false when tool is not in allowedTools", () => {
    expect(isToolAllowed("bash", { allowedTools: ["file-read", "file-write"] })).toBe(false);
  });

  it("is case-sensitive (tool names must match exactly)", () => {
    expect(isToolAllowed("File-Read", { allowedTools: ["file-read"] })).toBe(false);
  });
});

describe("createPolicyEnforcingTool", () => {
  it("returns original tool when allowed", () => {
    const tool = makeTool("file-read");
    const emit = vi.fn();
    const result = createPolicyEnforcingTool(
      tool,
      { allowedTools: ["file-read"] },
      "test-agent",
      emit,
    );
    expect(result.name).toBe("file-read");
    expect(result.execute).toBe(tool.execute);
  });

  it("returns wrapping tool when not allowed", () => {
    const tool = makeTool("bash");
    const emit = vi.fn();
    const result = createPolicyEnforcingTool(
      tool,
      { allowedTools: ["file-read"] },
      "test-agent",
      emit,
    );
    expect(result.name).toBe("bash");
    expect(result.execute).not.toBe(tool.execute);
  });

  it("throws ToolAccessDeniedError when executing disallowed tool", async () => {
    const tool = makeTool("bash");
    const emit = vi.fn();
    const policy = { allowedTools: ["file-read"] };
    const enforcingTool = createPolicyEnforcingTool(tool, policy, "test-agent", emit);

    await expect(enforcingTool.execute({}, { workspaceRoot: "/test", emit })).rejects.toThrow(
      ToolAccessDeniedError,
    );
  });

  it("throws error with correct toolName and agentName", async () => {
    const tool = makeTool("git-push");
    const emit = vi.fn();
    const policy = { allowedTools: ["file-read", "file-write"] };
    const enforcingTool = createPolicyEnforcingTool(tool, policy, "code-writer", emit);

    let caught: ToolAccessDeniedError | undefined;
    try {
      await enforcingTool.execute({}, { workspaceRoot: "/test", emit });
    } catch (e) {
      if (e instanceof ToolAccessDeniedError) caught = e;
    }

    expect(caught?.toolName).toBe("git-push");
    expect(caught?.agentName).toBe("code-writer");
    expect(caught?.allowedTools).toEqual(["file-read", "file-write"]);
    expect(caught?.code).toBe("TOOL_ACCESS_DENIED");
  });

  it("emits tool.access_denied event when executing disallowed tool", async () => {
    const tool = makeTool("dangerous-tool");
    const emit = vi.fn();
    const policy = { allowedTools: ["safe-tool"] };
    const enforcingTool = createPolicyEnforcingTool(tool, policy, "test-agent", emit);

    await enforcingTool.execute({}, { workspaceRoot: "/test", emit }).catch(() => undefined);

    expect(emit).toHaveBeenCalledWith(
      "tool.access_denied",
      expect.objectContaining({
        toolName: "dangerous-tool",
        agentName: "test-agent",
        allowedTools: ["safe-tool"],
        timestamp: expect.any(String) as unknown as string,
      }),
    );
  });

  it("allows execution when tool is in allowlist", async () => {
    const tool = makeTool("file-read");
    const emit = vi.fn();
    const policy = { allowedTools: ["file-read"] };
    const enforcingTool = createPolicyEnforcingTool(tool, policy, "test-agent", emit);

    const result = await enforcingTool.execute({ path: "/test" }, { workspaceRoot: "/test", emit });
    expect(result.success).toBe(true);
    expect(emit).not.toHaveBeenCalled();
  });
});

describe("createPolicyEnforcingToolRegistry", () => {
  it("wraps all tools when none are allowed", () => {
    const tools = [makeTool("file-read"), makeTool("file-write"), makeTool("bash")];
    const emit = vi.fn();
    const result = createPolicyEnforcingToolRegistry(
      tools,
      { allowedTools: [] },
      "test-agent",
      emit,
    );
    expect(result).toHaveLength(3);
    const result0 = result[0];
    const result1 = result[1];
    const result2 = result[2];
    const tool0 = tools[0];
    const tool1 = tools[1];
    const tool2 = tools[2];
    if (!result0 || !result1 || !result2 || !tool0 || !tool1 || !tool2) {
      throw new Error("Unexpected undefined");
    }
    expect(result0.execute).not.toBe(tool0.execute);
    expect(result1.execute).not.toBe(tool1.execute);
    expect(result2.execute).not.toBe(tool2.execute);
  });

  it("wraps only disallowed tools when some are allowed", () => {
    const fileRead = makeTool("file-read");
    const fileWrite = makeTool("file-write");
    const bash = makeTool("bash");
    const tools = [fileRead, fileWrite, bash];
    const emit = vi.fn();
    const result = createPolicyEnforcingToolRegistry(
      tools,
      { allowedTools: ["file-read", "file-write"] },
      "test-agent",
      emit,
    );

    const wrapped0 = result[0];
    const wrapped1 = result[1];
    const wrapped2 = result[2];
    expect(wrapped0?.execute).toBe(fileRead.execute);
    expect(wrapped1?.execute).toBe(fileWrite.execute);
    expect(wrapped2?.execute).not.toBe(bash.execute);
  });

  it("returns empty array when input is empty", () => {
    const emit = vi.fn();
    const result = createPolicyEnforcingToolRegistry(
      [],
      { allowedTools: ["file-read"] },
      "test-agent",
      emit,
    );
    expect(result).toHaveLength(0);
  });

  it("throws when executing disallowed tool from registry", async () => {
    const tools = [makeTool("file-read"), makeTool("git-push")];
    const emit = vi.fn();
    const result = createPolicyEnforcingToolRegistry(
      tools,
      { allowedTools: ["file-read"] },
      "test-agent",
      emit,
    );

    const allowedTool = result[0];
    const disallowedTool = result[1];
    const readResult = await allowedTool?.execute({}, { workspaceRoot: "/test", emit });
    expect(readResult?.success).toBe(true);

    await expect(disallowedTool?.execute({}, { workspaceRoot: "/test", emit })).rejects.toThrow(
      ToolAccessDeniedError,
    );
  });

  it("emits tool.access_denied for each disallowed tool attempt", async () => {
    const tools = [makeTool("git-push"), makeTool("git-commit"), makeTool("bash")];
    const emit = vi.fn();
    const result = createPolicyEnforcingToolRegistry(
      tools,
      { allowedTools: ["file-read"] },
      "test-agent",
      emit,
    );

    for (const tool of result) {
      await tool.execute({}, { workspaceRoot: "/test", emit }).catch(() => undefined);
    }

    expect(emit).toHaveBeenCalledTimes(3);
    expect(emit).toHaveBeenCalledWith(
      "tool.access_denied",
      expect.objectContaining({ toolName: "git-push" }),
    );
    expect(emit).toHaveBeenCalledWith(
      "tool.access_denied",
      expect.objectContaining({ toolName: "git-commit" }),
    );
    expect(emit).toHaveBeenCalledWith(
      "tool.access_denied",
      expect.objectContaining({ toolName: "bash" }),
    );
  });
});

describe("ToolAccessDeniedError", () => {
  it("has correct code TOOL_ACCESS_DENIED", () => {
    const error = new ToolAccessDeniedError("bash", "test-agent", ["file-read"]);
    expect(error.code).toBe("TOOL_ACCESS_DENIED");
  });

  it("has correct name ToolAccessDeniedError", () => {
    const error = new ToolAccessDeniedError("bash", "test-agent", ["file-read"]);
    expect(error.name).toBe("ToolAccessDeniedError");
  });

  it("includes tool name and agent name in message", () => {
    const error = new ToolAccessDeniedError("git-push", "code-writer", ["file-read", "file-write"]);
    expect(error.message).toContain("git-push");
    expect(error.message).toContain("code-writer");
    expect(error.message).toContain("file-read");
    expect(error.message).toContain("file-write");
  });

  it("handles empty allowedTools array", () => {
    const error = new ToolAccessDeniedError("bash", "test-agent", []);
    expect(error.message).toContain("(none)");
  });

  it("is instance of Error", () => {
    const error = new ToolAccessDeniedError("bash", "test-agent", ["file-read"]);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ToolAccessDeniedError);
  });
});
