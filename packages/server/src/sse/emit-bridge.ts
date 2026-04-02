/**
 * Emit bridge — wires in-process event emission to the SSE event bus.
 *
 * Every `AgentContext.emit` passed into the dispatcher should pass through
 * this bridge so that tool lifecycle events (tool.start, tool.progress,
 * tool.end, tool.error) reach connected SSE clients in real time.
 *
 * Usage:
 * ```
 * const emit = createEventBusEmitBridge(context.emit);
 * const agentContext: AgentContext = { ...context, emit };
 * ```
 */

import { eventBus } from "./event-bus.js";

export type EmitFn = (event: string, payload: unknown) => void;

/**
 * Tool event names that should be forwarded to the SSE event bus.
 * These are the stable, typed tool lifecycle events defined in
 * `@diricode/core` (tool-error.ts).
 */
const TOOL_EVENT_NAMES = new Set([
  "tool.start",
  "tool.end",
  "tool.progress",
  "tool.error",
  "tool.error.retry",
  "tool.error.recovered",
  "tool.error.escalate",
  "tool.error.stop",
  "tool.access_denied",
]);

/**
 * Wrap an existing emit function so it also forwards tool lifecycle events
 * to the SSE event bus for real-time streaming to connected clients.
 *
 * @param emit  The emit function from the caller's AgentContext.
 * @returns     A new emit function that calls `emit` and forwards tool events
 *             to `eventBus`.
 */
export function createEventBusEmitBridge(emit: EmitFn): EmitFn {
  return (event: string, payload: unknown): void => {
    // Always call the original emit so all existing behaviour is preserved
    emit(event, payload);

    // Forward only tool lifecycle events to the SSE event bus
    if (TOOL_EVENT_NAMES.has(event)) {
      eventBus.emit(event, payload);
    }
  };
}
