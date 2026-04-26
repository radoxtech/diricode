export const CANONICAL_ROUTING_TAGS = [
  "coding",
  "debugging",
  "code-review",
  "testing",
  "reasoning",
  "planning",
  "architecture",
  "ui-ux",
  "refactoring",
  "instruction-fidelity",
  "repo-understanding",
  "tool-use",
  "speed",
  "bulk-processing",
  "creative",
  "security",
  "devops",
  "data",
  "research",
] as const;

export type CanonicalRoutingTag = (typeof CANONICAL_ROUTING_TAGS)[number];

export const ROUTING_TAG_DEFINITIONS: Record<CanonicalRoutingTag, string> = {
  coding:
    "Implementing software, writing code, building features, APIs, scripts, components, services, and integrations.",
  debugging:
    "Finding root causes, fixing broken behavior, errors, crashes, regressions, failed builds, and failing tests.",
  "code-review":
    "Reviewing code, pull requests, diffs, maintainability, best practices, architectural quality, and security issues.",
  testing:
    "Writing or improving unit, integration, or end-to-end tests, test coverage, and flaky test diagnosis.",
  reasoning: "Logic-heavy, analytical, algorithmic, mathematical, or multi-step problem solving.",
  planning:
    "Choosing an approach, breaking work into steps, sequencing execution, and deciding implementation strategy before coding.",
  architecture:
    "System design, service boundaries, data flow, APIs, databases, scalability, and structural decisions.",
  "ui-ux":
    "Frontend UI work, landing pages, design systems, styling, interaction design, React/Vue components, and visual polish.",
  refactoring:
    "Improving existing code without changing product behavior, cleanup, modernization, and reducing technical debt.",
  "instruction-fidelity":
    "Strictly following constraints, exact output shape, formatting, schema compliance, and precise requirements.",
  "repo-understanding":
    "Understanding a larger codebase across files and modules, tracing behavior, and navigating unfamiliar repository structure.",
  "tool-use":
    "Using tools, APIs, CLIs, MCP servers, automation steps, terminal-heavy workflows, and external integrations.",
  speed: "Latency-sensitive, quick answers, high throughput, and fast turnaround for simpler work.",
  "bulk-processing":
    "Large batches, many files, repetitive transforms, summarization, extraction, or processing at scale.",
  creative: "Writing, naming, brainstorming, content, messaging, copy, and creative direction.",
  security:
    "Authentication, authorization, vulnerabilities, secrets, attack surface, OWASP/CWE style concerns, and security review.",
  devops:
    "CI/CD, deploys, infrastructure, Docker, Kubernetes, cloud, environments, monitoring, and operational pipelines.",
  data: "SQL, databases, migrations, ETL, analytics, schemas, transformations, and data quality.",
  research:
    "External investigation, documentation lookup, option comparison, technical synthesis, and information gathering.",
};

/**
 * Only define folds for tags that do NOT exist 1:1 in the current repo schema.
 */
export const ROUTING_TAG_FOLDING: Partial<Record<CanonicalRoutingTag, string>> = {
  "tool-use": "agentic",
  "bulk-processing": "bulk",
};

export const STACK_SIGNALS = {
  frontend: [
    "react",
    "next.js",
    "nextjs",
    "vue",
    "nuxt",
    "angular",
    "svelte",
    "sveltekit",
    "html",
    "css",
    "tailwind",
  ],
  backend: [
    "node",
    "node.js",
    "express",
    "nestjs",
    "nest",
    "django",
    "fastapi",
    "flask",
    "spring",
    "spring boot",
    "asp.net",
    "asp.net core",
    "laravel",
    "gin",
    "go",
  ],
  languages: ["typescript", "javascript", "python", "java", "c#", "go", "rust", "php"],
  data: ["postgres", "postgresql", "mysql", "mongodb", "redis", "sql", "prisma", "drizzle"],
  infra: ["docker", "kubernetes", "aws", "gcp", "azure", "terraform", "github actions", "ci/cd"],
} as const;

export const PROBLEM_SIGNALS = {
  debugging: [
    "bug",
    "broken",
    "crash",
    "error",
    "failing",
    "flaky",
    "timeout",
    "regression",
    "not working",
  ],
  performance: ["slow", "performance", "memory", "latency", "optimize"],
  security: ["auth", "permissions", "token", "session", "oauth", "security", "vulnerability"],
  migration: ["migration", "upgrade", "dependency", "version conflict"],
  review: ["review", "pr", "pull request", "diff", "audit"],
  refactoring: ["refactor", "cleanup", "technical debt", "modernization"],
  uiux: ["landing page", "component", "form", "navbar", "responsive", "styling"],
} as const;

export const AGENT_ARCHETYPE_SIGNALS = [
  "coder",
  "reviewer",
  "architect",
  "researcher",
  "planner",
  "debugger",
  "frontend engineer",
  "backend engineer",
  "full-stack engineer",
  "devops engineer",
  "data engineer",
  "security reviewer",
] as const;

export const META_MODEL_SIGNALS = [
  "quality",
  "trusted",
  "premium",
  "budget",
  "long-context",
  "default-model",
] as const;
