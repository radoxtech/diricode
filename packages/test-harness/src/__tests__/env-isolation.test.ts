import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { EnvIsolation } from "../env-isolation.js";

describe("EnvIsolation", () => {
  let env: EnvIsolation;

  beforeEach(() => {
    env = new EnvIsolation();
    env.save();
  });

  afterEach(() => {
    try {
      env.restore();
    } catch {
      /* ignore */
    }
  });

  it("should save and restore environment variables", () => {
    const originalValue = process.env.TEST_VAR;
    process.env.TEST_VAR = "test-value";

    env.restore();
    expect(process.env.TEST_VAR).toBe(originalValue);
  });

  it("should remove added variables on restore", () => {
    process.env.NEW_VAR = "new-value";
    expect(process.env.NEW_VAR).toBe("new-value");

    env.restore();
    expect(process.env.NEW_VAR).toBeUndefined();
  });

  it("should restore deleted variables", () => {
    process.env.TO_DELETE = "will-be-deleted";
    env.save();

    delete process.env.TO_DELETE;
    expect(process.env.TO_DELETE).toBeUndefined();

    env.restore();
    expect(process.env.TO_DELETE).toBe("will-be-deleted");
  });

  it("should not throw when restoring without save", () => {
    const freshEnv = new EnvIsolation();
    expect(() => { freshEnv.restore(); }).not.toThrow();
  });

  it("should set variables via set method", () => {
    env.set("SET_VAR", "set-value");
    expect(process.env.SET_VAR).toBe("set-value");

    env.restore();
    expect(process.env.SET_VAR).toBeUndefined();
  });

  it("should delete variables via delete method", () => {
    process.env.TO_DELETE_VIA_METHOD = "value";
    env.save();

    env.delete("TO_DELETE_VIA_METHOD");
    expect(process.env.TO_DELETE_VIA_METHOD).toBeUndefined();

    env.restore();
    expect(process.env.TO_DELETE_VIA_METHOD).toBe("value");
  });
});
