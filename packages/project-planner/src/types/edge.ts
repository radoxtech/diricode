import { z } from "zod";

export const EdgeTypeSchema = z.enum([
  "depends_on",
  "blocks",
  "implements",
  "related_to",
  "contains",
  "precedes",
  "tracks",
  "duplicates",
]);
export type EdgeType = z.infer<typeof EdgeTypeSchema>;

export const SoftRelationTypeSchema = z.enum([
  "compares_to",
  "inspires",
  "must_align_with",
  "supersedes",
  "diverges_from",
]);
export type SoftRelationType = z.infer<typeof SoftRelationTypeSchema>;

export const RelationStrengthSchema = z.enum(["soft", "medium", "strong"]);
export type RelationStrength = z.infer<typeof RelationStrengthSchema>;

export const EdgeKindSchema = z.enum(["hard", "soft"]);
export type EdgeKind = z.infer<typeof EdgeKindSchema>;

export const AnyEdgeTypeSchema = z.union([EdgeTypeSchema, SoftRelationTypeSchema]);
export type AnyEdgeType = z.infer<typeof AnyEdgeTypeSchema>;

export const EdgeSchema = z
  .object({
    id: z.string().uuid(),
    source_id: z.string().uuid(),
    target_id: z.string().uuid(),
    type: AnyEdgeTypeSchema,
    kind: EdgeKindSchema.default("hard"),
    strength: RelationStrengthSchema.optional(),
    notes: z.string().optional(),
    created_at: z
      .string()
      .datetime()
      .default(() => new Date().toISOString()),
  })
  .superRefine((edge, ctx) => {
    if (edge.kind === "soft" && edge.strength === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "strength is required for soft edges",
        path: ["strength"],
      });
    }
  });
export type Edge = z.infer<typeof EdgeSchema>;
