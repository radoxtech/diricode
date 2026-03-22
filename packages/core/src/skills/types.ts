import { z } from "zod";

/**
 * SkillDefinition represents a discrete, reusable capability (prompt, tool, knowledge base)
 * that extends an agent or workflow. Based on agentskills.io SKILL.md frontmatter.
 *
 * References: ADR-008 (skill system), ADR-043 (LLM skills loader)
 */

export const SkillDefinitionSchema = z.object({
  // Core metadata
  id: z.string().describe("Unique identifier for the skill (e.g., 'code-review', 'web-research')"),
  name: z.string().describe("Human-readable skill name"),
  description: z.string().describe("Brief description of what this skill does"),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .describe("Semantic version (e.g., '1.0.0')"),

  // Classification
  family: z
    .enum(["reasoning", "creative", "ui-ux", "speed", "web-research", "bulk", "agentic"])
    .describe("Skill capability family (from ADR-005)"),
  tags: z.array(z.string()).default([]).describe("Additional tags for discovery"),

  // Tool and capability definitions
  tools: z
    .array(z.string())
    .default([])
    .describe("List of tool names this skill provides or requires"),
  references: z
    .array(
      z.object({
        path: z
          .string()
          .describe("Relative path to reference file (e.g., 'references/pattern.md')"),
        type: z
          .enum(["docs", "example", "pattern", "guide"])
          .describe("Reference type for categorization"),
      }),
    )
    .default([])
    .describe("Optional reference files included in the skill"),

  // Prompting and behavior
  systemPrompt: z
    .string()
    .optional()
    .describe("Optional system prompt override for agents using this skill"),
  instructions: z.string().optional().describe("Step-by-step instructions for applying this skill"),
  examples: z.array(z.string()).default([]).describe("Example use cases or scenarios"),

  // Execution constraints
  minContextWindow: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Minimum context window required (tokens)"),
  maxTokensPerCall: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Maximum tokens to allocate per invocation"),

  // Scope and inheritance
  scope: z
    .enum(["personal", "workspace", "family-default"])
    .default("workspace")
    .describe("Shadowing level: personal > workspace > family-default (ADR-008)"),
  inherits: z
    .array(z.string())
    .default([])
    .describe("Skill IDs that this skill extends or depends on"),

  // Metadata for discovery
  author: z.string().optional().describe("Skill author or maintainer"),
  repository: z.string().url().optional().describe("URL to skill repository (e.g., GitHub)"),
  license: z.string().optional().describe("License identifier (e.g., 'MIT', 'Apache-2.0')"),
  createdAt: z.string().datetime().optional().describe("ISO 8601 timestamp of skill creation"),
  updatedAt: z.string().datetime().optional().describe("ISO 8601 timestamp of last update"),
});

export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>;

/**
 * SkillManifest represents a loaded skill with resolved paths and references.
 * This is the internal representation after loading a SKILL.md file.
 */
export interface SkillManifest extends SkillDefinition {
  readonly diskPath: string; // Absolute path to skill directory on disk
  readonly skillMdPath: string; // Absolute path to SKILL.md file
}

/**
 * SkillLoadResult indicates the outcome of loading a skill.
 */
export type SkillLoadResult =
  | {
      success: true;
      manifest: SkillManifest;
    }
  | {
      success: false;
      error: string;
    };
