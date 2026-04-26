import { env, pipeline } from "@huggingface/transformers";

env.allowLocalModels = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExtractorResult = any;

let extractorPromise: Promise<ExtractorResult> | null = null;

export async function getExtractor(): Promise<ExtractorResult> {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  extractorPromise ??= pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  return extractorPromise;
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i] ?? 0;
    const b = vecB[i] ?? 0;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export const BRIDGE_CONCEPTS: Record<string, Record<string, number>> = {
  coding: { coding: 1.0 },
  programming: { coding: 1.0 },
  javascript: { coding: 0.95, "ui-ux": 0.35 },
  typescript: { coding: 0.95, "ui-ux": 0.35 },
  react: { "ui-ux": 0.9, coding: 0.75 },
  jsx: { "ui-ux": 0.8, coding: 0.7 },
  tsx: { "ui-ux": 0.8, coding: 0.7 },
  "react javascript": { "ui-ux": 1.0, coding: 0.85 },
  "javascript react": { "ui-ux": 1.0, coding: 0.85 },
  "coding react": { coding: 0.95, "ui-ux": 0.8 },
  "coding javascript": { coding: 0.95 },
  "coding react javascript": { coding: 1.0, "ui-ux": 0.9 },
  frontend: { "ui-ux": 1.0, coding: 0.5 },
  "frontend website": { "ui-ux": 1.0, coding: 0.5 },
  "frontend landing page": { "ui-ux": 1.0, coding: 0.4 },
  "landing page": { "ui-ux": 1.0, coding: 0.3 },
  website: { "ui-ux": 0.9, coding: 0.5 },
  "web design": { "ui-ux": 1.0, coding: 0.4 },
  "web page": { "ui-ux": 0.9, coding: 0.3 },
  "html css": { "ui-ux": 0.8, coding: 0.6 },
  "react component": { "ui-ux": 0.6, coding: 0.6 },
  "ui component": { "ui-ux": 1.0, coding: 0.3 },
  "user interface": { "ui-ux": 1.0 },
  "user experience": { "ui-ux": 1.0 },
  button: { "ui-ux": 0.7, coding: 0.3 },
  form: { "ui-ux": 0.7, coding: 0.4 },
  navbar: { "ui-ux": 0.8, coding: 0.3 },
  sidebar: { "ui-ux": 0.8, coding: 0.3 },
  menu: { "ui-ux": 0.7, coding: 0.3 },
  modal: { "ui-ux": 0.7, coding: 0.4 },
  styling: { "ui-ux": 0.8, coding: 0.3 },
  css: { "ui-ux": 0.7, coding: 0.5 },
  tailwind: { "ui-ux": 0.6, coding: 0.5 },
  responsive: { "ui-ux": 0.8, coding: 0.3 },
  backend: { coding: 1.0, architecture: 0.5 },
  api: { coding: 0.8, architecture: 0.4 },
  "rest api": { coding: 0.8, architecture: 0.4 },
  graphql: { coding: 0.7, architecture: 0.5 },
  database: { architecture: 0.9, coding: 0.5 },
  sql: { coding: 0.7, architecture: 0.3 },
  migration: { coding: 0.5, architecture: 0.4 },
  schema: { architecture: 0.7, coding: 0.4 },
  bug: { debugging: 1.0 },
  crash: { debugging: 1.0 },
  error: { debugging: 0.8 },
  fix: { debugging: 0.6, coding: 0.4 },
  "not working": { debugging: 1.0 },
  broken: { debugging: 0.9 },
  refactor: { refactoring: 1.0, quality: 0.5 },
  improve: { quality: 0.7, refactoring: 0.5 },
  "clean up": { refactoring: 0.8 },
  modernize: { refactoring: 0.9 },
  "technical debt": { refactoring: 1.0 },
  architecture: { architecture: 1.0 },
  "system design": { architecture: 1.0 },
  microservices: { architecture: 1.0 },
  scalability: { architecture: 1.0 },
  algorithm: { reasoning: 1.0, coding: 0.4 },
  difficult: { reasoning: 0.85, coding: 0.45 },
  hard: { reasoning: 0.85, coding: 0.4 },
  complex: { reasoning: 0.8, coding: 0.35 },
  "difficult coding": { coding: 0.85, reasoning: 0.75 },
  "complex coding": { coding: 0.9, reasoning: 0.75 },
  "hard coding": { coding: 0.85, reasoning: 0.7 },
  "complex logic": { reasoning: 1.0 },
  math: { reasoning: 1.0 },
  optimization: { reasoning: 0.8, speed: 0.6 },
  fast: { speed: 1.0 },
  performance: { speed: 1.0, reasoning: 0.3 },
  latency: { speed: 1.0 },
  "real-time": { speed: 0.8 },
  agent: { agentic: 1.0 },
  autonomous: { agentic: 1.0 },
  "tool calling": { agentic: 1.0 },
  creative: { creative: 1.0 },
  writing: { creative: 1.0 },
  copywriting: { creative: 1.0 },
  marketing: { creative: 0.8 },
  blog: { creative: 0.8, coding: 0.2 },
  content: { creative: 0.7 },
  review: { "code-review": 0.8 },
  "pull request": { "code-review": 0.9 },
  pr: { "code-review": 0.7 },
  "understand codebase": { "repo-understanding": 1.0 },
  "entire codebase": { "repo-understanding": 1.0 },
  multifile: { "repo-understanding": 0.8 },
  bulk: { bulk: 1.0 },
  batch: { bulk: 1.0 },
  summarize: { bulk: 0.7 },
  extract: { bulk: 0.8 },
  "many files": { bulk: 0.8 },
  format: { "instruction-fidelity": 0.8 },
  constraint: { "instruction-fidelity": 0.9 },
  exact: { "instruction-fidelity": 0.8 },
  strict: { "instruction-fidelity": 0.7 },
  "high quality": { quality: 1.0 },
  production: { quality: 0.7 },
  "senior level": { quality: 1.0 },
  "best practice": { quality: 0.8 },
};

export const ATTRIBUTE_DESCRIPTIONS: Record<string, string> = {
  reasoning: "complex logic, problem solving, mathematics, multi-step algorithms, deep thinking",
  speed: "fast execution, low latency, real-time responses, quick turnarounds",
  agentic: "autonomous behavior, tool calling, API integration, independent decision making",
  creative: "writing, brainstorming, ideation, out-of-the-box thinking, storytelling, marketing",
  "ui-ux":
    "frontend, web design, user interface, user experience, landing pages, CSS, React, HTML, aesthetics",
  bulk: "large context processing, data extraction, summarizing documents, processing files",
  quality: "high fidelity, precise output, senior level production code, thorough answers",
  coding: "programming, software engineering, writing scripts, implementing features, development",
  architecture: "system design, software architecture, designing databases, structural patterns",
  refactoring: "improving existing code, modernizing codebase, cleaning up technical debt",
  debugging: "finding bugs, fixing errors, resolving crashes, diagnosing issues, log analysis",
  "repo-understanding": "understanding entire codebases, cross-file references, multi-file context",
  "instruction-fidelity":
    "following complex constraints, strict adherence to prompts, strict formatting",
  "code-review": "reviewing pull requests, leaving constructive feedback, security vulnerabilities",
};

export const HIGH_COMPLEXITY_KEYWORDS = [
  "architecture",
  "architect",
  "system design",
  "complex",
  "multi-file",
  "multi-component",
  "performance-critical",
  "scalability",
  "distributed",
  "microservices",
  "algorithm design",
  "algorithm",
  "proof",
  "theorem",
  "optimization problem",
  "mathematical",
  "formal logic",
  "competitive programming",
  "multi-step",
  "interdependent",
  "novel",
  "research",
  "investigation",
  "evaluate",
  "compare",
  "synthesize",
  "strategic",
  "adversarial",
] as const;

export const LOW_COMPLEXITY_KEYWORDS = [
  "simple",
  "basic",
  "junior",
  "crud",
  "prototype",
  "single",
  "straightforward",
  "typical",
  "standard",
  "routine",
  "trivial",
  "easy",
  "straightforward",
  "boilerplate",
  "template",
  "copy",
  "format",
  "lint",
] as const;

export interface BestMatchResult {
  score: number;
  bestAttribute: string;
  bridgeConcepts: { phrase: string; attribute: string; score: number }[];
  method: "bridge" | "embeddings" | "none";
}

export interface ComputeBestMatchOptions {
  disableBridge?: boolean;
  embedText?: (text: string) => Promise<number[]>;
}

async function embedWithExtractor(
  text: string,
  extractor: ExtractorResult,
): Promise<number[]> {
  const output = await extractor(text, { pooling: "mean", normalize: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Array.from((output as any).data);
}

export async function computeBestMatch(
  specText: string,
  attributes: readonly string[],
  options: ComputeBestMatchOptions = {},
): Promise<BestMatchResult> {
  if (!specText || attributes.length === 0) {
    return { score: 0, bestAttribute: "", bridgeConcepts: [], method: "none" };
  }

  const lowerText = specText.toLowerCase();
  const bridgeScores: Record<string, number> = {};
  const bridgeHits: { phrase: string; attribute: string; score: number }[] = [];

  if (!options.disableBridge) {
    for (const [phrase, attrScores] of Object.entries(BRIDGE_CONCEPTS)) {
      if (lowerText.includes(phrase)) {
        for (const [attr, score] of Object.entries(attrScores)) {
          bridgeScores[attr] = Math.max(bridgeScores[attr] ?? 0, score);
          bridgeHits.push({ phrase, attribute: attr, score });
        }
      }
    }
  }

  if (Object.keys(bridgeScores).length > 0) {
    let bestAttr = "";
    let maxScore = 0;
    for (const attr of attributes) {
      const s = bridgeScores[attr] ?? 0;
      if (s > maxScore) {
        maxScore = s;
        bestAttr = attr;
      }
    }
    const relevantHits = bridgeHits.filter((h) => attributes.includes(h.attribute));
    return {
      score: maxScore,
      bestAttribute: bestAttr,
      bridgeConcepts: relevantHits,
      method: "bridge",
    };
  }

  try {
    const extractor = options.embedText ? null : await getExtractor();
    const embedText = options.embedText ?? ((text: string) => {
      if (!extractor) throw new Error("Extractor not initialized");
      return embedWithExtractor(text, extractor);
    });
    const specVec = await embedText(specText);

    let maxScore = 0;
    let bestAttr = "";

    const attrOutputs = await Promise.all(
      attributes.map((attr) => {
        const desc = ATTRIBUTE_DESCRIPTIONS[attr] ?? attr;
        return embedText(desc);
      }),
    );

    for (let i = 0; i < attributes.length; i++) {
      const attrVec = attrOutputs[i];
      if (!attrVec) continue;
      const score = cosineSimilarity(specVec, attrVec);
      if (score > maxScore) {
        maxScore = score;
        bestAttr = attributes[i] ?? "";
      }
    }

    return { score: maxScore, bestAttribute: bestAttr, bridgeConcepts: [], method: "embeddings" };
  } catch {
    return { score: 0, bestAttribute: "", bridgeConcepts: [], method: "none" };
  }
}
