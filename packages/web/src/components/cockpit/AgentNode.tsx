import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export type AgentNodeData = {
  name: string;
  tier: "HEAVY" | "MEDIUM" | "LOW";
  status?: "idle" | "running" | "done" | "error";
};

export function AgentNode({ data }: NodeProps) {
  const agentData = data as AgentNodeData;

  const tierColors = {
    HEAVY: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    MEDIUM: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    LOW: "bg-green-500/10 text-green-500 border-green-500/20",
  };

  const statusColors = {
    idle: "bg-slate-500",
    running: "bg-amber-500 animate-pulse",
    done: "bg-emerald-500",
    error: "bg-rose-500",
  };

  const status = agentData.status || "idle";

  return (
    <>
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-muted-foreground" />
      <Card className="w-64 shadow-md border-muted bg-card">
        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium">{agentData.name}</CardTitle>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${tierColors[agentData.tier]}`}
            >
              {agentData.tier}
            </span>
            <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-2 text-xs text-muted-foreground">Agent Node</CardContent>
      </Card>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-muted-foreground" />
    </>
  );
}
