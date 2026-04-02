import { z } from "zod";

export const TokenUsageSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  turnId: z.string().nullable().optional(),
  agentId: z.string().nullable().optional(),
  model: z.string().min(1),
  provider: z.string().nullable().optional(),
  tokensIn: z.number().int().nonnegative().default(0),
  tokensOut: z.number().int().nonnegative().default(0),
  costUsd: z.number().nonnegative().default(0),
  timestamp: z.string(),
});
export type TokenUsage = z.infer<typeof TokenUsageSchema>;

export const RecordTokenUsageInputSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  turnId: z.string().optional(),
  agentId: z.string().optional(),
  model: z.string().min(1),
  provider: z.string().optional(),
  tokensIn: z.number().int().nonnegative().default(0),
  tokensOut: z.number().int().nonnegative().default(0),
  costUsd: z.number().nonnegative().default(0),
});
export type RecordTokenUsageInput = z.infer<typeof RecordTokenUsageInputSchema>;

export const SessionUsageSummarySchema = z.object({
  sessionId: z.string(),
  totalTokensIn: z.number().int().nonnegative(),
  totalTokensOut: z.number().int().nonnegative(),
  totalCostUsd: z.number().nonnegative(),
  recordCount: z.number().int().nonnegative(),
});
export type SessionUsageSummary = z.infer<typeof SessionUsageSummarySchema>;

export const ModelUsageBreakdownSchema = z.object({
  model: z.string(),
  totalTokensIn: z.number().int().nonnegative(),
  totalTokensOut: z.number().int().nonnegative(),
  totalCostUsd: z.number().nonnegative(),
  recordCount: z.number().int().nonnegative(),
});
export type ModelUsageBreakdown = z.infer<typeof ModelUsageBreakdownSchema>;

export const AgentUsageSummarySchema = z.object({
  agentId: z.string().nullable(),
  totalTokensIn: z.number().int().nonnegative(),
  totalTokensOut: z.number().int().nonnegative(),
  totalCostUsd: z.number().nonnegative(),
  recordCount: z.number().int().nonnegative(),
});
export type AgentUsageSummary = z.infer<typeof AgentUsageSummarySchema>;
