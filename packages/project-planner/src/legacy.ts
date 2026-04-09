import type { Issue } from "./index.js";
import type { Node, TaskNode } from "./types/index.js";

export {
  RelationSemanticTypeSchema,
  SemanticRelationSchema,
  IssueStatusSchema,
  IssueSchema,
} from "./index.js";

export type { RelationSemanticType, SemanticRelation, IssueStatus, Issue } from "./index.js";

function getLegacyDomain(namespaceId: string): string {
  if (namespaceId === "docs" || namespaceId === "plan") {
    return namespaceId;
  }

  if (namespaceId.startsWith("reference:")) {
    return namespaceId.slice("reference:".length) || "reference";
  }

  return "unknown";
}

/**
 * @deprecated Lossy adapter — use Node types directly in new code.
 */
export function taskNodeToIssue(node: Node): Issue {
  return {
    id: node.id,
    externalId: undefined,
    domain: getLegacyDomain(node.namespace_id),
    subModule: "legacy",
    sequenceId: 0,
    key: node.id,
    title: node.title,
    status: node.status,
    businessContext: {
      description: node.description,
      epic: undefined,
    },
    executionContext: {
      complexity: 5,
      impact: "local",
    },
    relations: [],
  } satisfies Issue;
}

/**
 * @deprecated Lossy adapter — use Node types directly in new code.
 */
export function issueToTaskNode(issue: Issue): Node {
  const timestamp = new Date().toISOString();

  return {
    id: issue.id,
    namespace_id: "plan",
    type: "task",
    title: issue.title,
    description: issue.businessContext.description,
    status: issue.status,
    labels: [],
    metadata: {},
    parentId: undefined,
    created_at: timestamp,
    updated_at: timestamp,
  } satisfies TaskNode;
}
