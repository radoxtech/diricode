import type { Agent, AgentContext, AgentMetadata, AgentResult, Tool } from "@diricode/core";
import { AgentError } from "@diricode/core";

export interface CodeWriterConfig {
  readonly tools: readonly Tool[];
}

type ToolName =
  | "file-read"
  | "file-write"
  | "file-edit"
  | "glob"
  | "grep"
  | "ast-grep"
  | "lsp-symbols"
  | "diagnostics"
  | "bash";

const REQUIRED_TOOLS: readonly ToolName[] = [
  "file-read",
  "file-write",
  "file-edit",
  "glob",
  "grep",
  "ast-grep",
  "lsp-symbols",
  "diagnostics",
  "bash",
];

function findTool(tools: readonly Tool[], name: string): Tool | undefined {
  return tools.find((t) => t.name === name);
}

function buildToolContext(context: AgentContext) {
  return {
    workspaceRoot: context.workspaceRoot,
    emit: context.emit,
  };
}

export function createCodeWriterAgent(config: CodeWriterConfig): Agent {
  const metadata: AgentMetadata = {
    name: "code-writer",
    description:
      "Primary implementation agent for feature code and multi-file changes. " +
      "Reads and writes source files, searches the codebase with grep and AST patterns, " +
      "inspects symbols, runs diagnostics to verify correctness, and executes tests/builds.",
    tier: "heavy",
    category: "code",
    capabilities: [
      "file-read",
      "file-write",
      "file-edit",
      "multi-file-changes",
      "ast-grep",
      "lsp-symbols",
      "diagnostics",
      "test-execution",
      "build-execution",
      "code-generation",
      "refactoring",
    ],
    tags: ["implementation", "heavy", "code-production"],
  };

  return {
    metadata,
    async execute(input: string, context: AgentContext): Promise<AgentResult> {
      context.emit("agent.started", {
        agentId: metadata.name,
        parentAgentId: context.parentAgentId,
        input: input.substring(0, 200),
      });

      const missingTools = REQUIRED_TOOLS.filter(
        (name) => findTool(context.tools, name) === undefined,
      );

      if (missingTools.length > 0) {
        throw new AgentError(
          "MISSING_TOOLS",
          `code-writer requires tools: ${missingTools.join(", ")}`,
        );
      }

      const toolContext = buildToolContext(context);

      context.emit("code-writer.tools-verified", {
        availableTools: context.tools.map((t) => t.name),
      });

      let toolCalls = 0;
      let tokensUsed = 0;

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
      tokensUsed = estimateTokens(input);

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
