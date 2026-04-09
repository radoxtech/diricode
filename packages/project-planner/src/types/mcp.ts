import { z } from "zod";

export const McpToolRequestSchema = z.object({
  tool: z.string().min(1),
  arguments: z.record(z.unknown()),
});
export type McpToolRequest = z.infer<typeof McpToolRequestSchema>;

export const McpToolResponseSchema = z.object({
  content: z.array(
    z.object({
      type: z.string().min(1),
      text: z.string(),
    }),
  ),
  isError: z.boolean().optional(),
});
export type McpToolResponse = z.infer<typeof McpToolResponseSchema>;
