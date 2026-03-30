import type { ModelDescriptor, ModelQuota, ProviderAdapter } from "../types.js";

const MINIMAX_MODELS: ModelDescriptor[] = [
  {
    apiModel: "MiniMax-M2.7",
    contextWindow: 204_800,
    maxOutput: 16_384,
    canReason: true,
    toolCall: true,
    vision: false,
    attachment: false,
    quotaMultiplier: 1,
  },
  {
    apiModel: "MiniMax-M2.7-highspeed",
    contextWindow: 204_800,
    maxOutput: 16_384,
    canReason: true,
    toolCall: true,
    vision: false,
    attachment: false,
    quotaMultiplier: 2,
  },
  {
    apiModel: "MiniMax-M2.5",
    contextWindow: 204_800,
    maxOutput: 16_384,
    canReason: false,
    toolCall: true,
    vision: false,
    attachment: false,
    quotaMultiplier: 1,
  },
  {
    apiModel: "MiniMax-M2.5-highspeed",
    contextWindow: 204_800,
    maxOutput: 16_384,
    canReason: false,
    toolCall: true,
    vision: false,
    attachment: false,
    quotaMultiplier: 2,
  },
  {
    apiModel: "MiniMax-M2.1",
    contextWindow: 204_800,
    maxOutput: 16_384,
    canReason: false,
    toolCall: true,
    vision: false,
    attachment: false,
    quotaMultiplier: 1,
  },
  {
    apiModel: "MiniMax-M2.1-highspeed",
    contextWindow: 204_800,
    maxOutput: 16_384,
    canReason: false,
    toolCall: true,
    vision: false,
    attachment: false,
    quotaMultiplier: 2,
  },
  {
    apiModel: "MiniMax-M2",
    contextWindow: 204_800,
    maxOutput: 16_384,
    canReason: false,
    toolCall: true,
    vision: false,
    attachment: false,
    quotaMultiplier: 1,
  },
];

export class MinimaxProviderAdapter implements ProviderAdapter {
  readonly providerId = "minimax";

  listModels(): ModelDescriptor[] {
    return MINIMAX_MODELS;
  }

  getQuota(): ModelQuota[] | null {
    return null;
  }
}
