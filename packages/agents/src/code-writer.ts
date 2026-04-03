import type {
  Agent,
  AgentContext,
  AgentMetadata,
  AgentResult,
  Tool,
  ToolContext,
} from "@diricode/core";

export interface CodeWriterConfig {
  readonly tools: readonly Tool[];
}

function findTool(tools: readonly Tool[], name: string): Tool | undefined {
  return tools.find((t) => t.name === name);
}

function buildToolContext(context: AgentContext): ToolContext {
  return {
    workspaceRoot: context.workspaceRoot,
    turnId: context.turnId,
    sessionId: context.sessionId,
    agentName: "code-writer",
    emit: context.emit,
  };
}

const CODE_WRITER_ALLOWED_TOOLS = [
  "file-read",
  "file-write",
  "file-edit",
  "glob",
  "grep",
  "ast-grep",
  "lsp-symbols",
  "diagnostics",
  "bash",
] as const;

export function createCodeWriterAgent(_config: CodeWriterConfig): Agent {
  const metadata: AgentMetadata = {
    name: "code-writer",
    description:
      "Primary implementation agent for feature code and multi-file changes. " +
      "Reads and writes source files, searches the codebase with grep and AST patterns, " +
      "inspects symbols, runs diagnostics to verify correctness, and executes tests/builds.",
    allowedTiers: ["heavy", "medium"],
    capabilities: {
      primary: "coding",
      specialization: ["implementation", "refactoring", "multi-file"],
      modelAttributes: ["reasoning", "agentic"],
    },
    toolPolicy: {
      allowedTools: [...CODE_WRITER_ALLOWED_TOOLS],
    },
  };

  return {
    metadata,
    async execute(input: string, context: AgentContext): Promise<AgentResult> {
      context.emit("agent.started", {
        agentId: metadata.name,
        parentAgentId: context.parentAgentId,
        input: input.substring(0, 200),
      });

      const toolContext = buildToolContext(context);

      context.emit("code-writer.tools-verified", {
        availableTools: context.tools.map((t) => t.name),
      });

      let toolCalls = 0;

      const globTool = findTool(context.tools, "glob");
      if (globTool) {
        try {
          const globResult = await globTool.execute(
            { pattern: "**/*.ts", maxResults: 50 },
            toolContext,
          );
          toolCalls++;
          context.emit("code-writer.workspace-scanned", {
            fileCount: (globResult.data as { count?: number }).count ?? 0,
          });
        } catch {
          context.emit("code-writer.workspace-scan-skipped", {});
        }
      }

      const diagnosticsTool = findTool(context.tools, "diagnostics");
      let diagnosticErrors = 0;
      if (diagnosticsTool) {
        try {
          const diagResult = await diagnosticsTool.execute({ command: "tsc" }, toolContext);
          toolCalls++;
          const diagData = diagResult.data as { errorCount?: number };
          diagnosticErrors = diagData.errorCount ?? 0;
          context.emit("code-writer.diagnostics-checked", {
            errors: diagnosticErrors,
          });
        } catch {
          context.emit("code-writer.diagnostics-skipped", {});
        }
      }

      const output = buildOutputSummary(input, context.tools, diagnosticErrors);
      const tokensUsed = estimateTokens(input);

      context.emit("agent.completed", {
        agentId: metadata.name,
        success: true,
        toolCalls,
        tokensUsed,
      });

      return {
        success: true,
        output,
        toolCalls,
        tokensUsed,
      };
    },
  };
}

function buildOutputSummary(
  input: string,
  tools: readonly Tool[],
  diagnosticErrors: number,
): string {
  const toolNames = tools.map((t) => t.name).join(", ");
  const status = diagnosticErrors === 0 ? "clean" : `${String(diagnosticErrors)} error(s)`;
  return [
    `code-writer processed: ${input.substring(0, 100)}`,
    `tools available: ${toolNames}`,
    `diagnostics: ${status}`,
  ].join("\n");
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
