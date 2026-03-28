import { classifyError, type ClassifiedError, type ProviderErrorKind } from "./error-classifier.js";
import type { Registry } from "./registry.js";
import type { GenerateOptions, ModelConfig, Provider, StreamChunk } from "./types.js";

export const MAX_RETRIES = 3;
export const MAX_RETRIES_AFTER_FALLBACK = 2;
export const MAX_RETRY_DELAY_MS = 15_000;

export interface ProviderAttemptRecord {
  readonly provider: string;
  readonly model: string;
  readonly phase: "generate" | "stream";
  readonly attempt: number;
  readonly error: ClassifiedError;
}

export interface ProviderFallbackEvent {
  readonly type: "provider_fallback";
  readonly fromProvider: string;
  readonly toProvider: string;
  readonly reason: ProviderErrorKind;
  readonly phase: "generate" | "stream";
  readonly attemptsOnProvider: number;
}

export interface ProviderRouterOptions {
  readonly maxRetries?: number;
  readonly maxRetriesAfterFallback?: number;
  readonly maxRetryDelayMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly onFallback?: (event: ProviderFallbackEvent) => void;
}

export class ProviderRouterError extends Error {
  readonly attempts: readonly ProviderAttemptRecord[];
  readonly lastError: ClassifiedError | undefined;

  constructor(message: string, attempts: readonly ProviderAttemptRecord[]) {
    super(message);
    this.name = "ProviderRouterError";
    this.attempts = attempts;
    this.lastError = attempts.at(-1)?.error;
  }
}

interface CandidateProvider {
  readonly provider: Provider;
  readonly priority: number;
}

export class ProviderRouter implements Provider {
  readonly name = "router";
  readonly defaultModel: ModelConfig;

  readonly #registry: Registry;
  readonly #maxRetries: number;
  readonly #maxRetriesAfterFallback: number;
  readonly #maxRetryDelayMs: number;
  readonly #sleep: (ms: number) => Promise<void>;
  readonly #onFallback?: (event: ProviderFallbackEvent) => void;

  constructor(registry: Registry, options: ProviderRouterOptions = {}) {
    this.#registry = registry;
    this.defaultModel = registry.getDefault().defaultModel;
    this.#maxRetries = options.maxRetries ?? MAX_RETRIES;
    this.#maxRetriesAfterFallback = options.maxRetriesAfterFallback ?? MAX_RETRIES_AFTER_FALLBACK;
    this.#maxRetryDelayMs = options.maxRetryDelayMs ?? MAX_RETRY_DELAY_MS;
    this.#sleep = options.sleep ?? defaultSleep;
    this.#onFallback = options.onFallback;
  }

  isAvailable(): boolean {
    return this.#getCandidateProviders().some(({ provider }) => provider.isAvailable());
  }

  async generate(options: GenerateOptions): Promise<string> {
    const attempts: ProviderAttemptRecord[] = [];
    const providers = this.#getCandidateProviders();

    for (let providerIndex = 0; providerIndex < providers.length; providerIndex += 1) {
      const candidate = providers[providerIndex];
      if (!candidate) {
        break;
      }
      const maxRetries = this.#getRetryBudget(providerIndex);

      for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
        try {
          return await candidate.provider.generate(options);
        } catch (error) {
          const classified = this.#recordAttempt(
            attempts,
            candidate.provider,
            options,
            "generate",
            attempt,
            error,
          );
          const hasFallback = providerIndex < providers.length - 1;

          if (this.#shouldRetry(classified, attempt, maxRetries)) {
            await this.#sleep(this.#computeDelay(classified, attempt));
            continue;
          }

          if (hasFallback && this.#shouldFallback(classified, attempt, maxRetries)) {
            const nextCandidate = providers[providerIndex + 1];
            if (!nextCandidate) {
              throw this.#toTerminalError(attempts);
            }
            this.#emitFallback(
              candidate.provider,
              nextCandidate.provider,
              classified,
              "generate",
              attempt,
            );
            break;
          }

          throw this.#toTerminalError(attempts);
        }
      }
    }

    throw this.#toTerminalError(attempts);
  }

  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const attempts: ProviderAttemptRecord[] = [];
    const providers = this.#getCandidateProviders();

    for (let providerIndex = 0; providerIndex < providers.length; providerIndex += 1) {
      const candidate = providers[providerIndex];
      if (!candidate) {
        break;
      }
      const maxRetries = this.#getRetryBudget(providerIndex);

      for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
        let emittedChunk = false;

        try {
          for await (const chunk of candidate.provider.stream(options)) {
            emittedChunk = true;
            yield chunk;
          }
          return;
        } catch (error) {
          const classified = this.#recordAttempt(
            attempts,
            candidate.provider,
            options,
            "stream",
            attempt,
            error,
          );
          const hasFallback = providerIndex < providers.length - 1;

          if (emittedChunk) {
            throw this.#toTerminalError(
              attempts,
              `Provider stream failed after emitting partial output from ${candidate.provider.name}`,
            );
          }

          if (this.#shouldRetry(classified, attempt, maxRetries)) {
            await this.#sleep(this.#computeDelay(classified, attempt));
            continue;
          }

          if (hasFallback && this.#shouldFallback(classified, attempt, maxRetries)) {
            const nextCandidate = providers[providerIndex + 1];
            if (!nextCandidate) {
              throw this.#toTerminalError(attempts);
            }
            this.#emitFallback(
              candidate.provider,
              nextCandidate.provider,
              classified,
              "stream",
              attempt,
            );
            break;
          }

          throw this.#toTerminalError(attempts);
        }
      }
    }

    throw this.#toTerminalError(attempts);
  }

  #getCandidateProviders(): CandidateProvider[] {
    return this.#registry
      .list()
      .map(({ name, priority }) => ({ provider: this.#registry.get(name), priority }))
      .filter(({ provider }) => provider.isAvailable());
  }

  #getRetryBudget(providerIndex: number): number {
    return providerIndex === 0 ? this.#maxRetries : this.#maxRetriesAfterFallback;
  }

  #recordAttempt(
    attempts: ProviderAttemptRecord[],
    provider: Provider,
    options: GenerateOptions,
    phase: "generate" | "stream",
    attempt: number,
    error: unknown,
  ): ClassifiedError {
    const classified = classifyError(error, {
      provider: provider.name,
      model: options.model?.modelId ?? provider.defaultModel.modelId,
    });

    attempts.push({
      provider: provider.name,
      model: classified.model,
      phase,
      attempt,
      error: classified,
    });

    return classified;
  }

  #shouldRetry(error: ClassifiedError, attempt: number, maxRetries: number): boolean {
    return error.retryable && attempt <= maxRetries;
  }

  #shouldFallback(error: ClassifiedError, attempt: number, maxRetries: number): boolean {
    return (
      error.kind === "quota_exhausted" ||
      error.kind === "auth_error" ||
      (error.kind === "rate_limited" && !this.#shouldRetry(error, attempt, maxRetries))
    );
  }

  #computeDelay(error: ClassifiedError, attempt: number): number {
    if (error.retryAfterMs > 0) {
      return Math.min(error.retryAfterMs, this.#maxRetryDelayMs);
    }

    const exponential = Math.min(250 * 2 ** (attempt - 1), this.#maxRetryDelayMs);
    const jitter = Math.floor(Math.random() * 100);
    return Math.min(exponential + jitter, this.#maxRetryDelayMs);
  }

  #emitFallback(
    fromProvider: Provider,
    toProvider: Provider,
    error: ClassifiedError,
    phase: "generate" | "stream",
    attemptsOnProvider: number,
  ): void {
    if (!this.#onFallback) {
      return;
    }

    this.#onFallback({
      type: "provider_fallback",
      fromProvider: fromProvider.name,
      toProvider: toProvider.name,
      reason: error.kind,
      phase,
      attemptsOnProvider,
    });
  }

  #toTerminalError(
    attempts: readonly ProviderAttemptRecord[],
    message = "All provider attempts failed",
  ): ProviderRouterError {
    return new ProviderRouterError(message, attempts);
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
