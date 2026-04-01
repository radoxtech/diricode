import { z } from "zod";
import { normalize, resolve } from "node:path";
import { existsSync } from "node:fs";
import type { Tool, ToolContext, ToolResult } from "../../core/src/tools/types.js";
import { ToolError } from "../../core/src/tools/types.js";

export const DiagnosticAnalyzerParamsSchema = z.object({
  error: z.string().describe("Error message or stack trace"),
  errorType: z
    .enum(["compile", "test", "runtime", "linter", "unknown"])
    .optional()
    .describe("Type of error"),
  context: z
    .object({
      recentFiles: z.array(z.string()).optional().describe("Recently modified files"),
      recentCommands: z.array(z.string()).optional().describe("Recent commands that failed"),
      gitDiff: z.string().optional().describe("Current uncommitted changes"),
      logs: z.string().optional().describe("Relevant logs"),
      lspDiagnostics: z.array(z.any()).optional().describe("LSP error output"),
    })
    .optional()
    .describe("Additional context for diagnosis"),
  depth: z.enum(["surface", "deep"]).default("surface").describe("Analysis depth"),
});

export type DiagnosticAnalyzerParams = z.infer<typeof DiagnosticAnalyzerParamsSchema>;

export interface DiagnosticAnalyzerResult {
  rootCause: string;
  confidence: number; // 0-1
  hypotheses: {
    description: string;
    probability: number; // 0-1
    evidence: string[];
    counterEvidence: string[];
  }[];
  timeline: {
    event: string;
    timestamp: string;
    relevance: "high" | "medium" | "low";
  }[];
  recommendations: string[];
  relevantFiles: string[];
}

export const diagnosticAnalyzerTool: Tool<DiagnosticAnalyzerParams, DiagnosticAnalyzerResult> = {
  name: "diagnostic-analyzer",
  description:
    "Structured error analysis tool — aggregates information from multiple sources (stack traces, logs, LSP diagnostics, git diff) and produces a diagnosis report with root cause hypotheses and evidence.",
  parameters: DiagnosticAnalyzerParamsSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  execute: async (
    params: DiagnosticAnalyzerParams,
    context: ToolContext,
  ): Promise<ToolResult<DiagnosticAnalyzerResult>> => {
    context.emit("tool.start", { name: "diagnostic-analyzer", params });
    const startTime = Date.now();
    try {
      const { error, errorType = "unknown", context: diagContext, depth } = params;

      // 1. Aggregate evidence
      let aggregatedEvidence = `Error Type: ${errorType}\n\n`;
      aggregatedEvidence += `Error Message/Stack Trace:\n${error}\n\n`;

      if (diagContext) {
        if (diagContext.lspDiagnostics && diagContext.lspDiagnostics.length > 0) {
          aggregatedEvidence += `LSP Diagnostics:\n${JSON.stringify(diagContext.lspDiagnostics, null, 2)}\n\n`;
        }
        if (diagContext.logs) {
          aggregatedEvidence += `Logs:\n${diagContext.logs}\n\n`;
        }
        if (diagContext.gitDiff) {
          aggregatedEvidence += `Git Diff Summary:\n${diagContext.gitDiff}\n\n`;
        }
        if (diagContext.recentFiles && diagContext.recentFiles.length > 0) {
          aggregatedEvidence += `Recently Modified Files:\n- ${diagContext.recentFiles.join("\n- ")}\n\n`;
        }
        if (diagContext.recentCommands && diagContext.recentCommands.length > 0) {
          aggregatedEvidence += `Recent Failed Commands:\n- ${diagContext.recentCommands.join("\n- ")}\n\n`;
        }
      }

      // 2. Build analysis prompt
      // TODO: LLM call — pass _analysisPrompt to the LLM picker/router.
      // Pattern: generateText({ prompt: _analysisPrompt, ... })
      // The analysis prompt structures the diagnostic request for the LLM.
      const _analysisPrompt = `
You are an expert diagnostic analyzer. Based on the following error and context, perform a ${depth} root cause analysis.
Return your response ONLY as a JSON object matching the following structure exactly (no markdown formatting blocks):

{
  "rootCause": "Clear explanation of the primary root cause",
  "confidence": 0.9,
  "hypotheses": [
    {
      "description": "Hypothesis 1",
      "probability": 0.8,
      "evidence": ["evidence 1"],
      "counterEvidence": ["counter evidence 1"]
    }
  ],
  "timeline": [
    {
      "event": "What happened",
      "timestamp": "ISO timestamp or relative time",
      "relevance": "high"
    }
  ],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "relevantFiles": ["path/to/file1.ts"]
}

EVIDENCE:
${aggregatedEvidence}
`;

      // 3 & 4. Call the LLM and parse response
      // TODO: Integrate with LLM provider. The _analysisPrompt above should be sent to
      // the LLM picker/router. Example integration point:
      // const completion = await generateText({ prompt: _analysisPrompt, ... });
      // const resultData = JSON.parse(completion.text) as DiagnosticAnalyzerResult;
      void _analysisPrompt; // Avoid linter warning — prompt is ready for LLM integration

      // Mock result since LLM call is deferred — replace with parsed LLM response
      const rawResult = await Promise.resolve({
        rootCause: "Pending LLM analysis of the provided evidence.",
        confidence: 0,
        hypotheses: [],
        timeline: [],
        recommendations: ["Integrate LLM provider to complete diagnostic analysis."],
        relevantFiles: [] as string[],
      });

      const result: DiagnosticAnalyzerResult = {
        ...rawResult,
        // Validate workspace files mentioned in the result
        relevantFiles: rawResult.relevantFiles.filter((file) => {
          try {
            const fullPath = resolve(context.workspaceRoot, normalize(file));
            return existsSync(fullPath) && fullPath.startsWith(context.workspaceRoot);
          } catch {
            return false;
          }
        }),
      };

      context.emit("tool.end", { name: "diagnostic-analyzer", duration: Date.now() - startTime });
      return { success: true, data: result };
    } catch (e) {
      context.emit("tool.end", { name: "diagnostic-analyzer", error: true });
      if (e instanceof ToolError) {
        throw e;
      }
      throw new ToolError(
        e instanceof Error ? e.constructor.name : "Error",
        e instanceof Error ? e.message : String(e),
      );
    }
  },
};
