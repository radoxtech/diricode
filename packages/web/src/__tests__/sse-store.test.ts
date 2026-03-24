import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAgentStore } from "../store/useAgentStore";
import { SSEClient } from "../lib/sse";

describe("SSEClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();

    global.EventSource = vi.fn().mockImplementation(function() { return {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      close: vi.fn(),
    }; });
    
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.restoreAllMocks();
  });

  it("should connect and handle reconnection on error", () => {
    const client = new SSEClient({ url: "http://test.com", baseDelay: 1000, maxAttempts: 3 });
    client.connect();

    expect(global.EventSource).toHaveBeenCalledWith("http://test.com");


    const esInstance = (global.EventSource as any).mock.results[0].value;
    esInstance.onerror();


    vi.advanceTimersByTime(1000);
    expect(global.EventSource).toHaveBeenCalledTimes(2);


    const esInstance2 = (global.EventSource as any).mock.results[1].value;
    esInstance2.onerror();


    vi.advanceTimersByTime(2000);
    expect(global.EventSource).toHaveBeenCalledTimes(3);
  });

  it("should not reconnect if disconnect is called", () => {
    const client = new SSEClient({ url: "http://test.com", baseDelay: 1000, maxAttempts: 3 });
    client.connect();

    const esInstance = (global.EventSource as any).mock.results[0].value;
    client.disconnect();
    esInstance.onerror();

    vi.advanceTimersByTime(1000);
    expect(global.EventSource).toHaveBeenCalledTimes(1);
  });
});

describe("useAgentStore", () => {
  beforeEach(() => {
    useAgentStore.setState({
      agents: {},
      rootAgents: [],
      sseClient: null,
    });
  });

  it("should handle agent_started event and set up hierarchy", () => {
    const store = useAgentStore.getState();


    store.handleEvent({
      type: "agent_started",
      agentId: "root-1",
      name: "Root Agent",
    });

    let state = useAgentStore.getState();
    expect(state.rootAgents).toContain("root-1");
    expect(state.agents["root-1"]).toEqual({
      id: "root-1",
      parentId: undefined,
      name: "Root Agent",
      status: "running",
      children: [],
      logs: [],
    });


    store.handleEvent({
      type: "agent_started",
      agentId: "child-1",
      parentId: "root-1",
      name: "Child Agent",
    });

    state = useAgentStore.getState();
    expect(state.rootAgents).not.toContain("child-1");
    expect(state.agents["child-1"]).toEqual({
      id: "child-1",
      parentId: "root-1",
      name: "Child Agent",
      status: "running",
      children: [],
      logs: [],
    });
    expect(state.agents["root-1"].children).toContain("child-1");
  });

  it("should handle agent_status event", () => {
    const store = useAgentStore.getState();

    store.handleEvent({
      type: "agent_started",
      agentId: "agent-1",
      name: "Agent 1",
    });

    store.handleEvent({
      type: "agent_status",
      agentId: "agent-1",
      status: "completed",
    });

    const state = useAgentStore.getState();
    expect(state.agents["agent-1"].status).toBe("completed");
  });

  it("should handle agent_log event", () => {
    const store = useAgentStore.getState();

    store.handleEvent({
      type: "agent_started",
      agentId: "agent-1",
      name: "Agent 1",
    });

    store.handleEvent({
      type: "agent_log",
      agentId: "agent-1",
      message: "Hello World",
    });

    const state = useAgentStore.getState();
    expect(state.agents["agent-1"].logs).toContain("Hello World");
  });
});
