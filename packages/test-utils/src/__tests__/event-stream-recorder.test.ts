import { describe, it, expect, beforeEach } from "vitest";
import { EventStreamRecorder } from "../event-stream-recorder.js";

describe("EventStreamRecorder", () => {
  let recorder: EventStreamRecorder;

  beforeEach(() => {
    recorder = new EventStreamRecorder();
  });

  it("records and retrieves events", () => {
    recorder.recordConnected("conn-1", null);
    recorder.recordHeartbeat();
    const events = recorder.getEvents();
    expect(events).toHaveLength(2);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(events[0]!.event).toBe("connected");
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(events[1]!.event).toBe("heartbeat");
  });

  it("getEvents returns a copy", () => {
    recorder.recordConnected("conn-1");
    const events1 = recorder.getEvents();
    const events2 = recorder.getEvents();
    expect(events1).not.toBe(events2);
    expect(events1).toEqual(events2);
  });

  it("getEventsByType filters correctly", () => {
    recorder.recordConnected("conn-1");
    recorder.recordHeartbeat();
    recorder.recordHeartbeat();
    recorder.recordError("ERR_CODE", "error message");
    const heartbeats = recorder.getEventsByType("heartbeat");
    expect(heartbeats).toHaveLength(2);
    const errors = recorder.getEventsByType("error");
    expect(errors).toHaveLength(1);
  });

  it("recordConnected sets connectionId and lastEventId", () => {
    recorder.recordConnected("conn-123", "event-456");
    expect(recorder.getConnectionId()).toBe("conn-123");
    expect(recorder.getLastEventId()).toBe("event-456");
  });

  it("getLastEventId returns null initially", () => {
    expect(recorder.getLastEventId()).toBeNull();
  });

  it("clear resets all state", () => {
    recorder.recordConnected("conn-1");
    recorder.recordHeartbeat();
    recorder.clear();
    expect(recorder.getEvents()).toHaveLength(0);
    expect(recorder.getConnectionId()).toBeNull();
    expect(recorder.getLastEventId()).toBeNull();
  });

  it("replay returns same as getEvents", () => {
    recorder.recordHeartbeat();
    recorder.recordHeartbeat();
    expect(recorder.replay()).toEqual(recorder.getEvents());
  });

  it("toSseString formats SSE correctly", () => {
    recorder.recordConnected("conn-1", null);
    const sse = recorder.toSseString();
    expect(sse).toContain("id:");
    expect(sse).toContain("event: connected");
    expect(sse).toContain("data:");
  });

  it("recordError captures code and message", () => {
    recorder.recordError("INVALID_INPUT", "Field x is required");
    const errors = recorder.getEventsByType("error");
    expect(errors).toHaveLength(1);
    const data = (errors[0] as unknown as { data: { code: string; message: string } }).data;
    expect(data.code).toBe("INVALID_INPUT");
    expect(data.message).toBe("Field x is required");
  });

  it("recordToolStart and recordToolEnd capture tool events", () => {
    recorder.recordToolStart("writeFile", { path: "/tmp/test.txt", content: "hello" });
    recorder.recordToolEnd("writeFile", { bytesWritten: 11 });
    const starts = recorder.getEventsByType("tool_start");
    const ends = recorder.getEventsByType("tool_end");
    expect(starts).toHaveLength(1);
    expect(ends).toHaveLength(1);
    const startData = (
      starts[0] as unknown as { data: { toolName: string; params: { path: string } } }
    ).data;
    expect(startData.toolName).toBe("writeFile");
    expect(startData.params.path).toBe("/tmp/test.txt");
    const endData = (
      ends[0] as unknown as { data: { toolName: string; result: { bytesWritten: number } } }
    ).data;
    expect(endData.toolName).toBe("writeFile");
    expect(endData.result.bytesWritten).toBe(11);
  });

  it("recordMessage captures content and role", () => {
    recorder.recordMessage("Hello, world!", "assistant");
    const messages = recorder.getEventsByType("message");
    expect(messages).toHaveLength(1);
    const data = (messages[0] as unknown as { data: { content: string; role: string } }).data;
    expect(data.content).toBe("Hello, world!");
    expect(data.role).toBe("assistant");
  });
});
