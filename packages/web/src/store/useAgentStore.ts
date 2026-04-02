import { create } from "zustand";
import { SSEClient } from "../lib/sse";

export type AgentStatus = "pending" | "running" | "completed" | "failed";

export interface AgentNode {
  id: string;
  parentId?: string;
  name: string;
  status: AgentStatus;
  children: string[];
  logs: string[];
}

export interface ToolCallRecord {
  toolName: string;
  turnId?: string;
  sessionId?: string;
  agentName?: string;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  progress: string[];
  status: "running" | "completed";
}

export type AgentEvent =
  | { type: "agent_started"; agentId: string; parentId?: string; name: string }
  | { type: "agent_status"; agentId: string; status: AgentStatus }
  | { type: "agent_log"; agentId: string; message: string };

export type ToolEvent =
  | {
      type: "tool_start";
      toolName: string;
      turnId?: string;
      sessionId?: string;
      agentName?: string;
      timestamp: number;
    }
  | {
      type: "tool_end";
      toolName: string;
      turnId?: string;
      sessionId?: string;
      agentName?: string;
      timestamp: number;
      durationMs: number;
    }
  | {
      type: "tool_progress";
      toolName: string;
      turnId?: string;
      sessionId?: string;
      agentName?: string;
      timestamp: number;
      chunk: string;
      stream: "stdout" | "stderr";
    };

type IncomingEvent = AgentEvent | ToolEvent;

interface AgentStoreState {
  agents: Record<string, AgentNode>;
  rootAgents: string[];
  toolCalls: Record<string, ToolCallRecord>;
  sseClient: SSEClient | null;
  connect: (url: string) => void;
  disconnect: () => void;
  handleEvent: (event: IncomingEvent) => void;
}

function toolCallKey(toolName: string, turnId?: string): string {
  return turnId ? `${turnId}:${toolName}` : toolName;
}

export const useAgentStore = create<AgentStoreState>((set, get) => ({
  agents: {},
  rootAgents: [],
  toolCalls: {},
  sseClient: null,

  connect: (url: string) => {
    if (get().sseClient) {
      get().sseClient?.disconnect();
    }

    const client = new SSEClient({ url });

    const handleRaw = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as IncomingEvent;
        get().handleEvent(data);
      } catch (err) {
        console.error("[useAgentStore] Failed to parse SSE message", err);
      }
    };

    client.on("message", handleRaw);
    client.on("tool_start", handleRaw);
    client.on("tool_end", handleRaw);
    client.on("tool_progress", handleRaw);

    client.connect();
    set({ sseClient: client });
  },

  disconnect: () => {
    get().sseClient?.disconnect();
    set({ sseClient: null });
  },

  handleEvent: (event: IncomingEvent) => {
    set((state) => {
      if (event.type === "tool_start") {
        const key = toolCallKey(event.toolName, event.turnId);
        return {
          toolCalls: {
            ...state.toolCalls,
            [key]: {
              toolName: event.toolName,
              turnId: event.turnId,
              sessionId: event.sessionId,
              agentName: event.agentName,
              startedAt: event.timestamp,
              progress: [],
              status: "running" as const,
            },
          },
        };
      }

      if (event.type === "tool_end") {
        const key = toolCallKey(event.toolName, event.turnId);
        const existing = state.toolCalls[key];
        if (!existing) return {};
        return {
          toolCalls: {
            ...state.toolCalls,
            [key]: {
              ...existing,
              endedAt: event.timestamp,
              durationMs: event.durationMs,
              status: "completed" as const,
            },
          },
        };
      }

      if (event.type === "tool_progress") {
        const key = toolCallKey(event.toolName, event.turnId);
        const existing = state.toolCalls[key];
        if (!existing) return {};
        return {
          toolCalls: {
            ...state.toolCalls,
            [key]: {
              ...existing,
              progress: [...existing.progress, event.chunk],
            },
          },
        };
      }

      const agents = { ...state.agents };
      let rootAgents = [...state.rootAgents];

      switch (event.type) {
        case "agent_started": {
          if (!agents[event.agentId]) {
            agents[event.agentId] = {
              id: event.agentId,
              parentId: event.parentId,
              name: event.name,
              status: "running",
              children: [],
              logs: [],
            };

            if (event.parentId) {
              const parent = agents[event.parentId];
              if (parent) {
                if (!parent.children.includes(event.agentId)) {
                  agents[event.parentId] = {
                    ...parent,
                    children: [...parent.children, event.agentId],
                  };
                }
              } else {
                agents[event.parentId] = {
                  id: event.parentId,
                  name: "Unknown Parent",
                  status: "pending",
                  children: [event.agentId],
                  logs: [],
                };
              }
            } else {
              if (!rootAgents.includes(event.agentId)) {
                rootAgents.push(event.agentId);
              }
            }
          }
          break;
        }

        case "agent_status": {
          const target = agents[event.agentId];
          if (target) {
            agents[event.agentId] = {
              ...target,
              status: event.status,
            };
          }
          break;
        }

        case "agent_log": {
          const target = agents[event.agentId];
          if (target) {
            agents[event.agentId] = {
              ...target,
              logs: [...target.logs, event.message],
            };
          }
          break;
        }
      }

      return { agents, rootAgents };
    });
  },
}));
