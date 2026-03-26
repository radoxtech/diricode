import { describe, expect, it } from "vitest";
import { DiriCodeConfigSchema } from "../schema.js";

describe("DiriCodeConfigSchema", () => {
  describe("empty config (all defaults)", () => {
    it("parses successfully with no fields provided", () => {
      const result = DiriCodeConfigSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("fills providers default to empty object", () => {
      const result = DiriCodeConfigSchema.parse({});
      expect(result.providers).toEqual({});
    });

    it("fills agents default to empty object", () => {
      const result = DiriCodeConfigSchema.parse({});
      expect(result.agents).toEqual({});
    });

    it("fills workMode with expected defaults", () => {
      const result = DiriCodeConfigSchema.parse({});
      expect(result.workMode).toEqual({
        autonomy: "guided",
        verbosity: "normal",
        riskTolerance: "safe",
        creativity: "balanced",
      });
    });

    it("fills memory with expected defaults", () => {
      const result = DiriCodeConfigSchema.parse({});
      expect(result.memory).toMatchObject({
        backend: "in-memory",
        maxMessages: 1_000,
        ttlSeconds: 0,
        enableVectorSearch: false,
      });
    });
  });

  describe("providers", () => {
    it("accepts a valid openai provider config", () => {
      const result = DiriCodeConfigSchema.safeParse({
        providers: {
          openai: { apiKey: "$OPENAI_API_KEY", defaultModel: "gpt-4o" },
        },
      });
      expect(result.success).toBe(true);
    });

    it("accepts multiple providers", () => {
      const result = DiriCodeConfigSchema.safeParse({
        providers: {
          openai: { apiKey: "key-a" },
          anthropic: { apiKey: "key-b" },
        },
      });
      expect(result.success).toBe(true);
    });

    it("rejects an unknown provider id", () => {
      const result = DiriCodeConfigSchema.safeParse({
        providers: { unknownProvider: {} },
      });
      expect(result.success).toBe(false);
    });

    it("rejects a non-url baseUrl", () => {
      const result = DiriCodeConfigSchema.safeParse({
        providers: { openai: { baseUrl: "not-a-url" } },
      });
      expect(result.success).toBe(false);
    });

    it("rejects maxRetries > 10", () => {
      const result = DiriCodeConfigSchema.safeParse({
        providers: { openai: { maxRetries: 11 } },
      });
      expect(result.success).toBe(false);
    });

    it("accepts a valid baseUrl", () => {
      const result = DiriCodeConfigSchema.safeParse({
        providers: {
          "azure-openai": { baseUrl: "https://my-resource.openai.azure.com" },
        },
      });
      expect(result.success).toBe(true);
    });

    it("rejects extra unknown keys on provider config", () => {
      const result = DiriCodeConfigSchema.safeParse({
        providers: { openai: { unknownField: "oops" } },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("agents", () => {
    it("accepts a minimal agent config", () => {
      const result = DiriCodeConfigSchema.safeParse({
        agents: { coder: {} },
      });
      expect(result.success).toBe(true);
    });

    it("accepts a full agent config with string tools", () => {
      const result = DiriCodeConfigSchema.safeParse({
        agents: {
          coder: {
            provider: "openai",
            model: "gpt-4o",
            systemPrompt: "You are a senior engineer.",
            tools: ["readFile", "writeFile"],
            maxTurns: 100,
            temperature: 0.7,
            topP: 0.95,
          },
        },
      });
      expect(result.success).toBe(true);
    });

    it("accepts tool references in object form", () => {
      const result = DiriCodeConfigSchema.safeParse({
        agents: {
          reviewer: {
            tools: [{ name: "readFile" }, { name: "exec", disabled: true }],
          },
        },
      });
      expect(result.success).toBe(true);
    });

    it("rejects temperature > 2", () => {
      const result = DiriCodeConfigSchema.safeParse({
        agents: { coder: { temperature: 3 } },
      });
      expect(result.success).toBe(false);
    });

    it("rejects temperature < 0", () => {
      const result = DiriCodeConfigSchema.safeParse({
        agents: { coder: { temperature: -0.1 } },
      });
      expect(result.success).toBe(false);
    });

    it("rejects topP > 1", () => {
      const result = DiriCodeConfigSchema.safeParse({
        agents: { coder: { topP: 1.5 } },
      });
      expect(result.success).toBe(false);
    });

    it("rejects maxTurns of 0", () => {
      const result = DiriCodeConfigSchema.safeParse({
        agents: { coder: { maxTurns: 0 } },
      });
      expect(result.success).toBe(false);
    });

    it("defaults agent tools to empty array", () => {
      const result = DiriCodeConfigSchema.parse({ agents: { coder: {} } });
      expect(result.agents.coder?.tools).toEqual([]);
    });

    it("defaults agent maxTurns to 50", () => {
      const result = DiriCodeConfigSchema.parse({ agents: { coder: {} } });
      expect(result.agents.coder?.maxTurns).toBe(50);
    });
  });

  describe("hooks", () => {
    it("accepts string hook handlers", () => {
      const result = DiriCodeConfigSchema.safeParse({
        hooks: { beforeTask: "echo starting", afterTask: "echo done" },
      });
      expect(result.success).toBe(true);
    });

    it("accepts array of hook handlers", () => {
      const result = DiriCodeConfigSchema.safeParse({
        hooks: {
          beforeTask: ["echo a", { command: "lint", failOnError: true }],
        },
      });
      expect(result.success).toBe(true);
    });

    it("accepts object hook handlers", () => {
      const result = DiriCodeConfigSchema.safeParse({
        hooks: {
          onTaskError: { command: "notify-slack", cwd: "/app", env: { CHANNEL: "#alerts" } },
        },
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty string hook command", () => {
      const result = DiriCodeConfigSchema.safeParse({
        hooks: { beforeTask: "" },
      });
      expect(result.success).toBe(false);
    });

    it("rejects unknown hook keys", () => {
      const result = DiriCodeConfigSchema.safeParse({
        hooks: { onUnknownEvent: "do-something" },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("memory", () => {
    it("accepts sqlite backend with connection string", () => {
      const result = DiriCodeConfigSchema.safeParse({
        memory: { backend: "sqlite", connectionString: "./data.db" },
      });
      expect(result.success).toBe(true);
    });

    it("accepts postgres backend", () => {
      const result = DiriCodeConfigSchema.safeParse({
        memory: {
          backend: "postgres",
          connectionString: "postgresql://user:pass@localhost/db",
        },
      });
      expect(result.success).toBe(true);
    });

    it("rejects unknown backend", () => {
      const result = DiriCodeConfigSchema.safeParse({
        memory: { backend: "dynamodb" },
      });
      expect(result.success).toBe(false);
    });

    it("rejects negative maxMessages", () => {
      const result = DiriCodeConfigSchema.safeParse({
        memory: { maxMessages: -1 },
      });
      expect(result.success).toBe(false);
    });

    it("rejects negative ttlSeconds", () => {
      const result = DiriCodeConfigSchema.safeParse({
        memory: { ttlSeconds: -5 },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("workMode", () => {
    it("accepts all valid autonomy values", () => {
      for (const autonomy of ["manual", "guided", "semi-auto", "full-auto"] as const) {
        const result = DiriCodeConfigSchema.safeParse({ workMode: { autonomy } });
        expect(result.success).toBe(true);
      }
    });

    it("accepts all valid verbosity values", () => {
      for (const verbosity of ["silent", "concise", "normal", "verbose"] as const) {
        const result = DiriCodeConfigSchema.safeParse({ workMode: { verbosity } });
        expect(result.success).toBe(true);
      }
    });

    it("accepts all valid riskTolerance values", () => {
      for (const riskTolerance of ["safe", "moderate", "aggressive"] as const) {
        const result = DiriCodeConfigSchema.safeParse({ workMode: { riskTolerance } });
        expect(result.success).toBe(true);
      }
    });

    it("accepts all valid creativity values", () => {
      for (const creativity of ["precise", "balanced", "exploratory"] as const) {
        const result = DiriCodeConfigSchema.safeParse({ workMode: { creativity } });
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid autonomy value", () => {
      const result = DiriCodeConfigSchema.safeParse({ workMode: { autonomy: "turbo" } });
      expect(result.success).toBe(false);
    });

    it("rejects invalid verbosity value", () => {
      const result = DiriCodeConfigSchema.safeParse({ workMode: { verbosity: "debug" } });
      expect(result.success).toBe(false);
    });
  });

  describe("project", () => {
    it("accepts a full project config", () => {
      const result = DiriCodeConfigSchema.safeParse({
        project: {
          name: "my-app",
          description: "A sample project",
          root: "/workspace/my-app",
          include: ["src/**"],
          exclude: ["node_modules/**", "dist/**"],
          contextFile: ".cursor/rules",
          metadata: { owner: "team-a" },
        },
      });
      expect(result.success).toBe(true);
    });

    it("defaults include and exclude to empty arrays", () => {
      const result = DiriCodeConfigSchema.parse({ project: {} });
      expect(result.project.include).toEqual([]);
      expect(result.project.exclude).toEqual([]);
    });

    it("rejects empty project name", () => {
      const result = DiriCodeConfigSchema.safeParse({ project: { name: "" } });
      expect(result.success).toBe(false);
    });

    it("rejects extra unknown keys on project config", () => {
      const result = DiriCodeConfigSchema.safeParse({ project: { unknownKey: true } });
      expect(result.success).toBe(false);
    });
  });

  describe("error messages", () => {
    it("reports which field is invalid when temperature out of range", () => {
      const result = DiriCodeConfigSchema.safeParse({
        agents: { coder: { temperature: 5 } },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i: { path: (string | number)[] }) =>
          i.path.join("."),
        );
        expect(paths.some((p: string) => p.includes("temperature"))).toBe(true);
      }
    });

    it("reports which field is invalid when provider id is unknown", () => {
      const result = DiriCodeConfigSchema.safeParse({
        providers: { unknownProvider: {} },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });
  });

  describe("copilot provider", () => {
    it("accepts copilot as a valid provider id", () => {
      const result = DiriCodeConfigSchema.safeParse({
        providers: { copilot: {} },
      });
      expect(result.success).toBe(true);
    });

    it("accepts copilot provider with defaultModel", () => {
      const result = DiriCodeConfigSchema.parse({
        providers: { copilot: { defaultModel: "gpt-5-mini" } },
      });
      expect(result.providers.copilot?.defaultModel).toBe("gpt-5-mini");
    });
  });
});
