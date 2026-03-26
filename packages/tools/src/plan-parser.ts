import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "@diricode/core";

const parametersSchema = z.object({
  plan: z.string().min(1),
  sessionId: z.string().optional(),
});

type PlanParserParams = z.infer<typeof parametersSchema>;

export interface ParsedTask {
  id: string;
  description: string;
  blockedBy: string[];
  blocking: string[];
  rawLine: string;
}

export interface PlanParserResult {
  tasks: ParsedTask[];
  edges: { upstream: string; downstream: string }[];
  taskCount: number;
  edgeCount: number;
}

const TASK_PATTERNS = [
  /^[-*+]\s+\[[ x]\]\s+(.+)$/,
  /^[-*+]\s+(.+)$/,
  /^\d+\.\s+(.+)$/,
  /^#{1,6}\s+(?:Task|Step|Phase)\s+\d*[:.]?\s*(.+)$/i,
];

const DEP_KEYWORDS = ["after", "depends on", "requires", "blocked by", "following", "once"];

const STEP_PREFIXES = [/^(?:step\s+)?(\d+)/i, /^task[_-]?(\d+)/i, /^t(\d+)/i];

function slugify(text: string, index: number): string {
  const clean = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);
  return clean ? `task-${String(index + 1)}-${clean}` : `task-${String(index + 1)}`;
}

function extractTaskNumber(text: string): number | null {
  for (const pattern of STEP_PREFIXES) {
    const m = pattern.exec(text);
    if (m?.[1]) return parseInt(m[1], 10);
  }
  return null;
}

function findDependencyRefs(
  text: string,
  allTasks: { id: string; index: number; num: number | null }[],
): string[] {
  const lower = text.toLowerCase();
  const deps: string[] = [];

  const hasDep = DEP_KEYWORDS.some((kw) => lower.includes(kw));
  if (!hasDep) return deps;

  for (const task of allTasks) {
    const numericRefs = [
      `step ${String(task.index + 1)}`,
      `task ${String(task.index + 1)}`,
      `#${String(task.index + 1)}`,
      `(${String(task.index + 1)})`,
    ];
    if (task.num !== null) {
      numericRefs.push(`step ${String(task.num)}`, `task ${String(task.num)}`);
    }

    if (numericRefs.some((ref) => lower.includes(ref))) {
      deps.push(task.id);
    }
  }

  return deps;
}

function parseMarkdownTasks(markdown: string): ParsedTask[] {
  const lines = markdown.split("\n");
  const rawTasks: { description: string; rawLine: string; lineIndex: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (!trimmed) continue;

    for (const pattern of TASK_PATTERNS) {
      const match = pattern.exec(trimmed);
      if (match?.[1]) {
        rawTasks.push({ description: match[1].trim(), rawLine: trimmed, lineIndex: i });
        break;
      }
    }
  }

  const taskMeta = rawTasks.map((t, i) => ({
    id: slugify(t.description, i),
    index: i,
    num: extractTaskNumber(t.description),
  }));

  return rawTasks.map((raw, i) => {
    const meta = taskMeta[i];
    if (!meta)
      return {
        id: slugify(raw.description, i),
        description: raw.description,
        blockedBy: [],
        blocking: [],
        rawLine: raw.rawLine,
      };

    const blockedBy = findDependencyRefs(
      raw.description,
      taskMeta.filter((m) => m.index < i),
    );

    return {
      id: meta.id,
      description: raw.description,
      blockedBy,
      blocking: [],
      rawLine: raw.rawLine,
    };
  });
}

function buildGraph(tasks: ParsedTask[]): { upstream: string; downstream: string }[] {
  const edges: { upstream: string; downstream: string }[] = [];

  for (const task of tasks) {
    for (const dep of task.blockedBy) {
      edges.push({ upstream: dep, downstream: task.id });
    }
  }

  for (const task of tasks) {
    for (const edge of edges) {
      if (edge.upstream === task.id && !task.blocking.includes(edge.downstream)) {
        task.blocking.push(edge.downstream);
      }
    }
  }

  return edges;
}

export const planParserTool: Tool<PlanParserParams, PlanParserResult> = {
  name: "plan-parser",
  description:
    "Parses a Markdown plan produced by planner-thorough into a DAG of tasks with dependency edges. " +
    "Extracts task steps, detects dependency keywords, and maps them to blocked_by/blocking relationships " +
    "suitable for database persistence and parallel swarm execution.",
  parameters: parametersSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  execute(params: PlanParserParams, context: ToolContext): Promise<ToolResult<PlanParserResult>> {
    context.emit("tool.start", { tool: "plan-parser", sessionId: params.sessionId });

    const tasks = parseMarkdownTasks(params.plan);
    const edges = buildGraph(tasks);

    const result: PlanParserResult = {
      tasks,
      edges,
      taskCount: tasks.length,
      edgeCount: edges.length,
    };

    context.emit("tool.end", {
      tool: "plan-parser",
      taskCount: tasks.length,
      edgeCount: edges.length,
    });

    return Promise.resolve({ success: true, data: result });
  },
};
