import { EventType } from "./event-types.js";
import type { CoordinatedEvent } from "./event-types.js";

export type ExecutionNodeKind =
  | "turn"
  | "agent"
  | "tool"
  | "task"
  | "checkpoint"
  | "delegation"
  | "swarm"
  | "wave";

export type ExecutionNodeStatus = "running" | "completed" | "failed" | "timeout" | "aborted";

export interface ExecutionGraphNode {
  readonly spanId: string;
  readonly kind: ExecutionNodeKind;
  readonly label: string;
  readonly parentSpanId: string | null;
  readonly childSpanIds: string[];
  readonly startedAt: number;
  readonly endedAt: number | null;
  readonly status: ExecutionNodeStatus;
  readonly eventIds: string[];
  readonly metadata: Record<string, unknown>;
}

export interface ExecutionGraph {
  readonly nodes: ReadonlyMap<string, ExecutionGraphNode>;
  readonly roots: readonly string[];
  readonly events: readonly CoordinatedEvent[];
}

function makeNode(
  spanId: string,
  kind: ExecutionNodeKind,
  label: string,
  parentSpanId: string | null,
  startedAt: number,
  eventId: string,
  metadata: Record<string, unknown> = {},
): ExecutionGraphNode {
  return {
    spanId,
    kind,
    label,
    parentSpanId,
    childSpanIds: [],
    startedAt,
    endedAt: null,
    status: "running",
    eventIds: [eventId],
    metadata,
  };
}

function linkChild(
  nodes: Map<string, ExecutionGraphNode>,
  parentSpanId: string | null,
  childSpanId: string,
): void {
  if (parentSpanId === null) return;
  const parent = nodes.get(parentSpanId);
  if (parent && !parent.childSpanIds.includes(childSpanId)) {
    parent.childSpanIds.push(childSpanId);
  }
}

function updateNode(
  nodes: Map<string, ExecutionGraphNode>,
  spanId: string | undefined,
  status: ExecutionNodeStatus,
  endedAt: number,
  eventId: string,
): void {
  if (!spanId) return;
  const node = nodes.get(spanId);
  if (!node) return;
  node.eventIds.push(eventId);
  (node as { status: ExecutionNodeStatus }).status = status;
  (node as { endedAt: number | null }).endedAt = endedAt;
}

export class ExecutionGraphBuilder {
  private _nodes = new Map<string, ExecutionGraphNode>();
  private _roots: string[] = [];
  private _events: CoordinatedEvent[] = [];

  processEvent(event: CoordinatedEvent): void {
    this._events.push(event);
    const { correlation } = event;

    switch (event.type) {
      case EventType.TURN_START: {
        const spanId = correlation.turnId;
        if (!spanId) break;
        const node = makeNode(spanId, "turn", `turn:${spanId}`, null, event.timestamp, event.id, {
          inputPreview: event.inputPreview,
        });
        this._nodes.set(spanId, node);
        if (!this._roots.includes(spanId)) this._roots.push(spanId);
        break;
      }

      case EventType.TURN_END: {
        const status =
          event.status === "timeout"
            ? "timeout"
            : event.status === "failed"
              ? "failed"
              : event.status === "completed"
                ? "completed"
                : "running";
        updateNode(this._nodes, correlation.turnId, status, event.timestamp, event.id);
        break;
      }

      case EventType.TURN_TIMEOUT: {
        updateNode(this._nodes, correlation.turnId, "timeout", event.timestamp, event.id);
        break;
      }

      case EventType.AGENT_STARTED: {
        const spanId = correlation.agentSpanId;
        if (!spanId) break;
        const parentSpanId = correlation.parentSpanId ?? correlation.turnId ?? null;
        const node = makeNode(
          spanId,
          "agent",
          `agent:${event.agentName}`,
          parentSpanId,
          event.timestamp,
          event.id,
          { agentName: event.agentName, agentTier: event.agentTier },
        );
        this._nodes.set(spanId, node);
        linkChild(this._nodes, parentSpanId, spanId);
        break;
      }

      case EventType.AGENT_COMPLETED: {
        updateNode(
          this._nodes,
          correlation.agentSpanId,
          event.success ? "completed" : "failed",
          event.timestamp,
          event.id,
        );
        break;
      }

      case EventType.AGENT_FAILED: {
        updateNode(this._nodes, correlation.agentSpanId, "failed", event.timestamp, event.id);
        break;
      }

      case EventType.TOOL_START: {
        const spanId = correlation.toolCallId;
        if (!spanId) break;
        const parentSpanId = correlation.agentSpanId ?? null;
        const node = makeNode(
          spanId,
          "tool",
          `tool:${event.toolName}`,
          parentSpanId,
          event.timestamp,
          event.id,
          { toolName: event.toolName },
        );
        this._nodes.set(spanId, node);
        linkChild(this._nodes, parentSpanId, spanId);
        break;
      }

      case EventType.TOOL_END: {
        updateNode(this._nodes, correlation.toolCallId, "completed", event.timestamp, event.id);
        break;
      }

      case EventType.TOOL_ERROR: {
        updateNode(this._nodes, correlation.toolCallId, "failed", event.timestamp, event.id);
        break;
      }

      case EventType.TOOL_ERROR_STOP: {
        updateNode(this._nodes, correlation.toolCallId, "failed", event.timestamp, event.id);
        break;
      }

      case EventType.TASK_STARTED: {
        const spanId = correlation.taskId;
        if (!spanId) break;
        const parentSpanId = correlation.executionId ?? correlation.agentSpanId ?? null;
        const node = makeNode(
          spanId,
          "task",
          `task:${event.taskDescription.substring(0, 40)}`,
          parentSpanId,
          event.timestamp,
          event.id,
          { taskDescription: event.taskDescription },
        );
        this._nodes.set(spanId, node);
        linkChild(this._nodes, parentSpanId, spanId);
        break;
      }

      case EventType.TASK_COMPLETED: {
        updateNode(
          this._nodes,
          correlation.taskId,
          event.success ? "completed" : "failed",
          event.timestamp,
          event.id,
        );
        break;
      }

      case EventType.TASK_FAILED: {
        updateNode(this._nodes, correlation.taskId, "failed", event.timestamp, event.id);
        break;
      }

      case EventType.CHECKPOINT_SAVED: {
        const checkpointSpanId = `checkpoint_${event.id}`;
        const parentSpanId = correlation.taskId ?? correlation.executionId ?? null;
        const node = makeNode(
          checkpointSpanId,
          "checkpoint",
          `checkpoint:${String(event.checkpointIndex)}`,
          parentSpanId,
          event.timestamp,
          event.id,
          { checkpointIndex: event.checkpointIndex, status: event.status },
        );
        (node as { status: ExecutionNodeStatus }).status = "completed";
        (node as { endedAt: number | null }).endedAt = event.timestamp;
        this._nodes.set(checkpointSpanId, node);
        linkChild(this._nodes, parentSpanId, checkpointSpanId);
        break;
      }

      case EventType.DELEGATION_HANDOFF_CREATED: {
        const spanId = event.handoffId;
        const parentSpanId = correlation.agentSpanId ?? null;
        const node = makeNode(
          spanId,
          "delegation",
          `delegation:${event.childAgentName}`,
          parentSpanId,
          event.timestamp,
          event.id,
          { handoffId: event.handoffId, childAgentName: event.childAgentName },
        );
        this._nodes.set(spanId, node);
        linkChild(this._nodes, parentSpanId, spanId);
        break;
      }

      case EventType.DELEGATION_CHILD_STARTED: {
        const existing = this._nodes.get(event.handoffId);
        if (existing) {
          existing.eventIds.push(event.id);
        }
        break;
      }

      case EventType.DELEGATION_CHILD_COMPLETED: {
        updateNode(
          this._nodes,
          event.handoffId,
          event.success ? "completed" : "failed",
          event.timestamp,
          event.id,
        );
        break;
      }

      case EventType.DELEGATION_CHILD_FAILED: {
        updateNode(this._nodes, event.handoffId, "failed", event.timestamp, event.id);
        break;
      }

      case EventType.SEQUENTIAL_EXECUTION_STARTED: {
        const spanId = correlation.executionId;
        if (!spanId) break;
        const existing = this._nodes.get(spanId);
        if (existing) {
          existing.eventIds.push(event.id);
          break;
        }
        const parentSpanId = correlation.agentSpanId ?? correlation.turnId ?? null;
        const node = makeNode(
          spanId,
          "agent",
          `sequential:${spanId}`,
          parentSpanId,
          event.timestamp,
          event.id,
          { totalTasks: event.totalTasks },
        );
        this._nodes.set(spanId, node);
        linkChild(this._nodes, parentSpanId, spanId);
        break;
      }

      case EventType.SEQUENTIAL_EXECUTION_COMPLETED: {
        updateNode(
          this._nodes,
          correlation.executionId,
          event.aborted ? "aborted" : "completed",
          event.timestamp,
          event.id,
        );
        break;
      }

      case EventType.SEQUENTIAL_EXECUTION_ABORTED: {
        updateNode(this._nodes, correlation.executionId, "aborted", event.timestamp, event.id);
        break;
      }

      case EventType.SWARM_STARTED: {
        const spanId = correlation.executionId ?? correlation.agentSpanId;
        if (!spanId) break;
        const existing = this._nodes.get(spanId);
        if (existing) {
          existing.eventIds.push(event.id);
          break;
        }
        const parentSpanId = correlation.turnId ?? null;
        const node = makeNode(
          spanId,
          "swarm",
          `swarm:${event.agentName}`,
          parentSpanId,
          event.timestamp,
          event.id,
          { agentName: event.agentName, taskCount: event.taskCount },
        );
        this._nodes.set(spanId, node);
        linkChild(this._nodes, parentSpanId, spanId);
        break;
      }

      case EventType.SWARM_COMPLETED: {
        const spanId = correlation.executionId ?? correlation.agentSpanId;
        updateNode(
          this._nodes,
          spanId,
          event.success ? "completed" : "failed",
          event.timestamp,
          event.id,
        );
        break;
      }

      case EventType.SWARM_WAVE_START: {
        const spanId = `wave_${correlation.executionId ?? ""}_${String(event.waveIndex)}`;
        const parentSpanId = correlation.executionId ?? correlation.agentSpanId ?? null;
        const node = makeNode(
          spanId,
          "wave",
          `wave:${String(event.waveIndex)}`,
          parentSpanId,
          event.timestamp,
          event.id,
          { waveIndex: event.waveIndex, taskCount: event.taskCount },
        );
        this._nodes.set(spanId, node);
        linkChild(this._nodes, parentSpanId, spanId);
        break;
      }

      case EventType.SWARM_WAVE_END: {
        const spanId = `wave_${correlation.executionId ?? ""}_${String(event.waveIndex)}`;
        updateNode(this._nodes, spanId, "completed", event.timestamp, event.id);
        break;
      }

      default: {
        const existing = this._nodes.get(
          correlation.toolCallId ??
            correlation.taskId ??
            correlation.agentSpanId ??
            correlation.turnId ??
            "",
        );
        if (existing) {
          existing.eventIds.push(event.id);
        }
        break;
      }
    }
  }

  processEvents(events: readonly CoordinatedEvent[]): void {
    for (const event of events) {
      this.processEvent(event);
    }
  }

  build(): ExecutionGraph {
    return {
      nodes: new Map(this._nodes),
      roots: [...this._roots],
      events: [...this._events],
    };
  }

  reset(): void {
    this._nodes.clear();
    this._roots = [];
    this._events = [];
  }

  get size(): number {
    return this._nodes.size;
  }
}
