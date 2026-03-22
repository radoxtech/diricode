import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
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

          <div className="mt-12 pt-8 border-t">
            <h2 className="text-lg font-semibold mb-4">Scaffolding Status</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>✓ Vite + React + TypeScript</li>
              <li>✓ Tailwind CSS + shadcn/ui</li>
              <li>✓ @xyflow/react (for node-based UI)</li>
              <li>✓ Zustand (state management)</li>
              <li>Ready for agent canvas implementation</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}
