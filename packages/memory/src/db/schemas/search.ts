import { z } from "zod";

export const ObservationTypeSchema = z.enum([
  "file_read",
  "file_write",
  "command_run",
  "decision",
  "discovery",
  "error",
]);

export type ObservationType = z.infer<typeof ObservationTypeSchema>;

export const ObservationSchema = z.object({
  id: z.number().int().positive(),
  type: ObservationTypeSchema,
  content: z.string(),
  sessionId: z.string().nullable().optional(),
  agentId: z.string().nullable().optional(),
  taskId: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.string(),
  timestamp: z.string().nullable().optional(),
});

export type Observation = z.infer<typeof ObservationSchema>;

export const SearchResultSourceSchema = z.enum(["message", "observation"]);

export type SearchResultSource = z.infer<typeof SearchResultSourceSchema>;

export const SearchResultSchema = z.object({
  source: SearchResultSourceSchema,
  id: z.union([z.string(), z.number()]),
  sessionId: z.string().nullable().optional(),
  agentId: z.string().nullable().optional(),
  content: z.string(),
  excerpt: z.string(),
  score: z.number(),
  timestamp: z.string().nullable().optional(),
  observationType: ObservationTypeSchema.nullable().optional(),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

export const SearchFilterSchema = z.object({
  sessionId: z.string().optional(),
  agentId: z.string().optional(),
  observationType: ObservationTypeSchema.optional(),
  fromTimestamp: z.string().optional(),
  toTimestamp: z.string().optional(),
  limit: z.number().int().positive().max(100).default(20),
});

export type SearchFilter = z.input<typeof SearchFilterSchema>;

export type ParsedSearchFilter = z.infer<typeof SearchFilterSchema>;

export const CreateObservationInputSchema = z.object({
  type: ObservationTypeSchema,
  content: z.string().min(1),
  sessionId: z.string().optional(),
  agentId: z.string().optional(),
  taskId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.string().optional(),
});

export type CreateObservationInput = z.infer<typeof CreateObservationInputSchema>;
