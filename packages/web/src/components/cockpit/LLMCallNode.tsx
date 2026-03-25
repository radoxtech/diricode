import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Card, CardContent } from "@/components/ui/card";

export type LLMCallNodeData = {
  model: string;
  promptTokens: number;
  completionTokens: number;
  durationMs?: number;
};

export function LLMCallNode({ data }: NodeProps) {
  const llmData = data as LLMCallNodeData;

  return (
    <>
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-muted-foreground" />
      <Card className="w-56 shadow-sm border-dashed border-muted-foreground/30 bg-muted/20">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-4 h-4 rounded bg-blue-500/20 flex items-center justify-center">
              <span className="text-[8px]">✨</span>
            </div>
            <span className="text-xs font-semibold">{llmData.model}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground mt-2">
            <div className="flex flex-col bg-background/50 p-1.5 rounded">
              <span className="uppercase text-[8px] opacity-70">Prompt</span>
              <span className="font-mono">{llmData.promptTokens.toLocaleString()}</span>
            </div>
            <div className="flex flex-col bg-background/50 p-1.5 rounded">
              <span className="uppercase text-[8px] opacity-70">Completion</span>
              <span className="font-mono">{llmData.completionTokens.toLocaleString()}</span>
            </div>
          </div>

          {llmData.durationMs && (
            <div className="text-[9px] text-muted-foreground/70 mt-2 text-right">
              {(llmData.durationMs / 1000).toFixed(2)}s
            </div>
          )}
        </CardContent>
      </Card>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-muted-foreground" />
    </>
  );
}
