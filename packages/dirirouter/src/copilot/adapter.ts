import { CopilotClient, approveAll } from "@github/copilot-sdk";
import type { CopilotSession, ModelInfo, SessionEvent } from "@github/copilot-sdk";
import { classifyError } from "../error-classifier.js";
import type { GenerateOptions, ModelConfig, Provider, StreamChunk } from "../types.js";
import type { ProviderModelAvailability } from "../contracts/provider-model-availability.js";
import type { ProviderDiscoveryResult } from "../provider-discovery.js";
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
      modelId: "gpt-4o",
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

  getModelAvailability(): ProviderModelAvailability[] {
    return [];
  }

  async discoverAvailability(): Promise<ProviderDiscoveryResult> {
    const { normalizeModelFamily } = await import("../families/normalization.js");

    if (!this.isAvailable()) {
      return {
        provider: this,
        availabilities: [],
        status: {
          name: this.name,
          available: false,
          error: "No token. Run 'diricode login copilot' to authenticate.",
          envVar: "GITHUB_TOKEN",
          modelCount: 0,
          modelNames: [],
        },
      };
    }

    try {
      const models = await this.listModels();
      const seen = new Set<string>();
      const availabilities: ProviderModelAvailability[] = [];

      for (const model of models) {
        if (seen.has(model.id)) continue;
        seen.add(model.id);

        const normalized = normalizeModelFamily(model.id);
        const capabilities =
          model.capabilities != null
            ? (model.capabilities as unknown as Record<string, unknown>)
            : undefined;

        const toolCalling =
          typeof capabilities?.tool_calls === "boolean"
            ? capabilities.tool_calls
            : typeof capabilities?.tool_calling === "boolean"
              ? capabilities.tool_calling
              : true;
        const streaming =
          typeof capabilities?.streaming === "boolean" ? capabilities.streaming : true;
        const vision = typeof capabilities?.vision === "boolean" ? capabilities.vision : false;

        availabilities.push({
          provider: this.name,
          model_id: model.id,
          family: normalized.family,
          stability: normalized.stability,
          available: true,
          context_window: 200_000,
          supports_tool_calling: toolCalling,
          supports_vision: vision,
          supports_structured_output: true,
          supports_streaming: streaming,
          input_cost_per_1k: 0,
          output_cost_per_1k: 0,
          trusted: true,
        });
      }

      await this.stop();

      if (availabilities.length === 0) {
        return {
          provider: this,
          availabilities: [],
          status: {
            name: this.name,
            available: false,
            error: "Copilot API returned no models.",
            envVar: "GITHUB_TOKEN",
            modelCount: 0,
            modelNames: [],
          },
        };
      }

      return {
        provider: this,
        availabilities,
        status: {
          name: this.name,
          available: true,
          envVar: "GITHUB_TOKEN",
          modelCount: availabilities.length,
          modelNames: availabilities.map((a) => a.model_id),
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.stop();
      return {
        provider: this,
        availabilities: [],
        status: {
          name: this.name,
          available: false,
          error: `API error: ${message}`,
          envVar: "GITHUB_TOKEN",
          modelCount: 0,
          modelNames: [],
        },
      };
    }
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
