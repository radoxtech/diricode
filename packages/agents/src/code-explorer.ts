import type {
  Agent,
  AgentContext,
  AgentMetadata,
  AgentResult,
  Tool,
  ToolContext,
} from "@diricode/core";
import { AgentError } from "@diricode/core";

export interface CodeExplorerConfig {
  readonly tools: readonly Tool[];
}

type ToolName = "file-read" | "glob" | "grep" | "ast-grep" | "lsp-symbols";

const REQUIRED_TOOLS: readonly ToolName[] = [
  "file-read",
  "glob",
  "grep",
  "ast-grep",
  "lsp-symbols",
];

function findTool(tools: readonly Tool[], name: string): Tool | undefined {
  return tools.find((t) => t.name === name);
}

function buildToolContext(context: AgentContext): ToolContext {
  return {
    workspaceRoot: context.workspaceRoot,
    emit: context.emit,
  };
}

export function createCodeExplorerAgent(_config: CodeExplorerConfig): Agent {
  const metadata: AgentMetadata = {
    name: "code-explorer",
    description:
      "Read-only codebase reconnaissance agent. " +
      "Searches and navigates source files using glob, grep, AST patterns, and LSP symbols. " +
      "Outputs concise findings maps with file-level evidence.",
    tier: "medium",
    category: "research",
    capabilities: [
      "file-read",
      "glob",
      "grep",
      "ast-grep",
      "lsp-symbols",
      "codebase-search",
      "pattern-discovery",
      "file-navigation",
    ],
    tags: ["exploration", "medium", "research"],
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
          `code-explorer requires tools: ${missingTools.join(", ")}`,
        );
      }

      const toolContext = buildToolContext(context);

      context.emit("code-explorer.tools-verified", {
        availableTools: context.tools.map((t) => t.name),
      });

      let toolCalls = 0;
      let fileCount = 0;

      const globTool = findTool(context.tools, "glob");
      if (globTool) {
        try {
          const globResult = await globTool.execute(
            { pattern: "**/*.ts", maxResults: 100 },
            toolContext,
          );
          toolCalls++;
          fileCount = (globResult.data as { count?: number }).count ?? 0;
          context.emit("code-explorer.workspace-scanned", {
            fileCount,
          });
        } catch {
          context.emit("code-explorer.workspace-scan-skipped", {});
        }
      }

      const grepTool = findTool(context.tools, "grep");
      let grepMatches = 0;
      if (grepTool) {
        try {
          const grepResult = await grepTool.execute(
            { pattern: input.substring(0, 50), maxResults: 20 },
            toolContext,
          );
          toolCalls++;
          grepMatches = (grepResult.data as { matchCount?: number }).matchCount ?? 0;
          context.emit("code-explorer.grep-completed", {
            matches: grepMatches,
          });
        } catch {
          context.emit("code-explorer.grep-skipped", {});
        }
      }

      const lspTool = findTool(context.tools, "lsp-symbols");
      let symbolCount = 0;
      if (lspTool) {
        try {
          const lspResult = await lspTool.execute({ scope: "workspace" }, toolContext);
          toolCalls++;
          symbolCount = (lspResult.data as { symbolCount?: number }).symbolCount ?? 0;
          context.emit("code-explorer.symbols-indexed", {
            symbolCount,
          });
        } catch {
          context.emit("code-explorer.symbols-skipped", {});
        }
      }

      const output = buildOutputSummary(input, context.tools, fileCount, grepMatches, symbolCount);
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
  fileCount: number,
  grepMatches: number,
  symbolCount: number,
): string {
  const toolNames = tools.map((t) => t.name).join(", ");
  return [
    `code-explorer processed: ${input.substring(0, 100)}`,
    `tools available: ${toolNames}`,
    `files found: ${String(fileCount)}`,
    `grep matches: ${String(grepMatches)}`,
    `symbols indexed: ${String(symbolCount)}`,
  ].join("\n");
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
