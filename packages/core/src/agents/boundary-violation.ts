import { AgentError } from "./types.js";

export type ViolationSeverity = "warning" | "error" | "critical";

export type BoundaryViolationType =
  | "dispatcher.boundary.violation.tool_attempt"
  | "dispatcher.boundary.violation.state_mutation"
  | "dispatcher.boundary.violation.unauthorized_delegation";

export interface BoundaryViolationEvent {
  type: BoundaryViolationType;
  severity: ViolationSeverity;
  attemptedAction: string;
  agentName: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export class BoundaryViolationError extends AgentError {
  constructor(
    public readonly violationType: BoundaryViolationType,
    public readonly attemptedAction: string,
    message: string,
    public readonly severity: ViolationSeverity = "error",
  ) {
    super("BOUNDARY_VIOLATION", message);
    this.name = "BoundaryViolationError";
  }

  toEvent(agentName: string): BoundaryViolationEvent {
    return {
      type: this.violationType,
      severity: this.severity,
      attemptedAction: this.attemptedAction,
      agentName,
      timestamp: new Date().toISOString(),
    };
  }
}

import type { Tool, ToolContext } from "../tools/types.js";
import { isToolAllowed } from "../tools/types.js";
import { DISPATCHER_CONTRACT } from "./dispatcher-contract.js";

export function enforceDispatcherBoundary(
  tools: readonly Tool[],
  emit: (event: string, payload: unknown) => void,
): Tool[] {
  return tools.map((tool) => {
    if (isToolAllowed(tool.name, { allowedTools: DISPATCHER_CONTRACT.allowedTools })) {
      return tool;
    }
    return {
      ...tool,
      execute: (_params: unknown, _context: ToolContext): Promise<never> => {
        const error = new BoundaryViolationError(
          "dispatcher.boundary.violation.tool_attempt",
          tool.name,
          `Dispatcher is prohibited from using mutating or unauthorized tool: ${tool.name}`,
        );
        emit("dispatcher.boundary.violation.tool_attempt", error.toEvent("dispatcher"));
        return Promise.reject(error);
      },
    };
  });
}
