import type {
  Agent,
  AgentContext,
  AgentMetadata,
  AgentResult,
  Tool,
  ToolContext,
} from "@diricode/core";
import { AgentError } from "@diricode/core";

export interface PlannerQuickConfig {
  readonly tools: readonly Tool[];
}

type ToolName = "file-read" | "glob" | "grep";

const REQUIRED_TOOLS: readonly ToolName[] = ["file-read", "glob", "grep"];

function findTool(tools: readonly Tool[], name: string): Tool | undefined {
  return tools.find((t) => t.name === name);
}

function buildToolContext(context: AgentContext): ToolContext {
  return {
    workspaceRoot: context.workspaceRoot,
    turnId: context.turnId,
    sessionId: context.sessionId,
    agentName: "planner-quick",
    emit: context.emit,
  };
}

export function createPlannerQuickAgent(_config: PlannerQuickConfig): Agent {
  const metadata: AgentMetadata = {
    name: "planner-quick",
    description:
      "Fast operational plans for straightforward tasks. Uses lightweight repo read/search " +
      "and context readers to produce a compact ordered plan with success criteria. " +
      "Designed for medium-complexity tasks that don't require deep reasoning.",
    tier: "medium",
    category: "strategy",
    capabilities: [
      "repository-mapping",
      "task-decomposition",
      "lightweight-search",
      "context-reading",
      "plan-generation",
      "success-criteria-definition",
    ],
    tags: ["planning", "quick", "operational-plan", "strategy"],
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
          `planner-quick requires tools: ${missingTools.join(", ")}`,
        );
      }

      context.emit("planner-quick.tools-verified", {
        availableTools: context.tools.map((t) => t.name),
      });

      const toolContext = buildToolContext(context);
      let toolCalls = 0;

      const globTool = findTool(context.tools, "glob");
      const repoFiles: string[] = [];
      if (globTool) {
        try {
          const globResult = await globTool.execute(
            { pattern: "**/*.{ts,tsx,js,json,md}", maxResults: 100 },
            toolContext,
          );
          toolCalls++;
          const data = globResult.data as { files?: string[]; results?: string[] };
          repoFiles.push(...(data.files ?? data.results ?? []));
          context.emit("planner-quick.repo-scanned", {
            fileCount: repoFiles.length,
          });
        } catch {
          context.emit("planner-quick.repo-scan-skipped", {});
        }
      }

      const grepTool = findTool(context.tools, "grep");
      const searchResults: string[] = [];
      if (grepTool) {
        try {
          const searchTerms = extractSearchTerms(input);

          if (searchTerms.length > 0) {
            const grepResult = await grepTool.execute(
              { pattern: searchTerms.join("|"), maxResults: 20 },
              toolContext,
            );
            toolCalls++;
            const data = grepResult.data as { matches?: string[]; lines?: string[] };
            searchResults.push(...(data.matches ?? data.lines ?? []));
            context.emit("planner-quick.search-performed", {
              termCount: searchTerms.length,
              matchCount: searchResults.length,
            });
          }
        } catch {
          context.emit("planner-quick.search-skipped", {});
        }
      }

      const output = buildPlanOutput(input, repoFiles, searchResults);
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

function buildPlanOutput(input: string, files: string[], searchMatches: string[]): string {
  const lines: string[] = [
    `# Quick Plan`,
    ``,
    `## Task`,
    input,
    ``,
    `## Success Criteria`,
    `- [ ] Task completed successfully`,
    `- [ ] No regressions introduced`,
    `- [ ] Code passes lint/type checks`,
    ``,
    `## Steps`,
    `1. Analyze requirements`,
    "2. Identify affected files (" + String(files.length) + " relevant files found)",
    `3. Implement changes`,
    `4. Verify with tests`,
    `5. Ensure clean diagnostics`,
  ];

  if (searchMatches.length > 0) {
    lines.push(``);
    lines.push(`## Relevant Context`);
    lines.push("Found " + String(searchMatches.length) + " context matches in codebase");
    lines.push(...searchMatches.slice(0, 5).map((m) => "- " + m.substring(0, 80)));
    if (searchMatches.length > 5) {
      lines.push("- ... and " + String(searchMatches.length - 5) + " more");
    }
  }

  return lines.join("\n");
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function extractSearchTerms(input: string): string[] {
  return input
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 5);
}
