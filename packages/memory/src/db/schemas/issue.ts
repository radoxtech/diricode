import { z } from "zod";

// --- Enums ---
export const IssueStatusSchema = z.enum(["open", "in_progress", "done", "closed"]);
export type IssueStatus = z.infer<typeof IssueStatusSchema>;

export const IssuePrioritySchema = z.enum(["critical", "high", "medium", "low"]);
export type IssuePriority = z.infer<typeof IssuePrioritySchema>;

// --- Domain types ---
export const IssueSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  status: IssueStatusSchema,
  priority: IssuePrioritySchema,
  labels: z.array(z.string()).default([]),
  parentId: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Issue = z.infer<typeof IssueSchema>;

// --- Input types ---
export const CreateIssueInputSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  priority: IssuePrioritySchema.default("medium"),
  labels: z.array(z.string()).default([]),
  parentId: z.string().optional(),
});
export type CreateIssueInput = z.infer<typeof CreateIssueInputSchema>;

export const UpdateIssueInputSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: IssueStatusSchema.optional(),
  priority: IssuePrioritySchema.optional(),
  labels: z.array(z.string()).optional(),
  parentId: z.string().nullable().optional(),
});
export type UpdateIssueInput = z.infer<typeof UpdateIssueInputSchema>;

export const ListIssuesFilterSchema = z.object({
  status: IssueStatusSchema.optional(),
  priority: IssuePrioritySchema.optional(),
  labels: z.array(z.string()).optional(),
  parentId: z.string().optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
});
export type ListIssuesFilter = z.input<typeof ListIssuesFilterSchema>;
export type ParsedListIssuesFilter = z.infer<typeof ListIssuesFilterSchema>;

// --- Interface (backend-agnostic) ---
export interface IIssueClient {
  createIssue(input: CreateIssueInput): Issue;
  getIssue(id: string): Issue | undefined;
  updateIssue(id: string, input: UpdateIssueInput): Issue | undefined;
  closeIssue(id: string): Issue | undefined;
  deleteIssue(id: string): boolean;
  listIssues(filter?: ListIssuesFilter): Issue[];
  searchIssues(query: string, filter?: ListIssuesFilter): Issue[];
  getChildren(parentId: string): Issue[];
  getDescendants(rootId: string): Issue[];
}
