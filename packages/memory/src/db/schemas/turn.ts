import { z } from "zod";

export const TurnStatusSchema = z.enum(["running", "completed", "failed", "timeout"]);
export type TurnStatus = z.infer<typeof TurnStatusSchema>;

export const TurnTelemetrySchema = z.object({
  totalTokens: z.number().int().nonnegative().default(0),
  totalToolCalls: z.number().int().nonnegative().default(0),
  totalCost: z.number().nonnegative().default(0),
  agentName: z.string().optional(),
  modelUsed: z.string().optional(),
  executionId: z.string().optional(),
});
export type TurnTelemetry = z.infer<typeof TurnTelemetrySchema>;

export const TurnPartialResultSchema = z.object({
  agentName: z.string(),
  toolCalls: z.number().int().nonnegative(),
  tokensUsed: z.number().int().nonnegative(),
  output: z.string(),
});
export type TurnPartialResult = z.infer<typeof TurnPartialResultSchema>;

export const TurnEnvelopeDataSchema = z.object({
  turnId: z.string().min(1),
  sessionId: z.string().min(1),
  status: TurnStatusSchema,
  startedAt: z.number(),
  endedAt: z.number().nullable().optional(),
  durationMs: z.number().nonnegative(),
  input: z.string(),
  outputSummary: z.string().default(""),
  telemetry: TurnTelemetrySchema.default({}),
  error: z.string().optional(),
  partialResults: z.array(TurnPartialResultSchema).default([]),
});
export type TurnEnvelopeData = z.infer<typeof TurnEnvelopeDataSchema>;

export const TurnEventSchema = z.object({
  id: z.string().min(1),
  turnId: z.string().min(1),
  sessionId: z.string().min(1),
  eventType: z.enum(["turn.start", "turn.end", "turn.timeout"]),
  payload: z.record(z.unknown()),
  timestamp: z.string(),
});
export type TurnEvent = z.infer<typeof TurnEventSchema>;
