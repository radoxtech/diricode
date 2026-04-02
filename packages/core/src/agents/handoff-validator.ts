import type { ContextHandoffEnvelope } from "./protocol.js";
import { AgentProtocolError } from "./protocol.js";

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
}

export interface ValidationError {
  readonly field: string;
  readonly message: string;
  readonly severity: "warning" | "error";
}

export function validateHandoffEnvelope(envelope: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (!envelope || typeof envelope !== "object") {
    return {
      valid: false,
      errors: [{ field: "envelope", message: "Envelope must be an object", severity: "error" }],
    };
  }

  const env = envelope as Record<string, unknown>;

  if (!env.handoffId || typeof env.handoffId !== "string") {
    errors.push({
      field: "handoffId",
      message: "handoffId is required and must be a string",
      severity: "error",
    });
  }

  if (!env.parent || typeof env.parent !== "object") {
    errors.push({
      field: "parent",
      message: "parent is required and must be an object",
      severity: "error",
    });
  } else {
    const parent = env.parent as Record<string, unknown>;
    if (!parent.executionId || typeof parent.executionId !== "string") {
      errors.push({
        field: "parent.executionId",
        message: "parent.executionId is required",
        severity: "error",
      });
    }
    if (!parent.agentName || typeof parent.agentName !== "string") {
      errors.push({
        field: "parent.agentName",
        message: "parent.agentName is required",
        severity: "error",
      });
    }
    if (!parent.sessionId || typeof parent.sessionId !== "string") {
      errors.push({
        field: "parent.sessionId",
        message: "parent.sessionId is required",
        severity: "error",
      });
    }
  }

  if (!env.childExecutionId || typeof env.childExecutionId !== "string") {
    errors.push({
      field: "childExecutionId",
      message: "childExecutionId is required",
      severity: "error",
    });
  }

  if (!env.goal || typeof env.goal !== "object") {
    errors.push({
      field: "goal",
      message: "goal is required and must be an object",
      severity: "error",
    });
  } else {
    const goal = env.goal as Record<string, unknown>;
    if (!goal.taskDescription || typeof goal.taskDescription !== "string") {
      errors.push({
        field: "goal.taskDescription",
        message: "goal.taskDescription is required",
        severity: "error",
      });
    }
    if (!Array.isArray(goal.successCriteria)) {
      errors.push({
        field: "goal.successCriteria",
        message: "goal.successCriteria must be an array",
        severity: "error",
      });
    }
  }

  if (!env.inheritanceRules || typeof env.inheritanceRules !== "object") {
    errors.push({
      field: "inheritanceRules",
      message: "inheritanceRules is required",
      severity: "error",
    });
  } else {
    const rules = env.inheritanceRules as Record<string, unknown>;
    const validModes = ["isolated", "summary", "full"];
    if (!rules.mode || !validModes.includes(rules.mode as string)) {
      errors.push({
        field: "inheritanceRules.mode",
        message: `mode must be one of: ${validModes.join(", ")}`,
        severity: "error",
      });
    }
  }

  if (!env.context || typeof env.context !== "object") {
    errors.push({
      field: "context",
      message: "context is required and must be an object",
      severity: "error",
    });
  } else {
    const context = env.context as Record<string, unknown>;
    if (typeof context.tokenCount !== "number") {
      errors.push({
        field: "context.tokenCount",
        message: "context.tokenCount is required and must be a number",
        severity: "error",
      });
    }
  }

  if (!env.workspaceRoot || typeof env.workspaceRoot !== "string") {
    errors.push({
      field: "workspaceRoot",
      message: "workspaceRoot is required",
      severity: "error",
    });
  }

  if (
    !(env.timestamp instanceof Date) &&
    !(typeof env.timestamp === "string" && !isNaN(Date.parse(env.timestamp)))
  ) {
    errors.push({
      field: "timestamp",
      message: "timestamp must be a valid Date",
      severity: "error",
    });
  }

  return {
    valid: errors.filter((e) => e.severity === "error").length === 0,
    errors,
  };
}

export function assertValidHandoffEnvelope(
  envelope: unknown,
): asserts envelope is ContextHandoffEnvelope {
  const result = validateHandoffEnvelope(envelope);
  if (!result.valid) {
    const errorMessages = result.errors
      .filter((e) => e.severity === "error")
      .map((e) => `${e.field}: ${e.message}`)
      .join("; ");
    throw new AgentProtocolError("HANDOFF_FAILED", `Invalid handoff envelope: ${errorMessages}`);
  }
}

export function isValidHandoffEnvelope(envelope: unknown): envelope is ContextHandoffEnvelope {
  const result = validateHandoffEnvelope(envelope);
  return result.valid;
}
