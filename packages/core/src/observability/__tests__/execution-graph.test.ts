import { describe, it, expect, beforeEach } from "vitest";
import { ExecutionGraphBuilder } from "../execution-graph.js";
import type { ExecutionGraphNode } from "../execution-graph.js";
import { EventType } from "../event-types.js";
import {
  generateAgentSpanId,
  generateToolCallId,
  generateEventId,
  createCorrelationContext,
} from "../correlation.js";
import type {
  TurnStartEvent,
  TurnEndEvent,
  AgentStartedEvent,
  AgentCompletedEvent,
  ToolStartEvent,
  ToolEndEvent,
  DelegationHandoffCreatedEvent,
  DelegationChildStartedEvent,
  DelegationChildCompletedEvent,
  CheckpointSavedEvent,
  TaskStartedEvent,
  TaskCompletedEvent,
  SwarmStartedEvent,
  SwarmCompletedEvent,
  SwarmWaveStartEvent,
  SwarmWaveEndEvent,
  CoordinatedEvent,
} from "../event-types.js";

const SESSION = "session_001";
const TURN_ID = "turn_001";
const EXEC_ID = "exec_001";

function getNode(
  graph: ReturnType<ExecutionGraphBuilder["build"]>,
  spanId: string,
): ExecutionGraphNode {
  const node = graph.nodes.get(spanId);
  if (node === undefined) {
    throw new Error(`Node not found for spanId: ${spanId}`);
  }
  return node;
}

function makeTurnStart(turnId = TURN_ID): TurnStartEvent {
  return {
    id: generateEventId(),
    type: EventType.TURN_START,
    timestamp: 1000,
    correlation: createCorrelationContext({ sessionId: SESSION, turnId }),
    inputPreview: "test input",
  };
}

function makeTurnEnd(turnId = TURN_ID): TurnEndEvent {
  return {
    id: generateEventId(),
    type: EventType.TURN_END,
    timestamp: 5000,
    correlation: createCorrelationContext({ sessionId: SESSION, turnId }),
    status: "completed",
    durationMs: 4000,
    outputSummary: "done",
    telemetry: { totalTokens: 100, totalToolCalls: 1, totalCost: 0.01 },
  };
}

function makeAgentStarted(
  agentSpanId: string,
  parentSpanId: string | undefined,
  turnId = TURN_ID,
): AgentStartedEvent {
  return {
    id: generateEventId(),
    type: EventType.AGENT_STARTED,
    timestamp: 1100,
    correlation: createCorrelationContext({
      sessionId: SESSION,
      turnId,
      agentSpanId,
      parentSpanId,
    }),
    agentName: "test-agent",
    inputPreview: "input",
  };
}

function makeAgentCompleted(agentSpanId: string, turnId = TURN_ID): AgentCompletedEvent {
  return {
    id: generateEventId(),
    type: EventType.AGENT_COMPLETED,
    timestamp: 4900,
    correlation: createCorrelationContext({ sessionId: SESSION, turnId, agentSpanId }),
    agentName: "test-agent",
    success: true,
    toolCalls: 1,
    tokensUsed: 80,
  };
}

function makeToolStart(toolCallId: string, agentSpanId: string, turnId = TURN_ID): ToolStartEvent {
  return {
    id: generateEventId(),
    type: EventType.TOOL_START,
    timestamp: 2000,
    correlation: createCorrelationContext({
      sessionId: SESSION,
      turnId,
      agentSpanId,
      toolCallId,
    }),
    toolName: "bash-exec",
    params: { cmd: "ls" },
  };
}

function makeToolEnd(toolCallId: string, agentSpanId: string, turnId = TURN_ID): ToolEndEvent {
  return {
    id: generateEventId(),
    type: EventType.TOOL_END,
    timestamp: 3000,
    correlation: createCorrelationContext({
      sessionId: SESSION,
      turnId,
      agentSpanId,
      toolCallId,
    }),
    toolName: "bash-exec",
    durationMs: 1000,
  };
}

describe("ExecutionGraphBuilder", () => {
  let builder: ExecutionGraphBuilder;

  beforeEach(() => {
    builder = new ExecutionGraphBuilder();
  });

  describe("basic turn → agent → tool sequence", () => {
    it("creates root turn node on TURN_START", () => {
      builder.processEvent(makeTurnStart());
      const graph = builder.build();

      expect(graph.roots).toContain(TURN_ID);
      expect(graph.nodes.has(TURN_ID)).toBe(true);

      const node = getNode(graph, TURN_ID);
      expect(node.kind).toBe("turn");
      expect(node.parentSpanId).toBeNull();
      expect(node.status).toBe("running");
    });

    it("updates turn node status on TURN_END", () => {
      builder.processEvent(makeTurnStart());
      builder.processEvent(makeTurnEnd());
      const graph = builder.build();

      const node = getNode(graph, TURN_ID);
      expect(node.status).toBe("completed");
      expect(node.endedAt).toBe(5000);
    });

    it("creates agent node linked to turn", () => {
      const agentSpanId = generateAgentSpanId();
      builder.processEvent(makeTurnStart());
      builder.processEvent(makeAgentStarted(agentSpanId, TURN_ID));
      const graph = builder.build();

      const agentNode = getNode(graph, agentSpanId);
      expect(agentNode.kind).toBe("agent");
      expect(agentNode.parentSpanId).toBe(TURN_ID);

      const turnNode = getNode(graph, TURN_ID);
      expect(turnNode.childSpanIds).toContain(agentSpanId);
    });

    it("creates tool node linked to agent", () => {
      const agentSpanId = generateAgentSpanId();
      const toolCallId = generateToolCallId();

      builder.processEvent(makeTurnStart());
      builder.processEvent(makeAgentStarted(agentSpanId, TURN_ID));
      builder.processEvent(makeToolStart(toolCallId, agentSpanId));
      const graph = builder.build();

      const toolNode = getNode(graph, toolCallId);
      expect(toolNode.kind).toBe("tool");
      expect(toolNode.parentSpanId).toBe(agentSpanId);

      const agentNode = getNode(graph, agentSpanId);
      expect(agentNode.childSpanIds).toContain(toolCallId);
    });

    it("marks tool as completed on TOOL_END", () => {
      const agentSpanId = generateAgentSpanId();
      const toolCallId = generateToolCallId();

      builder.processEvent(makeTurnStart());
      builder.processEvent(makeAgentStarted(agentSpanId, TURN_ID));
      builder.processEvent(makeToolStart(toolCallId, agentSpanId));
      builder.processEvent(makeToolEnd(toolCallId, agentSpanId));
      const graph = builder.build();

      const toolNode = getNode(graph, toolCallId);
      expect(toolNode.status).toBe("completed");
      expect(toolNode.endedAt).toBe(3000);
    });

    it("full sequence builds correct graph shape", () => {
      const agentSpanId = generateAgentSpanId();
      const toolCallId = generateToolCallId();

      builder.processEvents([
        makeTurnStart(),
        makeAgentStarted(agentSpanId, TURN_ID),
        makeToolStart(toolCallId, agentSpanId),
        makeToolEnd(toolCallId, agentSpanId),
        makeAgentCompleted(agentSpanId),
        makeTurnEnd(),
      ]);

      const graph = builder.build();

      expect(graph.roots).toHaveLength(1);
      expect(graph.roots[0]).toBe(TURN_ID);
      expect(graph.nodes.size).toBe(3);

      const turnNode = getNode(graph, TURN_ID);
      expect(turnNode.status).toBe("completed");
      expect(turnNode.childSpanIds).toContain(agentSpanId);

      const agentNode = getNode(graph, agentSpanId);
      expect(agentNode.status).toBe("completed");
      expect(agentNode.childSpanIds).toContain(toolCallId);

      const toolNode = getNode(graph, toolCallId);
      expect(toolNode.status).toBe("completed");
      expect(toolNode.childSpanIds).toHaveLength(0);
    });
  });

  describe("delegation / parent-child agent structure", () => {
    it("creates delegation node linked to parent agent", () => {
      const parentAgentSpanId = generateAgentSpanId();
      const handoffId = "handoff_001";

      builder.processEvent(makeTurnStart());
      builder.processEvent(makeAgentStarted(parentAgentSpanId, TURN_ID));

      const handoffEvent: DelegationHandoffCreatedEvent = {
        id: generateEventId(),
        type: EventType.DELEGATION_HANDOFF_CREATED,
        timestamp: 2000,
        correlation: createCorrelationContext({
          sessionId: SESSION,
          turnId: TURN_ID,
          agentSpanId: parentAgentSpanId,
        }),
        handoffId,
        childExecutionId: "exec_child",
        childAgentName: "child-agent",
      };

      builder.processEvent(handoffEvent);
      const graph = builder.build();

      const delegationNode = getNode(graph, handoffId);
      expect(delegationNode.kind).toBe("delegation");
      expect(delegationNode.parentSpanId).toBe(parentAgentSpanId);

      const parentNode = getNode(graph, parentAgentSpanId);
      expect(parentNode.childSpanIds).toContain(handoffId);
    });

    it("marks delegation completed on DELEGATION_CHILD_COMPLETED", () => {
      const parentAgentSpanId = generateAgentSpanId();
      const handoffId = "handoff_002";

      builder.processEvent(makeTurnStart());
      builder.processEvent(makeAgentStarted(parentAgentSpanId, TURN_ID));

      const handoffCreated: DelegationHandoffCreatedEvent = {
        id: generateEventId(),
        type: EventType.DELEGATION_HANDOFF_CREATED,
        timestamp: 2000,
        correlation: createCorrelationContext({
          sessionId: SESSION,
          turnId: TURN_ID,
          agentSpanId: parentAgentSpanId,
        }),
        handoffId,
        childExecutionId: "exec_child_2",
        childAgentName: "child-agent",
      };

      const childStarted: DelegationChildStartedEvent = {
        id: generateEventId(),
        type: EventType.DELEGATION_CHILD_STARTED,
        timestamp: 2100,
        correlation: createCorrelationContext({ sessionId: SESSION }),
        handoffId,
        childExecutionId: "exec_child_2",
        childAgentName: "child-agent",
      };

      const childCompleted: DelegationChildCompletedEvent = {
        id: generateEventId(),
        type: EventType.DELEGATION_CHILD_COMPLETED,
        timestamp: 4000,
        correlation: createCorrelationContext({ sessionId: SESSION }),
        handoffId,
        childExecutionId: "exec_child_2",
        childAgentName: "child-agent",
        success: true,
        durationMs: 1900,
      };

      builder.processEvents([handoffCreated, childStarted, childCompleted]);
      const graph = builder.build();

      const delegationNode = getNode(graph, handoffId);
      expect(delegationNode.status).toBe("completed");
      expect(delegationNode.endedAt).toBe(4000);
    });
  });

  describe("checkpoint nodes", () => {
    it("creates checkpoint node linked to task", () => {
      const taskId = "task_001";

      const taskStarted: TaskStartedEvent = {
        id: generateEventId(),
        type: EventType.TASK_STARTED,
        timestamp: 1000,
        correlation: createCorrelationContext({
          sessionId: SESSION,
          turnId: TURN_ID,
          executionId: EXEC_ID,
          taskId,
        }),
        taskDescription: "do something",
      };

      const checkpointSaved: CheckpointSavedEvent = {
        id: "evt_chk_001",
        type: EventType.CHECKPOINT_SAVED,
        timestamp: 2000,
        correlation: createCorrelationContext({
          sessionId: SESSION,
          turnId: TURN_ID,
          executionId: EXEC_ID,
          taskId,
        }),
        checkpointIndex: 0,
        status: "valid",
      };

      builder.processEvents([taskStarted, checkpointSaved]);
      const graph = builder.build();

      const checkpointSpanId = "checkpoint_evt_chk_001";
      const checkpointNode = getNode(graph, checkpointSpanId);
      expect(checkpointNode.kind).toBe("checkpoint");
      expect(checkpointNode.parentSpanId).toBe(taskId);
      expect(checkpointNode.status).toBe("completed");

      const taskNode = getNode(graph, taskId);
      expect(taskNode.childSpanIds).toContain(checkpointSpanId);
    });
  });

  describe("swarm wave structure", () => {
    it("creates swarm node with wave children", () => {
      const swarmExecId = "swarm_exec_001";

      const swarmStarted: SwarmStartedEvent = {
        id: generateEventId(),
        type: EventType.SWARM_STARTED,
        timestamp: 1000,
        correlation: createCorrelationContext({
          sessionId: SESSION,
          turnId: TURN_ID,
          executionId: swarmExecId,
        }),
        agentName: "swarm-agent",
        taskCount: 4,
        sequential: false,
      };

      const waveStart: SwarmWaveStartEvent = {
        id: generateEventId(),
        type: EventType.SWARM_WAVE_START,
        timestamp: 1100,
        correlation: createCorrelationContext({
          sessionId: SESSION,
          turnId: TURN_ID,
          executionId: swarmExecId,
        }),
        waveIndex: 0,
        taskCount: 2,
      };

      const waveEnd: SwarmWaveEndEvent = {
        id: generateEventId(),
        type: EventType.SWARM_WAVE_END,
        timestamp: 3000,
        correlation: createCorrelationContext({
          sessionId: SESSION,
          turnId: TURN_ID,
          executionId: swarmExecId,
        }),
        waveIndex: 0,
        completedCount: 2,
        failedCount: 0,
        durationMs: 1900,
      };

      const swarmCompleted: SwarmCompletedEvent = {
        id: generateEventId(),
        type: EventType.SWARM_COMPLETED,
        timestamp: 5000,
        correlation: createCorrelationContext({
          sessionId: SESSION,
          turnId: TURN_ID,
          executionId: swarmExecId,
        }),
        agentName: "swarm-agent",
        success: true,
        durationMs: 4000,
        completedTasks: 4,
        failedTasks: 0,
      };

      builder.processEvents([swarmStarted, waveStart, waveEnd, swarmCompleted]);
      const graph = builder.build();

      const swarmNode = getNode(graph, swarmExecId);
      expect(swarmNode.kind).toBe("swarm");
      expect(swarmNode.status).toBe("completed");

      const waveSpanId = `wave_${swarmExecId}_0`;
      const waveNode = getNode(graph, waveSpanId);
      expect(waveNode.kind).toBe("wave");
      expect(waveNode.parentSpanId).toBe(swarmExecId);
      expect(waveNode.status).toBe("completed");

      expect(swarmNode.childSpanIds).toContain(waveSpanId);
    });
  });

  describe("root detection", () => {
    it("only adds turns as roots, not agents or tools", () => {
      const agentSpanId = generateAgentSpanId();
      const toolCallId = generateToolCallId();

      builder.processEvents([
        makeTurnStart(),
        makeAgentStarted(agentSpanId, TURN_ID),
        makeToolStart(toolCallId, agentSpanId),
      ]);

      const graph = builder.build();
      expect(graph.roots).toHaveLength(1);
      expect(graph.roots[0]).toBe(TURN_ID);
    });

    it("supports multiple turns as multiple roots", () => {
      const turn1 = "turn_aaa";
      const turn2 = "turn_bbb";

      builder.processEvent(makeTurnStart(turn1));
      builder.processEvent(makeTurnStart(turn2));

      const graph = builder.build();
      expect(graph.roots).toHaveLength(2);
      expect(graph.roots).toContain(turn1);
      expect(graph.roots).toContain(turn2);
    });
  });

  describe("edge cases", () => {
    it("ignores TURN_START without turnId in correlation", () => {
      const event: TurnStartEvent = {
        id: generateEventId(),
        type: EventType.TURN_START,
        timestamp: 1000,
        correlation: createCorrelationContext({ sessionId: SESSION }),
        inputPreview: "no turnId",
      };

      builder.processEvent(event);
      const graph = builder.build();

      expect(graph.nodes.size).toBe(0);
      expect(graph.roots).toHaveLength(0);
    });

    it("ignores AGENT_STARTED without agentSpanId", () => {
      builder.processEvent(makeTurnStart());

      const event: AgentStartedEvent = {
        id: generateEventId(),
        type: EventType.AGENT_STARTED,
        timestamp: 1100,
        correlation: createCorrelationContext({ sessionId: SESSION, turnId: TURN_ID }),
        agentName: "orphan-agent",
        inputPreview: "input",
      };

      builder.processEvent(event);
      const graph = builder.build();

      expect(graph.nodes.size).toBe(1);
    });

    it("ignores TOOL_START without toolCallId", () => {
      const agentSpanId = generateAgentSpanId();
      builder.processEvent(makeTurnStart());
      builder.processEvent(makeAgentStarted(agentSpanId, TURN_ID));

      const event: ToolStartEvent = {
        id: generateEventId(),
        type: EventType.TOOL_START,
        timestamp: 2000,
        correlation: createCorrelationContext({
          sessionId: SESSION,
          turnId: TURN_ID,
          agentSpanId,
        }),
        toolName: "bash-exec",
        params: {},
      };

      builder.processEvent(event);
      const graph = builder.build();

      expect(graph.nodes.size).toBe(2);
    });

    it("handles duplicate TURN_START without creating duplicate roots", () => {
      builder.processEvent(makeTurnStart());
      builder.processEvent(makeTurnStart());

      const graph = builder.build();
      expect(graph.roots).toHaveLength(1);
    });

    it("handles end events for unknown spans gracefully", () => {
      builder.processEvent(makeTurnStart());

      const agentCompleted: AgentCompletedEvent = {
        id: generateEventId(),
        type: EventType.AGENT_COMPLETED,
        timestamp: 5000,
        correlation: createCorrelationContext({
          sessionId: SESSION,
          turnId: TURN_ID,
          agentSpanId: "nonexistent_span",
        }),
        agentName: "ghost-agent",
        success: true,
        toolCalls: 0,
        tokensUsed: 0,
      };

      expect(() => {
        builder.processEvent(agentCompleted);
      }).not.toThrow();
      const graph = builder.build();
      expect(graph.nodes.has("nonexistent_span")).toBe(false);
    });

    it("records all events in graph.events", () => {
      const agentSpanId = generateAgentSpanId();
      const toolCallId = generateToolCallId();
      const events: CoordinatedEvent[] = [
        makeTurnStart(),
        makeAgentStarted(agentSpanId, TURN_ID),
        makeToolStart(toolCallId, agentSpanId),
        makeToolEnd(toolCallId, agentSpanId),
        makeAgentCompleted(agentSpanId),
        makeTurnEnd(),
      ];

      builder.processEvents(events);
      const graph = builder.build();

      expect(graph.events).toHaveLength(events.length);
    });

    it("reset clears all state", () => {
      const agentSpanId = generateAgentSpanId();
      builder.processEvent(makeTurnStart());
      builder.processEvent(makeAgentStarted(agentSpanId, TURN_ID));

      expect(builder.size).toBe(2);
      builder.reset();
      expect(builder.size).toBe(0);

      const graph = builder.build();
      expect(graph.nodes.size).toBe(0);
      expect(graph.roots).toHaveLength(0);
      expect(graph.events).toHaveLength(0);
    });
  });

  describe("event-ID linkage", () => {
    it("records eventId on each node it touches", () => {
      const agentSpanId = generateAgentSpanId();
      const startEvt = makeAgentStarted(agentSpanId, TURN_ID);
      const endEvt = makeAgentCompleted(agentSpanId);

      builder.processEvent(makeTurnStart());
      builder.processEvent(startEvt);
      builder.processEvent(endEvt);

      const graph = builder.build();
      const node = getNode(graph, agentSpanId);

      expect(node.eventIds).toContain(startEvt.id);
      expect(node.eventIds).toContain(endEvt.id);
    });
  });

  describe("task lifecycle", () => {
    it("creates task node and marks it complete", () => {
      const taskId = "task_lifecycle_001";

      const taskStarted: TaskStartedEvent = {
        id: generateEventId(),
        type: EventType.TASK_STARTED,
        timestamp: 1000,
        correlation: createCorrelationContext({
          sessionId: SESSION,
          turnId: TURN_ID,
          executionId: EXEC_ID,
          taskId,
        }),
        taskDescription: "implement feature X",
      };

      const taskCompleted: TaskCompletedEvent = {
        id: generateEventId(),
        type: EventType.TASK_COMPLETED,
        timestamp: 3000,
        correlation: createCorrelationContext({
          sessionId: SESSION,
          turnId: TURN_ID,
          executionId: EXEC_ID,
          taskId,
        }),
        success: true,
        durationMs: 2000,
      };

      builder.processEvents([taskStarted, taskCompleted]);
      const graph = builder.build();

      const node = getNode(graph, taskId);
      expect(node.kind).toBe("task");
      expect(node.status).toBe("completed");
      expect(node.endedAt).toBe(3000);
      expect(node.parentSpanId).toBe(EXEC_ID);
    });
  });
});
