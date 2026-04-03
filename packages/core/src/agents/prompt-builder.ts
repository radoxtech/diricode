import type {
  AgentMetadata,
  AgentTier,
  BuiltPrompt,
  PromptBudget,
  ContextInjection,
  RepoMap,
  FileContext,
  HistoryMessage,
  PlanContext,
  ModelHints,
  TemplateVars,
} from "./types.js";
import type { Tool, ToolAccessPolicy } from "../tools/types.js";
import { filterToolsByAllowlist } from "../tools/types.js";
import type { PromptCache } from "./prompt-cache.js";

export const DEFAULT_BUDGET: PromptBudget = {
  system: { maxTokens: 2000 },
  tools: { maxTokens: 1500 },
  repoMap: { maxTokens: 1000 },
  files: { maxTokens: 8000 },
  history: { maxTokens: 3000 },
  plan: { maxTokens: 500 },
  userInput: { maxTokens: 4000 },
};

export interface PromptBuilderConfig {
  metadata: AgentMetadata;
  budget?: PromptBudget;
  workspaceRoot?: string;
  systemTemplate?: string;
  /**
   * Optional explicit tool access policy for filtering.
   * If not provided, uses metadata.toolPolicy.
   */
  toolPolicy?: ToolAccessPolicy;
}

export class PromptBuilder {
  private config: PromptBuilderConfig;
  private budget: PromptBudget;
  private repoMap?: RepoMap;
  private files: FileContext[] = [];
  private history: HistoryMessage[] = [];
  private plan?: PlanContext;
  private tools: Tool[] = [];
  private modelHints?: ModelHints;
  private customVars: Record<string, string> = {};
  private capabilities: readonly string[] = [];
  private promptCache?: PromptCache;

  constructor(config: PromptBuilderConfig) {
    this.config = config;
    this.budget = config.budget ?? DEFAULT_BUDGET;
  }

  private getEffectiveTier(): AgentTier {
    if (this.modelHints?.tier !== undefined) {
      return this.modelHints.tier;
    }

    const priority: readonly AgentTier[] = ["heavy", "medium", "light"];
    return (
      priority.find((tier) => this.config.metadata.allowedTiers.includes(tier)) ??
      this.config.metadata.allowedTiers[0] ??
      "medium"
    );
  }

  private getRenderedCapabilities(): readonly string[] {
    if (this.capabilities.length > 0) {
      return this.capabilities;
    }

    return [
      this.config.metadata.capabilities.primary,
      ...this.config.metadata.capabilities.specialization,
      ...this.config.metadata.capabilities.modelAttributes,
    ];
  }

  injectRepoMap(repoMap: RepoMap): this {
    this.repoMap = repoMap;
    return this;
  }

  injectFiles(files: readonly FileContext[]): this {
    this.files.push(...files);
    return this;
  }

  injectHistory(history: readonly HistoryMessage[]): this {
    this.history.push(...history);
    return this;
  }

  injectPlan(plan: PlanContext): this {
    this.plan = plan;
    return this;
  }

  bindTools(tools: readonly Tool[], capabilities: readonly string[]): this {
    this.capabilities = capabilities;
    const policy = this.config.toolPolicy ?? this.config.metadata.toolPolicy;
    this.tools = filterToolsByAllowlist(tools, policy ?? {});
    return this;
  }

  withModelHints(hints: ModelHints): this {
    this.modelHints = hints;
    return this;
  }

  withCustomVars(vars: TemplateVars["custom"]): this {
    this.customVars = { ...this.customVars, ...vars };
    return this;
  }

  withPromptCache(cache: PromptCache): this {
    this.promptCache = cache;
    return this;
  }

  build(userMessage: string, _injections: ContextInjection[]): BuiltPrompt {
    const useCache = this.promptCache !== undefined && !this.hasDynamicContext();

    let systemPrompt: string;
    let systemTokenEstimate: number;

    if (useCache && this.promptCache) {
      const effectiveTier = this.getEffectiveTier();
      const cached = this.promptCache.get(
        this.config.metadata.name,
        this.config.workspaceRoot ?? "",
        effectiveTier,
      );

      if (cached) {
        systemPrompt = cached.systemPrompt;
        systemTokenEstimate = cached.tokenEstimate;
      } else {
        const rendered = this.renderSystemPrompt();
        systemPrompt = this.truncate(rendered, this.budget.system.maxTokens);
        systemTokenEstimate = this.estimateTokens(systemPrompt);
        this.promptCache.set(
          this.config.metadata.name,
          this.config.workspaceRoot ?? "",
          effectiveTier,
          { systemPrompt, tokenEstimate: systemTokenEstimate },
        );
      }
    } else {
      systemPrompt = this.renderSystemPrompt();
      systemTokenEstimate = this.estimateTokens(systemPrompt);
    }

    const toolsSection = this.tools.map((t) => `${t.name}: ${t.description}`).join("\n");
    const tokenEstimate =
      systemTokenEstimate + this.estimateTokens(userMessage) + this.estimateTokens(toolsSection);

    return {
      systemPrompt: useCache
        ? systemPrompt
        : this.truncate(systemPrompt, this.budget.system.maxTokens),
      userMessage: this.truncate(userMessage, this.budget.userInput.maxTokens),
      toolsSection: this.truncate(toolsSection, this.budget.tools.maxTokens),
      tokenBudget: this.budget,
      modelHints: this.modelHints ?? {},
      tokenEstimate,
    };
  }

  private hasDynamicContext(): boolean {
    return (
      this.repoMap !== undefined ||
      this.files.length > 0 ||
      this.history.length > 0 ||
      this.plan !== undefined
    );
  }

  private renderSystemPrompt(): string {
    let template =
      this.config.systemTemplate ??
      "You are {{agentName}}. {{agentDescription}}\nCapabilities: {{capabilities}}\nTools: {{tools}}\nWorkspace: {{workspaceRoot}}";

    const vars: Record<string, string> = {
      agentName: this.config.metadata.name || "",
      agentDescription: this.config.metadata.description || "",
      capabilities: this.getRenderedCapabilities().join(", "),
      tools: this.tools.map((t) => t.name).join(", "),
      workspaceRoot: this.config.workspaceRoot ?? "",
      ...this.customVars,
    };

    for (const [key, value] of Object.entries(vars)) {
      template = template.replace(new RegExp(`{{${key}}}`, "g"), value);
    }

    let result = template;

    if (this.repoMap) {
      const repoMapStr = this.truncate(JSON.stringify(this.repoMap), this.budget.repoMap.maxTokens);
      result += `\n\nRepo Map:\n${repoMapStr}`;
    }

    if (this.files.length > 0) {
      const filesStr = this.truncate(
        this.files.map((f) => `${f.path}:\n${f.content}`).join("\n---\n"),
        this.budget.files.maxTokens,
      );
      result += `\n\nFiles:\n${filesStr}`;
    }

    if (this.history.length > 0) {
      const historyStr = this.truncate(
        this.history.map((h) => `${h.role}: ${h.content}`).join("\n"),
        this.budget.history.maxTokens,
      );
      result += `\n\nHistory:\n${historyStr}`;
    }

    if (this.plan) {
      const planStr = this.truncate(JSON.stringify(this.plan), this.budget.plan.maxTokens);
      result += `\n\nPlan:\n${planStr}`;
    }

    return result;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private truncate(text: string, maxTokens: number): string {
    const maxLength = maxTokens * 4;
    if (text.length <= maxLength) {
      return text;
    }
    return text.slice(0, maxLength);
  }
}
