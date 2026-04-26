import {
  CANONICAL_ROUTING_TAGS,
  ROUTING_TAG_DEFINITIONS,
  STACK_SIGNALS,
  PROBLEM_SIGNALS,
  AGENT_ARCHETYPE_SIGNALS,
} from "./routing-taxonomy.js";

export interface ClassifierPromptInput {
  agentRole: string;
  agentSeniority: string;
  agentSpecializations: string[];
  taskType: string;
  taskDescription: string;
}

function formatTagDictionary(): string {
  return CANONICAL_ROUTING_TAGS.map((tag) => `- ${tag}: ${ROUTING_TAG_DEFINITIONS[tag]}`).join(
    "\n",
  );
}

function formatHintDictionary(): string {
  const sections = [
    ["Stack signals", STACK_SIGNALS],
    ["Problem signals", PROBLEM_SIGNALS],
  ] as const;

  const formattedSections = sections.map(([title, groups]) => {
    const body = Object.entries(groups)
      .map(([group, values]) => `  - ${group}: ${values.join(", ")}`)
      .join("\n");
    return `${title}:\n${body}`;
  });

  formattedSections.push(`Agent archetype signals:\n  - ${AGENT_ARCHETYPE_SIGNALS.join(", ")}`);

  return formattedSections.join("\n\n");
}

export const ROUTING_CLASSIFIER_SYSTEM_PROMPT = `You are a routing classifier for software-agent tasks.

Your job is to map an agent/task description into the most relevant routing tags.

You must classify based on the actual work being asked for, not vague associations.

Return the most relevant tags from the allowed tag list.
Prefer the main execution intent over peripheral details.

Important rules:
- Do not use quality as a fallback tag.
- Use reasoning only when the task is genuinely logic-heavy, algorithmic, analytical, or multi-step.
- Use coding for feature implementation, writing code, APIs, components, scripts, or integrations.
- Use debugging for broken behavior, bugs, regressions, crashes, and diagnosis.
- Use code-review for reviewing code, PRs, diffs, audit, maintainability, or security review.
- Use ui-ux for frontend UI, landing pages, components, design systems, styling, and visual interaction work.
- Use architecture for system design, data flow, boundaries, scalability, and structure.
- Use refactoring for cleanup, modernization, technical debt reduction, and improving existing code structure.
- Use testing for unit/integration/e2e tests and test coverage work.
- Use tool-use for workflows centered on tools, terminal steps, APIs, automation, or MCP/CLI usage.
- Use repo-understanding when the task is primarily about understanding a larger codebase across files/modules.
- Use instruction-fidelity when the task strongly emphasizes exact format, strict constraints, schema compliance, or precise adherence.
- Use research for external investigation, documentation lookup, or option comparison.
- Use devops for infra, deploy, CI/CD, cloud, environments, and ops workflows.
- Use security for auth, permissions, vulnerabilities, secrets, and attack surface work.
- Use data for SQL, schemas, migrations, ETL, analytics, and data transformations.
- Use planning when the main task is choosing an approach or breaking work into steps before implementation.

Return at most 3 primary tags and at most 4 secondary tags.
Do not force tags that are only weakly related.`;

export function buildRoutingClassifierUserPrompt(input: ClassifierPromptInput): string {
  return `Allowed routing tags:
${CANONICAL_ROUTING_TAGS.map((tag) => `- ${tag}`).join("\n")}

Tag definitions:
${formatTagDictionary()}

Stack / problem hints:
${formatHintDictionary()}

Agent role: ${input.agentRole}
Agent seniority: ${input.agentSeniority}
Agent specializations: ${input.agentSpecializations.join(", ") || "(none)"}
Task type: ${input.taskType}
Task description: ${input.taskDescription}

Return JSON only:
{
  "primary_tags": [
    { "tag": string, "score": number, "why": string }
  ],
  "secondary_tags": [
    { "tag": string, "score": number, "why": string }
  ],
  "excluded_tags": [
    { "tag": string, "why_not": string }
  ],
  "evidence": {
    "stack_signals": string[],
    "problem_signals": string[],
    "agent_signals": string[]
  },
  "summary": string
}`;
}

export function buildCompactRoutingClassifierPrompt(input: ClassifierPromptInput): string {
  return `Classify this software-agent task into routing tags.

Allowed tags:
${CANONICAL_ROUTING_TAGS.join(", ")}

Rules:
- prefer main execution intent
- do not use quality as fallback
- return at most 3 primary tags
- return JSON only

Input:
role=${input.agentRole}
seniority=${input.agentSeniority}
specializations=${input.agentSpecializations.join(", ") || "(none)"}
task_type=${input.taskType}
description=${input.taskDescription}

JSON:
{
  "primary_tags": [],
  "secondary_tags": [],
  "summary": ""
}`;
}
