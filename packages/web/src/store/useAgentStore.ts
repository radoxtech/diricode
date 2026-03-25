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

export type AgentEvent =
  | { type: "agent_started"; agentId: string; parentId?: string; name: string }
  | { type: "agent_status"; agentId: string; status: AgentStatus }
  | { type: "agent_log"; agentId: string; message: string };

interface AgentStoreState {
  agents: Record<string, AgentNode>;
  rootAgents: string[];
  sseClient: SSEClient | null;
  connect: (url: string) => void;
  disconnect: () => void;
  handleEvent: (event: AgentEvent) => void;
}

export const useAgentStore = create<AgentStoreState>((set, get) => ({
  agents: {},
  rootAgents: [],
  sseClient: null,

  connect: (url: string) => {
    if (get().sseClient) {
      get().sseClient?.disconnect();
    }

    const client = new SSEClient({ url });

    client.on("message", (e) => {
      try {
        const data = JSON.parse(e.data) as AgentEvent;
        get().handleEvent(data);
      } catch (err) {
        console.error("[useAgentStore] Failed to parse SSE message", err);
      }
    });

    client.connect();
    set({ sseClient: client });
  },

  disconnect: () => {
    get().sseClient?.disconnect();
    set({ sseClient: null });
  },

  handleEvent: (event: AgentEvent) => {
    set((state) => {
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
