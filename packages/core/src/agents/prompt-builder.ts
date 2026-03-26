import type {
  AgentMetadata,
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
import type { Tool } from "../tools/types.js";

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

  constructor(config: PromptBuilderConfig) {
    this.config = config;
    this.budget = config.budget ?? DEFAULT_BUDGET;
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
    this.tools = tools.filter((tool) => {
      if (!tool.annotations || !("capabilities" in tool.annotations)) {
        return true;
      }
      const toolCaps = tool.annotations.capabilities;
      if (Array.isArray(toolCaps)) {
        return toolCaps.some((c) => capabilities.includes(typeof c === "string" ? c : String(c)));
      }
      return true;
    });
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

  build(userMessage: string, _injections: ContextInjection[]): BuiltPrompt {
    const systemPrompt = this.renderSystemPrompt();
    const toolsSection = this.tools.map((t) => `${t.name}: ${t.description}`).join("\n");
    const tokenEstimate =
      this.estimateTokens(systemPrompt) +
      this.estimateTokens(userMessage) +
      this.estimateTokens(toolsSection);

    return {
      systemPrompt: this.truncate(systemPrompt, this.budget.system.maxTokens),
      userMessage: this.truncate(userMessage, this.budget.userInput.maxTokens),
      toolsSection: this.truncate(toolsSection, this.budget.tools.maxTokens),
      tokenBudget: this.budget,
      modelHints: this.modelHints ?? {},
      tokenEstimate,
    };
  }

  private renderSystemPrompt(): string {
    let template =
      this.config.systemTemplate ??
      "You are {{agentName}}. {{agentDescription}}\nCapabilities: {{capabilities}}\nTools: {{tools}}\nWorkspace: {{workspaceRoot}}";

    const vars: Record<string, string> = {
      agentName: this.config.metadata.name || "",
      agentDescription: this.config.metadata.description || "",
      capabilities: this.capabilities.join(", "),
      tools: this.tools.map((t) => t.name).join(", "),
      workspaceRoot: this.config.workspaceRoot || "",
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
