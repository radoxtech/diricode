import { z } from "zod";

/**
 * Type of semantic relationship between issues.
 */
export const RelationSemanticTypeSchema = z.enum([
  "BLOCKED_BY",
  "BLOCKS",
  "DUPLICATES",
  "SUBTASK_OF",
  "PARENT_OF",
  "DEPENDS_ON_DATA",
  "SHARES_UI_PATTERN",
  "RELATES_TO_GENERAL",
]);

export type RelationSemanticType = z.infer<typeof RelationSemanticTypeSchema>;

/**
 * A directed semantic edge connecting this issue to another.
 */
export const SemanticRelationSchema = z.object({
  type: RelationSemanticTypeSchema,
  targetKey: z.string().min(1),
  reason: z.string().optional(),
});

export type SemanticRelation = z.infer<typeof SemanticRelationSchema>;

/**
 * Lifecycle status of an issue.
 */
export const IssueStatusSchema = z.enum([
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
  "CANCELED",
]);

export type IssueStatus = z.infer<typeof IssueStatusSchema>;

/**
 * Core issue representation separating business and execution contexts.
 */
export const IssueSchema = z.object({
  id: z.string().uuid(),
  externalId: z.number().int().nonnegative().optional(),
  domain: z.string().min(1),
  subModule: z.string().min(1),
  sequenceId: z.number().int().nonnegative(),
  key: z.string().min(1),
  title: z.string().min(1),
  status: IssueStatusSchema,
  businessContext: z.object({
    description: z.string(),
    epic: z.string().optional(),
  }),
  executionContext: z.object({
    complexity: z.number().min(1).max(10),
    impact: z.enum(["local", "feature", "systemic"]),
  }),
  relations: z.array(SemanticRelationSchema).default([]),
});

export type Issue = z.infer<typeof IssueSchema>;

export { initDatabase } from "./lib/database.js";
export type { DatabaseInstance } from "./lib/database.js";
export {
  EdgeStorage,
  EdgeValidationError,
  CycleDetectedError,
  DuplicateEdgeError,
} from "./lib/edges.js";
export type { CreateEdgeInput, EdgeFilters } from "./lib/edges.js";
export { SearchEngine } from "./lib/search.js";
export * from "./types/index.js";
export * from "./legacy.js";
export { NodeStorage } from "./lib/storage.js";
export { NamespaceStorage } from "./lib/namespaces.js";
