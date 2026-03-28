import { createHash } from "node:crypto";
import type { AgentTier } from "./types.js";

export interface CachedEntry {
  systemPrompt: string;
  tokenEstimate: number;
  cachedAt: number;
}

export interface PromptCacheConfig {
  ttlMs?: number;
}

const DEFAULT_TTL_MS = 300_000;

export class PromptCache {
  private cache = new Map<string, CachedEntry>();
  private workspaceIndex = new Map<string, Set<string>>();
  private ttlMs: number;

  constructor(config?: PromptCacheConfig) {
    this.ttlMs = config?.ttlMs ?? DEFAULT_TTL_MS;
  }

  get(agentName: string, workspaceRoot: string, agentTier: AgentTier): CachedEntry | undefined {
    const key = this.computeKey(agentName, workspaceRoot, agentTier);
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() - entry.cachedAt >= this.ttlMs) {
      this.cache.delete(key);
      this.workspaceIndex.get(workspaceRoot)?.delete(key);
      return undefined;
    }

    return entry;
  }

  set(
    agentName: string,
    workspaceRoot: string,
    agentTier: AgentTier,
    entry: Omit<CachedEntry, "cachedAt">,
  ): void {
    const key = this.computeKey(agentName, workspaceRoot, agentTier);
    this.cache.set(key, { ...entry, cachedAt: Date.now() });

    if (!this.workspaceIndex.has(workspaceRoot)) {
      this.workspaceIndex.set(workspaceRoot, new Set());
    }
    const keys = this.workspaceIndex.get(workspaceRoot);
    if (keys) {
      keys.add(key);
    }
  }

  invalidate(agentName: string, workspaceRoot: string, agentTier: AgentTier): void {
    const key = this.computeKey(agentName, workspaceRoot, agentTier);
    this.cache.delete(key);
    this.workspaceIndex.get(workspaceRoot)?.delete(key);
  }

  invalidateWorkspace(workspaceRoot: string): void {
    this.workspaceIndex.get(workspaceRoot)?.forEach((key) => {
      this.cache.delete(key);
    });
    this.workspaceIndex.delete(workspaceRoot);
  }

  clear(): void {
    this.cache.clear();
    this.workspaceIndex.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  private computeKey(agentName: string, workspaceRoot: string, agentTier: AgentTier): string {
    return createHash("sha256").update(`${agentName}:${workspaceRoot}:${agentTier}`).digest("hex");
  }
}
