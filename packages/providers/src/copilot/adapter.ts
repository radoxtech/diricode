import { createGitHubModels } from "@github/models";
import type { GenerateOptions, ModelConfig, Provider, StreamChunk } from "../types.js";
import { DEFAULT_COPILOT_MODEL, getGithubModelInfo } from "./models.js";
import { getGithubToken } from "./auth.js";

export class CopilotProvider implements Provider {
  readonly name = "copilot";
  readonly defaultModel: ModelConfig;
  readonly #client: ReturnType<typeof createGitHubModels>;
  readonly #token: string | undefined;

  constructor(token?: string) {
    this.#token = token ?? getGithubToken();
    this.#client = createGitHubModels({
      apiKey: this.#token,
    });
    this.defaultModel = {
      modelId: DEFAULT_COPILOT_MODEL,
    };
  }

  isAvailable(): boolean {
    return this.#token !== undefined && this.#token.length > 0;
  }

  async generate(options: GenerateOptions): Promise<string> {
    const modelId = this.resolveModel(options.model);
    const { generateText } = await import("ai");
    const { text } = await generateText({
      model: this.#client.languageModel(modelId),
      prompt: options.prompt,
      maxOutputTokens: options.model?.maxTokens,
      temperature: options.model?.temperature,
      abortSignal: options.signal,
    });
    return text;
  }

  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const modelId = this.resolveModel(options.model);
    const { streamText } = await import("ai");
    const result = streamText({
      model: this.#client.languageModel(modelId),
      prompt: options.prompt,
      maxOutputTokens: options.model?.maxTokens,
      temperature: options.model?.temperature,
      abortSignal: options.signal,
    });
    for await (const delta of result.fullStream) {
      if (delta.type === "text-delta") {
        yield { delta: delta.text, done: false };
      }
    }
    yield { delta: "", done: true };
  }

  private resolveModel(model?: ModelConfig): string {
    const id = model?.modelId ?? this.defaultModel.modelId;
    const info = getGithubModelInfo(id);
    if (!info) {
      throw new Error(`Unknown GitHub model: "${id}". Add it to the model mapping table.`);
    }
    return info.modelId;
  }
}

export function createCopilotProvider(token?: string): Provider {
  return new CopilotProvider(token);
}
