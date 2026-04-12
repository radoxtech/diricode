import { z } from "zod";

export const NamespaceTypeSchema = z.enum(["docs", "plan", "reference"]);
export type NamespaceType = z.infer<typeof NamespaceTypeSchema>;

export const NodeTypeSchema = z.enum([
  "document",
  "feature",
  "component",
  "task",
  "epic",
  "phase",
  "sprint",
  "milestone",
  "reference_project",
  "reference_feature",
]);
export type NodeType = z.infer<typeof NodeTypeSchema>;

export const NodeStatusSchema = z.enum([
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
  "CANCELED",
]);
export type NodeStatus = z.infer<typeof NodeStatusSchema>;

export const BaseNodeSchema = z.object({
  id: z.string().uuid(),
  namespace_id: z.string().min(1),
  type: NodeTypeSchema,
  title: z.string().min(1),
  description: z.string().default(""),
  status: NodeStatusSchema.default("BACKLOG"),
  labels: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
  parentId: z.string().uuid().optional(),
  created_at: z
    .string()
    .datetime()
    .default(() => new Date().toISOString()),
  updated_at: z
    .string()
    .datetime()
    .default(() => new Date().toISOString()),
});
export type BaseNode = z.infer<typeof BaseNodeSchema>;

export const DocumentNodeSchema = BaseNodeSchema.extend({
  type: z.literal("document"),
});
export type DocumentNode = z.infer<typeof DocumentNodeSchema>;

export const FeatureNodeSchema = BaseNodeSchema.extend({
  type: z.literal("feature"),
});
export type FeatureNode = z.infer<typeof FeatureNodeSchema>;

export const ComponentNodeSchema = BaseNodeSchema.extend({
  type: z.literal("component"),
});
export type ComponentNode = z.infer<typeof ComponentNodeSchema>;

export const TaskNodeSchema = BaseNodeSchema.extend({
  type: z.literal("task"),
});
export type TaskNode = z.infer<typeof TaskNodeSchema>;

export const EpicNodeSchema = BaseNodeSchema.extend({
  type: z.literal("epic"),
});
export type EpicNode = z.infer<typeof EpicNodeSchema>;

export const PhaseNodeSchema = BaseNodeSchema.extend({
  type: z.literal("phase"),
});
export type PhaseNode = z.infer<typeof PhaseNodeSchema>;

export const SprintNodeSchema = BaseNodeSchema.extend({
  type: z.literal("sprint"),
});
export type SprintNode = z.infer<typeof SprintNodeSchema>;

export const MilestoneNodeSchema = BaseNodeSchema.extend({
  type: z.literal("milestone"),
});
export type MilestoneNode = z.infer<typeof MilestoneNodeSchema>;

export const ReferenceProjectNodeSchema = BaseNodeSchema.extend({
  type: z.literal("reference_project"),
});
export type ReferenceProjectNode = z.infer<typeof ReferenceProjectNodeSchema>;

export const ReferenceFeatureNodeSchema = BaseNodeSchema.extend({
  type: z.literal("reference_feature"),
});
export type ReferenceFeatureNode = z.infer<typeof ReferenceFeatureNodeSchema>;

export const NodeSchemaMap = {
  document: DocumentNodeSchema,
  feature: FeatureNodeSchema,
  component: ComponentNodeSchema,
  task: TaskNodeSchema,
  epic: EpicNodeSchema,
  phase: PhaseNodeSchema,
  sprint: SprintNodeSchema,
  milestone: MilestoneNodeSchema,
  reference_project: ReferenceProjectNodeSchema,
  reference_feature: ReferenceFeatureNodeSchema,
} as const;

export const NodeSchema = z.discriminatedUnion("type", [
  DocumentNodeSchema,
  FeatureNodeSchema,
  ComponentNodeSchema,
  TaskNodeSchema,
  EpicNodeSchema,
  PhaseNodeSchema,
  SprintNodeSchema,
  MilestoneNodeSchema,
  ReferenceProjectNodeSchema,
  ReferenceFeatureNodeSchema,
]);
export type Node = z.infer<typeof NodeSchema>;

export type NodeMap = {
  [K in NodeType]: Extract<Node, { type: K }>;
};
