import { CopilotClient, approveAll } from "@github/copilot-sdk";
import type { CopilotSession, ModelInfo, SessionEvent } from "@github/copilot-sdk";
import { classifyError } from "../error-classifier.js";
import type { GenerateOptions, ModelConfig, Provider, StreamChunk } from "../types.js";
import type { ModelCard } from "../contracts/model-card.js";

const EMPTY_BENCHMARKS: ModelCard["benchmarks"] = {
  quality: { by_complexity_role: {}, by_specialization: {} },
  speed: { tokens_per_second_avg: 0, feedback_count: 0 },
};

/** Static cards for known Copilot-proxied models. listModels() provides the dynamic list;
 *  these feed the picker's metadata (family, capabilities, pricing tier). */
const COPILOT_MODEL_CARDS: ModelCard[] = [
  {
    model: "gpt-4.1",
    family: "gpt-reasoning",
    capabilities: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      vision: true,
      max_context: 200_000,
    },
    reasoning_levels: ["low", "medium", "high"],
    known_for: {
      roles: ["architect", "reviewer", "orchestrator", "coder"],
      complexities: ["moderate", "complex"],
      specializations: [],
    },
    benchmarks: EMPTY_BENCHMARKS,
    pricing_tier: "standard",
    learned_from: 0,
  },
  {
    model: "gpt-4.1-mini",
    family: "gpt-mini",
    capabilities: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      vision: true,
      max_context: 200_000,
    },
    reasoning_levels: ["low", "medium"],
    known_for: {
      roles: ["coder", "researcher"],
      complexities: ["simple", "moderate"],
      specializations: [],
    },
    benchmarks: EMPTY_BENCHMARKS,
    pricing_tier: "budget",
    learned_from: 0,
  },
  {
    model: "gpt-4.1-nano",
    family: "gpt-nano",
    capabilities: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      vision: false,
      max_context: 200_000,
    },
    reasoning_levels: [],
    known_for: {
      roles: ["coder"],
      complexities: ["simple"],
      specializations: [],
    },
    benchmarks: EMPTY_BENCHMARKS,
    pricing_tier: "budget",
    learned_from: 0,
  },
  {
    model: "claude-sonnet-4",
    family: "claude-sonnet",
    capabilities: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      vision: true,
      max_context: 200_000,
    },
    reasoning_levels: ["low", "medium", "high"],
    known_for: {
      roles: ["architect", "reviewer", "orchestrator", "coder"],
      complexities: ["moderate", "complex"],
      specializations: [],
    },
    benchmarks: EMPTY_BENCHMARKS,
    pricing_tier: "standard",
    learned_from: 0,
  },
  {
    model: "claude-opus-4",
    family: "claude-opus",
    capabilities: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      vision: true,
      max_context: 200_000,
    },
    reasoning_levels: ["low", "medium", "high", "xhigh"],
    known_for: {
      roles: ["architect", "reviewer", "orchestrator"],
      complexities: ["complex", "expert"],
      specializations: [],
    },
    benchmarks: EMPTY_BENCHMARKS,
    pricing_tier: "premium",
    learned_from: 0,
  },
  {
    model: "gemini-2.5-pro",
    family: "gemini-pro",
    capabilities: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      vision: true,
      max_context: 200_000,
    },
    reasoning_levels: ["low", "medium", "high"],
    known_for: {
      roles: ["architect", "researcher", "coder"],
      complexities: ["moderate", "complex"],
      specializations: [],
    },
    benchmarks: EMPTY_BENCHMARKS,
    pricing_tier: "standard",
    learned_from: 0,
  },
  {
    model: "o4-mini",
    family: "gpt-reasoning",
    capabilities: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      vision: true,
      max_context: 200_000,
    },
    reasoning_levels: ["low", "medium", "high", "xhigh"],
    known_for: {
      roles: ["architect", "reviewer", "coder"],
      complexities: ["moderate", "complex", "expert"],
      specializations: [],
    },
    benchmarks: EMPTY_BENCHMARKS,
    pricing_tier: "standard",
    learned_from: 0,
  },
];
import { getGithubToken, storeGithubToken, clearGithubToken } from "./auth.js";
import {
  initiateGithubDeviceFlow,
  pollGithubDeviceToken,
  GithubOAuthError,
} from "./github-oauth.js";

// Diricode's GitHub OAuth App client ID
export const COPILOT_CLIENT_ID = process.env.DC_COPILOT_CLIENT_ID ?? "Ov23li7a7FBdI2WkK0dd";

export interface CopilotLoginResult {
  success: boolean;
  token?: string;
  error?: string;
}

export interface CopilotModelInfo {
  id: string;
  name: string;
  capabilities?: ModelInfo["capabilities"];
}

export class CopilotProvider implements Provider {
  readonly name = "copilot";
  readonly defaultModel: ModelConfig;
  #token: string | undefined;
  #client: CopilotClient | undefined;
  #started = false;

  constructor(token?: string) {
    this.#token = token ?? getGithubToken();
    this.defaultModel = {
      modelId: "gpt-4.1",
    };
  }

  isAvailable(): boolean {
    return this.#token !== undefined && this.#token.length > 0;
  }

  isLoggedIn(): boolean {
    return this.#token !== undefined && this.#token.length > 0;
  }

  async login(
    onUserCode?: (uri: string, code: string) => void,
    signal?: AbortSignal,
  ): Promise<CopilotLoginResult> {
    try {
      const deviceResponse = await initiateGithubDeviceFlow(COPILOT_CLIENT_ID);

      if (onUserCode) {
        onUserCode(deviceResponse.verification_uri, deviceResponse.user_code);
      } else {
        process.stdout.write(`\n🔐 GitHub Copilot login:\n`);
        process.stdout.write(`   Open: ${deviceResponse.verification_uri}\n`);
        process.stdout.write(`   Enter code: ${deviceResponse.user_code}\n\n`);
      }

      const oauthToken = await pollGithubDeviceToken(
        COPILOT_CLIENT_ID,
        deviceResponse.device_code,
        deviceResponse.interval,
        signal,
      );

      this.#token = oauthToken.access_token;
      this.#client = undefined;
      this.#started = false;
      storeGithubToken(oauthToken.access_token);

      return { success: true, token: oauthToken.access_token };
    } catch (err) {
      if (err instanceof GithubOAuthError) {
        return { success: false, error: err.message };
      }
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  logout(): void {
    this.#token = undefined;
    this.#client = undefined;
    this.#started = false;
    clearGithubToken();
  }

  getModelCards(): ModelCard[] {
    return COPILOT_MODEL_CARDS;
  }

  async listModels(): Promise<CopilotModelInfo[]> {
    const client = await this.ensureClient();
    const models = await client.listModels();
    return models.map((m) => ({
      id: m.id,
      name: m.name,
      capabilities: m.capabilities,
    }));
  }

  async generate(options: GenerateOptions): Promise<string> {
    const modelId = this.resolveModel(options.model);
    let session: CopilotSession | undefined;
    try {
      const client = await this.ensureClient(modelId);

      session = await client.createSession({
        model: modelId,
        streaming: false,
        onPermissionRequest: approveAll,
      });

      const result = await session.sendAndWait({ prompt: options.prompt });
      const content = result?.data.content ?? "";
      if (!content) {
        throw new Error("Copilot API returned empty response");
      }
      return content;
    } catch (error) {
      throw classifyError(error, {
        provider: this.name,
        model: modelId,
      });
    } finally {
      await session?.disconnect();
    }
  }

  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const modelId = this.resolveModel(options.model);
    let session: CopilotSession | undefined;
    try {
      const client = await this.ensureClient(modelId);

      session = await client.createSession({
        model: modelId,
        streaming: true,
        onPermissionRequest: approveAll,
      });

      const chunks: StreamChunk[] = [];
      let done = false;
      let resolveChunk: (() => void) | undefined;
      let sessionError: unknown;

      session.on("assistant.message_delta", (event) => {
        chunks.push({ delta: event.data.deltaContent, done: false });
        resolveChunk?.();
      });

      session.on("session.idle", () => {
        done = true;
        resolveChunk?.();
      });

      session.on("session.error", (event) => {
        sessionError = this.extractSessionError(event);
        done = true;
        resolveChunk?.();
      });

      // send() fires the request; we consume response via event handlers above
      const sendPromise = session.send({ prompt: options.prompt });

      // Process chunks: first consume pending chunks from event handlers,
      // then wait for more or exit when done
      const hasMoreChunksOrNotDone = (): boolean => chunks.length > 0 || !done;
      while (hasMoreChunksOrNotDone()) {
        // Wait for chunks if none available and not done yet
        const shouldWait = (): boolean => chunks.length === 0 && !done;
        while (shouldWait()) {
          await new Promise<void>((resolve) => {
            resolveChunk = resolve;
          });
        }

        // Drain all available chunks
        while (chunks.length > 0) {
          const chunk = chunks.shift();
          if (!chunk) throw new Error("Invariant violation: chunk should not be undefined");
          yield chunk;
        }
      }

      if (sessionError !== undefined) {
        let errorToThrow: Error;
        if (sessionError instanceof Error) {
          errorToThrow = sessionError;
        } else if (typeof sessionError === "string") {
          errorToThrow = new Error(sessionError);
        } else if (typeof sessionError === "object" && sessionError !== null) {
          try {
            errorToThrow = new Error(JSON.stringify(sessionError));
          } catch {
            errorToThrow = new Error("Unknown session error");
          }
        } else {
          errorToThrow = new Error(typeof sessionError);
        }
        throw errorToThrow;
      }

      yield { delta: "", done: true };

      await sendPromise;
    } catch (error) {
      throw classifyError(error, {
        provider: this.name,
        model: modelId,
      });
    } finally {
      await session?.disconnect();
    }
  }

  async stop(): Promise<void> {
    if (this.#client && this.#started) {
      await this.#client.stop();
      this.#client = undefined;
      this.#started = false;
    }
  }

  private resolveModel(model?: ModelConfig): string {
    return model?.modelId ?? this.defaultModel.modelId;
  }

  private async ensureClient(modelId?: string): Promise<CopilotClient> {
    if (!this.#token) {
      throw classifyError(
        new Error("No GitHub token available. Call login() or provide token in constructor."),
        {
          provider: this.name,
          model: modelId,
        },
      );
    }

    if (!this.#client) {
      this.#client = new CopilotClient({
        githubToken: this.#token,
        useLoggedInUser: false,
        logLevel: "error",
      });
    }

    if (!this.#started) {
      await this.#client.start();
      this.#started = true;
    }

    return this.#client;
  }

  private extractSessionError(event: SessionEvent | undefined): unknown {
    if (!event || typeof event !== "object" || !("data" in event)) {
      return new Error("Copilot session error");
    }

    const data = event.data as Record<string, unknown> | undefined;
    if (!data) {
      return new Error("Copilot session error");
    }

    if (data.error !== undefined) {
      return data.error;
    }

    if (typeof data.message === "string") {
      return new Error(data.message);
    }

    return new Error("Copilot session error");
  }
}

export function createCopilotProvider(token?: string): CopilotProvider {
  return new CopilotProvider(token);
}
