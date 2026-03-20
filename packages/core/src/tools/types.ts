import type { ZodType, ZodTypeDef } from "zod";

export interface ToolAnnotations {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
}

export interface ToolContext {
  workspaceRoot: string;
  emit: (event: string, payload: unknown) => void;
}

export interface ToolResult<T = unknown> {
  success: true;
  data: T;
}

export class ToolError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ToolError";
  }
}

export interface Tool<TParams = unknown, TResult = unknown> {
  name: string;
  description: string;
  parameters: ZodType<TParams, ZodTypeDef, unknown>;
  annotations: ToolAnnotations;
  execute: (params: TParams, context: ToolContext) => Promise<ToolResult<TResult>>;
}
