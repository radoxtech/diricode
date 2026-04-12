import type { Edge } from "../types/edge.js";
import type { FeatureNode, Node, NodeStatus, NodeType, SprintNode } from "../types/node.js";
import type { Namespace } from "../types/namespace.js";
import { initDatabase, type DatabaseInstance } from "./database.js";
import { EdgeStorage } from "./edges.js";
import { NamespaceStorage } from "./namespaces.js";
import { SearchEngine } from "./search.js";
import { NodeStorage } from "./storage.js";

const TERMINAL_STATUSES: ReadonlySet<NodeStatus> = new Set(["DONE", "CANCELED"]);
const CURRENT_SPRINT_STATUSES: ReadonlyMap<NodeStatus, number> = new Map([
  ["IN_PROGRESS", 0],
  ["IN_REVIEW", 1],
  ["TODO", 2],
  ["BACKLOG", 3],
  ["DONE", 4],
  ["CANCELED", 5],
]);
const FEATURE_MAP_EDGE_TYPES = new Set([
  "depends_on",
  "blocks",
  "precedes",
  "contains",
  "related_to",
]);

export type Sprint = SprintNode;
export type Blocker = Node;

export interface DiriContextOptions {
  dbPath: string;
}

export interface ProgressSummary {
  done: number;
  total: number;
  percent: number;
}

export interface ProjectStatus {
  totalNodes: number;
  namespaces: Namespace[];
  countsByType: Partial<Record<NodeType, number>>;
  countsByStatus: Partial<Record<NodeStatus, number>>;
  progress: ProgressSummary;
  activeSprint: Sprint | null;
  blockers: Blocker[];
  isEmpty: boolean;
  _nextAction?: string;
}

export interface FeatureMapEntry {
  feature: FeatureNode;
  children: Node[];
  dependencyEdges: Edge[];
  dependencyNodes: Node[];
}

export interface FeatureMap {
  namespaceId: "docs";
  totalFeatures: number;
  features: FeatureMapEntry[];
  isEmpty: boolean;
  _nextAction?: string;
}

export interface NextWorkItem {
  strategy: string;
  limit: number;
  reason: string;
  _nextAction?: string;
}

export interface ExecutionWave {
  order: number;
  title: string;
  items: Node[];
  _nextAction?: string;
}

export interface BlockerAnalysis {
  nodeId?: string;
  blockers: Blocker[];
  summary: string;
  _nextAction?: string;
}

function isFeatureNode(node: Node): node is FeatureNode {
  return node.type === "feature";
}

function isSprintNode(node: Node): node is Sprint {
  return node.type === "sprint";
}

function isTerminalStatus(status: NodeStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

function compareByUpdatedAtDescending(left: Node, right: Node): number {
  return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
}

function compareSprints(left: Sprint, right: Sprint): number {
  const leftPriority = CURRENT_SPRINT_STATUSES.get(left.status) ?? Number.MAX_SAFE_INTEGER;
  const rightPriority = CURRENT_SPRINT_STATUSES.get(right.status) ?? Number.MAX_SAFE_INTEGER;

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  return compareByUpdatedAtDescending(left, right);
}

function uniqueNodes(nodes: Node[]): Node[] {
  const seen = new Set<string>();

  return nodes.filter((node) => {
    if (seen.has(node.id)) {
      return false;
    }

    seen.add(node.id);
    return true;
  });
}

export class DiriContext {
  readonly nodes: NodeStorage;

  readonly edges: EdgeStorage;

  readonly namespaces: NamespaceStorage;

  readonly search: SearchEngine;

  private readonly db: DatabaseInstance;

  private closed = false;

  constructor(options: DiriContextOptions) {
    this.db = initDatabase(options.dbPath);
    this.nodes = new NodeStorage(this.db);
    this.edges = new EdgeStorage(this.db);
    this.namespaces = new NamespaceStorage(this.db);
    this.search = new SearchEngine(this.db);
  }

  getStatus(): ProjectStatus {
    const namespaces = this.namespaces.listNamespaces();
    const allNodes = this.nodes.listNodes();
    const countsByType: Partial<Record<NodeType, number>> = {};
    const countsByStatus: Partial<Record<NodeStatus, number>> = {};

    for (const node of allNodes) {
      countsByType[node.type] = (countsByType[node.type] ?? 0) + 1;
      countsByStatus[node.status] = (countsByStatus[node.status] ?? 0) + 1;
    }

    const progressNodes = allNodes.filter((node) => node.status !== "CANCELED");
    const doneNodes = progressNodes.filter((node) => node.status === "DONE");
    const activeSprint = this.getCurrentSprint();
    const blockers = this.getBlockers();

    if (allNodes.length === 0) {
      return {
        totalNodes: 0,
        namespaces,
        countsByType,
        countsByStatus,
        progress: { done: 0, total: 0, percent: 0 },
        activeSprint,
        blockers,
        isEmpty: true,
        _nextAction: "Add docs or plan nodes to start building project context in Diricontext.",
      };
    }

    return {
      totalNodes: allNodes.length,
      namespaces,
      countsByType,
      countsByStatus,
      progress: {
        done: doneNodes.length,
        total: progressNodes.length,
        percent:
          progressNodes.length === 0
            ? 0
            : Math.round((doneNodes.length / progressNodes.length) * 100),
      },
      activeSprint,
      blockers,
      isEmpty: false,
    };
  }

  getFeatureMap(): FeatureMap {
    const docsNodes = this.nodes.listNodes({ namespaceId: "docs" });
    const features = docsNodes
      .filter(isFeatureNode)
      .sort((left, right) => left.title.localeCompare(right.title));

    if (features.length === 0) {
      return {
        namespaceId: "docs",
        totalFeatures: 0,
        features: [],
        isEmpty: true,
        _nextAction: "Create docs feature nodes to build the Diricontext feature map.",
      };
    }

    return {
      namespaceId: "docs",
      totalFeatures: features.length,
      isEmpty: false,
      features: features.map((feature) => {
        const children = docsNodes
          .filter((node) => node.parentId === feature.id)
          .sort((left, right) => left.title.localeCompare(right.title));
        const dependencyEdges = this.edges
          .getEdgesFrom(feature.id)
          .filter((edge) => FEATURE_MAP_EDGE_TYPES.has(edge.type));
        const dependencyNodes = this.nodes
          .getNodesByIds(dependencyEdges.map((edge) => edge.target_id))
          .filter((node) => node.namespace_id === "docs");

        return {
          feature,
          children,
          dependencyEdges,
          dependencyNodes,
        } satisfies FeatureMapEntry;
      }),
    };
  }

  getCurrentSprint(): Sprint | null {
    const sprintNodes = this.nodes
      .listNodes({ namespaceId: "plan", type: "sprint" })
      .filter(isSprintNode);
    const activeSprints = sprintNodes.filter((node) => !isTerminalStatus(node.status));

    if (activeSprints.length === 0) {
      return null;
    }

    return activeSprints.sort(compareSprints)[0] ?? null;
  }

  getBlockers(): Blocker[] {
    const planNodes = this.nodes
      .listNodes({ namespaceId: "plan" })
      .filter((node) => !isTerminalStatus(node.status));

    if (planNodes.length === 0) {
      return [];
    }

    const unresolvedIds = new Set(planNodes.map((node) => node.id));
    const blockers: Node[] = [];

    for (const node of planNodes) {
      const dependencyTargets = this.edges
        .getEdgesFrom(node.id)
        .filter((edge) => edge.type === "depends_on")
        .map((edge) => edge.target_id)
        .filter((targetId) => unresolvedIds.has(targetId));

      const incomingBlockers = this.edges
        .getEdgesTo(node.id)
        .filter((edge) => edge.type === "blocks" || edge.type === "precedes")
        .map((edge) => edge.source_id)
        .filter((sourceId) => unresolvedIds.has(sourceId));

      blockers.push(
        ...this.nodes
          .getNodesByIds([...dependencyTargets, ...incomingBlockers])
          .filter((candidate) => unresolvedIds.has(candidate.id)),
      );
    }

    return uniqueNodes(blockers).sort((left, right) => left.title.localeCompare(right.title));
  }

  getNextWork(strategy: string = "priority", limit: number = 5): NextWorkItem[] {
    const safeLimit = Math.max(1, limit);

    return [
      {
        strategy,
        limit: safeLimit,
        reason: `getNextWork(${strategy}) is a stub in Task #587. Full implementation lands in Task #595.`,
        _nextAction:
          "Use getBlockers(), getCurrentSprint(), and getStatus() until the work recommender is implemented.",
      },
    ];
  }

  getExecutionPlan(epicId?: string): ExecutionWave[] {
    return [
      {
        order: 1,
        title: epicId
          ? `Execution plan for ${epicId} is not implemented yet`
          : "Execution plan is not implemented yet",
        items: [],
        _nextAction: "Full execution planning lands in Task #597.",
      },
    ];
  }

  analyzeBlockers(nodeId?: string): BlockerAnalysis {
    const blockers = nodeId ? this.getNodeBlockers(nodeId) : this.getBlockers();

    if (blockers.length === 0) {
      return {
        nodeId,
        blockers: [],
        summary: nodeId
          ? `No unresolved blockers found for node ${nodeId}.`
          : "No unresolved blockers found in the plan namespace.",
        _nextAction: "Detailed blocker analysis lands in Task #596.",
      };
    }

    return {
      nodeId,
      blockers,
      summary: `Found ${blockers.length} unresolved blocker${blockers.length === 1 ? "" : "s"}.`,
      _nextAction: "Detailed blocker analysis lands in Task #596.",
    };
  }

  summarize(namespaceId: string, depth: number = 1): string {
    const nodes = this.nodes.listNodes({ namespaceId });

    if (nodes.length === 0) {
      return `Namespace '${namespaceId}' is empty. Add nodes before requesting a summary.`;
    }

    const limitedDepth = Math.max(1, depth);
    return (
      `Summary generation for namespace '${namespaceId}' (depth=${limitedDepth}) is a stub in Task #587. ` +
      `Current snapshot: ${nodes.length} node(s), ${this.namespaces.listNamespaces().length} namespace(s).`
    );
  }

  close(): void {
    if (this.closed) {
      return;
    }

    this.db.close();
    this.closed = true;
  }

  private getNodeBlockers(nodeId: string): Blocker[] {
    const blockerIds = new Set<string>();

    for (const edge of this.edges.getEdgesFrom(nodeId)) {
      if (edge.type === "depends_on") {
        blockerIds.add(edge.target_id);
      }
    }

    for (const edge of this.edges.getEdgesTo(nodeId)) {
      if (edge.type === "blocks" || edge.type === "precedes") {
        blockerIds.add(edge.source_id);
      }
    }

    return this.nodes
      .getNodesByIds([...blockerIds])
      .filter((node) => !isTerminalStatus(node.status))
      .sort(compareByUpdatedAtDescending);
  }
}
