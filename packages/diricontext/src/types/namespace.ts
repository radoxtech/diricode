import { z } from "zod";

import { NamespaceTypeSchema } from "./node.js";
import type { NamespaceType } from "./node.js";

export const NamespaceSchema = z.object({
  id: z.string().min(1),
  type: NamespaceTypeSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  created_at: z
    .string()
    .datetime()
    .default(() => new Date().toISOString()),
});
export type Namespace = z.infer<typeof NamespaceSchema>;

export function getNamespaceId(type: NamespaceType, name?: string): string {
  switch (type) {
    case "docs":
      return "docs";
    case "plan":
      return "plan";
    case "reference":
      if (!name || name.trim().length === 0) {
        throw new Error("name is required for reference namespaces");
      }

      return `reference:${name}`;
  }
}
