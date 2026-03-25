import { describe, it, expect, beforeEach } from "vitest";
import { createProviderStub } from "../provider-stub.js";

describe("provider-stub", () => {
  let stub: ReturnType<typeof createProviderStub>;

  beforeEach(() => {
    stub = createProviderStub({ name: "test-stub", available: true });
  });

  it("has default name and model", () => {
    expect(stub.name).toBe("test-stub");
    expect(stub.defaultModel.modelId).toBe("stub-model");
  });

  it("isAvailable returns initial value", () => {
    expect(stub.isAvailable()).toBe(true);
    const unavailableStub = createProviderStub({ available: false });
    expect(unavailableStub.isAvailable()).toBe(false);
  });

  it("setAvailable changes availability", () => {
    stub.setAvailable(false);
    expect(stub.isAvailable()).toBe(false);
    stub.setAvailable(true);
    expect(stub.isAvailable()).toBe(true);
  });

  describe("generate", () => {
    it("returns stub response by default", async () => {
      const result = await stub.generate({ prompt: "hello" });
      expect(result).toBe("stub response");
    });

    it("returns configured response via setNextResponse", async () => {
      stub.setNextResponse("custom response");
      const result = await stub.generate({ prompt: "hello" });
      expect(result).toBe("custom response");
    });

    it("setNextResponse is one-shot", async () => {
      stub.setNextResponse("first");
      expect(await stub.generate({ prompt: "a" })).toBe("first");
      expect(await stub.generate({ prompt: "b" })).toBe("stub response");
    });

    it("throws configured error via setNextError", async () => {
      const err = new Error("provider error");
      stub.setNextError(err);
      await expect(stub.generate({ prompt: "hello" })).rejects.toThrow("provider error");
    });

    it("records call history", async () => {
      await stub.generate({ prompt: "first" });
      await stub.generate({ prompt: "second" });
      const history = stub.getCallHistory();
      expect(history).toHaveLength(2);
      expect((history[0] as { prompt: string }).prompt).toBe("first");
      expect((history[1] as { prompt: string }).prompt).toBe("second");
    });

    it("records model override in history", async () => {
      await stub.generate({ prompt: "test", model: { modelId: "gpt-4o" } });
      const history = stub.getCallHistory();
      expect((history[0] as { model?: { modelId: string } }).model?.modelId).toBe("gpt-4o");
    });
  });

  describe("stream", () => {
    it("yields stub chunk by default", async () => {
      const chunks: string[] = [];
      for await (const chunk of stub.stream({ prompt: "hello" })) {
        chunks.push(chunk.delta);
      }
      expect(chunks).toEqual(["stub chunk"]);
    });

    it("setNextStreamChunks yields each chunk", async () => {
      stub.setNextStreamChunks([
        { delta: "hello ", done: false },
        { delta: "world", done: false },
        { delta: "!", done: true },
      ]);
      const chunks: string[] = [];
      for await (const chunk of stub.stream({ prompt: "hi" })) {
        chunks.push(chunk.delta);
      }
      expect(chunks).toEqual(["hello ", "world", "!"]);
    });

    it("setNextStreamChunks is one-shot", async () => {
      stub.setNextStreamChunks([{ delta: "first", done: true }]);
      const chunks1: string[] = [];
      for await (const c of stub.stream({ prompt: "a" })) chunks1.push(c.delta);
      const chunks2: string[] = [];
      for await (const c of stub.stream({ prompt: "b" })) chunks2.push(c.delta);
      expect(chunks1).toEqual(["first"]);
      expect(chunks2).toEqual(["stub chunk"]);
    });

    it("setNextResponse works for streaming", async () => {
      stub.setNextResponse("streamed response");
      const chunks: string[] = [];
      for await (const c of stub.stream({ prompt: "hi" })) chunks.push(c.delta);
      expect(chunks).toEqual(["streamed response"]);
    });

    it("setNextError throws during streaming", async () => {
      stub.setNextError(new Error("stream error"));
      await expect(
        (async () => {
          for await (const _ of stub.stream({ prompt: "hi" })) {
            // consume stream until error
          }
        })(),
      ).rejects.toThrow("stream error");
    });
  });

  describe("reset", () => {
    it("clears state and history", async () => {
      stub.setNextResponse("custom");
      await stub.generate({ prompt: "test" });
      expect(stub.getCallHistory()).toHaveLength(1);
      stub.reset();
      expect(stub.getCallHistory()).toHaveLength(0);
      expect(stub.isAvailable()).toBe(true);
    });
  });
});
