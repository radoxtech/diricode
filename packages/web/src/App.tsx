import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CockpitCanvas } from "./components/cockpit/CockpitCanvas";
import { useAgentStore } from "./store/useAgentStore";

export default function App() {
  const [count, setCount] = useState(0);
  const handleEvent = useAgentStore((s) => s.handleEvent);

  useEffect(() => {
    const events = [
      {
        delay: 500,
        event: { type: "agent_started" as const, agentId: "dispatcher", name: "Dispatcher" },
      },
      {
        delay: 1000,
        event: { type: "agent_status" as const, agentId: "dispatcher", status: "running" as const },
      },
      {
        delay: 2000,
        event: {
          type: "agent_started" as const,
          agentId: "architect",
          parentId: "dispatcher",
          name: "Architect",
        },
      },
      {
        delay: 3000,
        event: { type: "agent_status" as const, agentId: "architect", status: "running" as const },
      },
      {
        delay: 5000,
        event: {
          type: "agent_status" as const,
          agentId: "architect",
          status: "completed" as const,
        },
      },
      {
        delay: 5500,
        event: {
          type: "agent_started" as const,
          agentId: "test-writer",
          parentId: "architect",
          name: "Test Writer",
        },
      },
      {
        delay: 6000,
        event: {
          type: "agent_status" as const,
          agentId: "test-writer",
          status: "running" as const,
        },
      },
      {
        delay: 8000,
        event: { type: "agent_status" as const, agentId: "test-writer", status: "failed" as const },
      },
      {
        delay: 8500,
        event: {
          type: "agent_status" as const,
          agentId: "dispatcher",
          status: "completed" as const,
        },
      },
    ];

    const timeouts = events.map(({ delay, event }) =>
      setTimeout(() => {
        handleEvent(event);
      }, delay),
    );

    return () => timeouts.forEach(clearTimeout);
  }, [handleEvent]);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <Card className="p-8">
          <h1 className="text-3xl font-bold mb-4">DiriCode - AI Cockpit</h1>
          <p className="text-muted-foreground mb-6">
            Autonomous AI coding framework. Agent orchestration, sprint-based execution, and
            continuous progress reports.
          </p>

          <div className="flex gap-4 items-center">
            <Button onClick={() => setCount(count + 1)}>Count is {count}</Button>
            <p className="text-sm text-muted-foreground">
              Click the button to test React interactivity
            </p>
          </div>
        </Card>

        <Card className="p-2 h-[800px]">
          <CockpitCanvas />
        </Card>
      </div>
    </div>
  );
}
