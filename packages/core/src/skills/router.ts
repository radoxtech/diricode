import type { SkillManifest } from "./types.js";

export interface SkillRouterProvider {
  complete(prompt: string): Promise<string>;
}

interface LruNode {
  key: string;
  value: string[];
  prev: LruNode | null;
  next: LruNode | null;
}

class LruCache {
  private readonly map = new Map<string, LruNode>();
  private head: LruNode | null = null;
  private tail: LruNode | null = null;
  private size = 0;

  constructor(private readonly capacity: number) {}

  get(key: string): string[] | undefined {
    const node = this.map.get(key);
    if (!node) return undefined;
    this.moveToFront(node);
    return node.value;
  }

  set(key: string, value: string[]): void {
    const existing = this.map.get(key);
    if (existing) {
      existing.value = value;
      this.moveToFront(existing);
      return;
    }

    const node: LruNode = { key, value, prev: null, next: this.head };
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
    this.map.set(key, node);
    this.size++;

    if (this.size > this.capacity) {
      this.evictTail();
    }
  }

  private moveToFront(node: LruNode): void {
    if (node === this.head) return;
    this.unlink(node);
    node.next = this.head;
    node.prev = null;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  private unlink(node: LruNode): void {
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    if (this.tail === node) this.tail = node.prev;
    if (this.head === node) this.head = node.next;
  }

  private evictTail(): void {
    if (!this.tail) return;
    this.map.delete(this.tail.key);
    this.unlink(this.tail);
    this.size--;
  }

  get currentSize(): number {
    return this.size;
  }
}

export interface SkillRouterOptions {
  maxSkills?: number;
  cacheCapacity?: number;
  timeoutMs?: number;
}

export class SkillRouter {
  private readonly cache: LruCache;
  private readonly maxSkills: number;
  private readonly timeoutMs: number;

  constructor(
    private readonly provider: SkillRouterProvider,
    options: SkillRouterOptions = {},
  ) {
    this.maxSkills = options.maxSkills ?? 3;
    this.cache = new LruCache(options.cacheCapacity ?? 128);
    this.timeoutMs = options.timeoutMs ?? 5_000;
  }

  async route(
    taskDescription: string,
    taskType: string,
    agentId: string,
    availableSkills: SkillManifest[],
  ): Promise<SkillManifest[]> {
    if (availableSkills.length === 0) return [];

    const cacheKey = `${taskType}::${agentId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return this.resolveIds(cached, availableSkills);
    }

    let selectedIds: string[];
    try {
      selectedIds = await this.queryLlm(taskDescription, taskType, availableSkills);
    } catch {
      selectedIds = this.tagFallback(taskType, availableSkills);
    }

    this.cache.set(cacheKey, selectedIds);
    return this.resolveIds(selectedIds, availableSkills);
  }

  private async queryLlm(
    taskDescription: string,
    taskType: string,
    skills: SkillManifest[],
  ): Promise<string[]> {
    const catalog = skills
      .map((s) => `- ${s.id}: ${s.description} [tags: ${s.tags.join(", ")}]`)
      .join("\n");

    const prompt = [
      `You are a skill routing assistant. Select the most relevant skills for the task.`,
      ``,
      `Task type: ${taskType}`,
      `Task description: ${taskDescription}`,
      ``,
      `Available skills:`,
      catalog,
      ``,
      `Reply with a JSON array of up to ${String(this.maxSkills)} skill IDs (strings only).`,
      `Example: ["skill-a", "skill-b"]`,
      `Respond with ONLY the JSON array, no explanation.`,
    ].join("\n");

    const raw = await withTimeout(this.provider.complete(prompt), this.timeoutMs);
    return this.parseIds(raw, skills);
  }

  private parseIds(raw: string, skills: SkillManifest[]): string[] {
    const validIds = new Set(skills.map((s) => s.id));
    let parsed: unknown;
    try {
      const match = raw.match(/\[[\s\S]*]/);
      parsed = JSON.parse(match ? match[0] : raw);
    } catch {
      return this.tagFallback("", skills);
    }

    if (!Array.isArray(parsed)) return this.tagFallback("", skills);

    return parsed
      .filter((item): item is string => typeof item === "string" && validIds.has(item))
      .slice(0, this.maxSkills);
  }

  private tagFallback(taskType: string, skills: SkillManifest[]): string[] {
    const needle = taskType.toLowerCase();
    const scored = skills.map((s) => {
      const tagHit = s.tags.some(
        (t) => needle.includes(t.toLowerCase()) || t.toLowerCase().includes(needle),
      );
      return { id: s.id, score: tagHit ? 1 : 0 };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, this.maxSkills).map((s) => s.id);
  }

  private resolveIds(ids: string[], skills: SkillManifest[]): SkillManifest[] {
    const index = new Map(skills.map((s) => [s.id, s]));
    return ids.flatMap((id) => {
      const s = index.get(id);
      return s ? [s] : [];
    });
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${String(ms)}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
