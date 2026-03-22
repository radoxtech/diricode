import { useEffect, useRef } from "react";
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";

import { AgentNode, type AgentNodeData } from "./AgentNode";
import { LLMCallNode } from "./LLMCallNode";
import { useAgentStore, type AgentStatus } from "../../store/useAgentStore";

const nodeTypes = {
  agent: AgentNode,
  llmCall: LLMCallNode,
};

const nodeWidth = 256;
const nodeHeight = 100;

function mapStatus(status: AgentStatus): AgentNodeData["status"] {
  switch (status) {
    case "pending":
      return "idle";
    case "running":
      return "running";
    case "completed":
      return "done";
    case "failed":
      return "error";
    default:
      return "idle";
  }
}

function getLayoutedElements(nodes: Node[], edges: Edge[], direction = "TB") {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === "LR";
  dagreGraph.setGraph({ rankdir: direction, nodesep: 50, edgesep: 50, ranksep: 100 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const newNode = { ...node };

    newNode.targetPosition = isHorizontal ? Position.Left : Position.Top;
    newNode.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

    newNode.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    return newNode;
  });

  return { nodes: layoutedNodes, edges };
}

export function CockpitCanvas() {
  const agents = useAgentStore((s) => s.agents);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const prevStructureHash = useRef("");

  useEffect(() => {
    const rawNodes: Node[] = [];
    const rawEdges: Edge[] = [];

    const agentList = Object.values(agents);
    agentList.forEach((agent) => {
      rawNodes.push({
        id: agent.id,
        type: "agent",
        position: { x: 0, y: 0 },
        data: {
          name: agent.name,
          tier: "MEDIUM",
          status: mapStatus(agent.status),
        } as AgentNodeData,
      });

      if (agent.parentId) {
        rawEdges.push({
          id: `e-${agent.parentId}-${agent.id}`,
          source: agent.parentId,
          target: agent.id,
          animated: agent.status === "running",
          style: agent.status === "running" ? { stroke: "#f59e0b", strokeWidth: 2 } : undefined,
        });
      }
    });

    if (rawNodes.length === 0) {
      setNodes([]);
      setEdges([]);
      prevStructureHash.current = "";
      return;
    }

    const structureHash = agentList.map((a) => `${a.id}:${a.parentId}`).join("|");

    if (structureHash !== prevStructureHash.current) {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        rawNodes,
        rawEdges,
      );
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      prevStructureHash.current = structureHash;
    } else {
      setNodes((nds) =>
        nds.map((n) => {
          const agent = agents[n.id];
          if (!agent) return n;
          return {
            ...n,
            data: {
              ...n.data,
              status: mapStatus(agent.status),
            },
          };
        }),
      );
      setEdges((eds) =>
        eds.map((e) => {
          const childAgent = agents[e.target];
          if (!childAgent) return e;
          const isRunning = childAgent.status === "running";
          return {
            ...e,
            animated: isRunning,
            style: isRunning ? { stroke: "#f59e0b", strokeWidth: 2 } : undefined,
          };
        }),
      );
    }
  }, [agents, setNodes, setEdges]);

  return (
    <div className="w-full h-full min-h-[600px] border rounded-lg bg-background overflow-hidden relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        className="bg-dot-pattern"
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
