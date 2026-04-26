import { env, pipeline } from "@huggingface/transformers";
import {
  CANONICAL_ROUTING_TAGS,
  ROUTING_TAG_DEFINITIONS,
  type CanonicalRoutingTag,
} from "../llm-picker/routing-taxonomy.js";

env.allowLocalModels = true;

const DEBERTA_MODEL_ID = "Xenova/deberta-large-mnli-zero-cls";
const MODERNBERT_MODEL_ID = "onnx-community/ModernBERT-large-zeroshot-v2.0-ONNX";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let debertaPipelineCache: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let modernBertPipelineCache: any = null;
let debertaLoading = false;
let modernBertLoading = false;

async function getDebertaPipeline() {
  if (debertaPipelineCache) return debertaPipelineCache;
  if (debertaLoading) {
    while (debertaLoading) await new Promise((r) => setTimeout(r, 100));
    return debertaPipelineCache;
  }
  debertaLoading = true;
  try {
    console.log(
      "[classifier-engine] Loading DeBERTa model (first time - downloading if needed)...",
    );
    debertaPipelineCache = await pipeline("zero-shot-classification", DEBERTA_MODEL_ID, {
      device: "cpu",
    });
    console.log("[classifier-engine] DeBERTa model loaded successfully");
    return debertaPipelineCache;
  } finally {
    debertaLoading = false;
  }
}

async function getModernBertPipeline() {
  if (modernBertPipelineCache) return modernBertPipelineCache;
  if (modernBertLoading) {
    while (modernBertLoading) await new Promise((r) => setTimeout(r, 100));
    return modernBertPipelineCache;
  }
  modernBertLoading = true;
  try {
    console.log(
      "[classifier-engine] Loading ModernBERT model (first time - downloading if needed)...",
    );
    modernBertPipelineCache = await pipeline("zero-shot-classification", MODERNBERT_MODEL_ID, {
      device: "cpu",
    });
    console.log("[classifier-engine] ModernBERT model loaded successfully");
    return modernBertPipelineCache;
  } finally {
    modernBertLoading = false;
  }
}

export interface ClassifierTagScore {
  tag: CanonicalRoutingTag;
  score: number;
  definition: string;
}

export interface ClassifierResult {
  modelId: string;
  modelName: string;
  tagScores: ClassifierTagScore[];
  primaryTags: ClassifierTagScore[];
  rawOutput?: Array<{ label: string; score: number }>;
  isTrueZeroShot: boolean;
}

async function debeNli(text: string): Promise<ClassifierResult> {
  const labels = [...CANONICAL_ROUTING_TAGS];

  const classifier = await getDebertaPipeline();

  let raw;
  try {
    raw = await (classifier as any)(text, labels, { multi_label: true });
  } catch (err) {
    console.error("[classifier-engine] DeBERTa classification failed:", err);
    throw err;
  }

  const rawLabels: string[] = (raw as { labels?: string[] }).labels ?? [];
  const rawScores: number[] = (raw as { scores?: number[] }).scores ?? [];

  const tagScores: ClassifierTagScore[] = rawLabels.map((label, i) => {
    const score = rawScores[i] ?? 0;
    const tag = label as CanonicalRoutingTag;
    return {
      tag: CANONICAL_ROUTING_TAGS.includes(tag) ? tag : (tag as CanonicalRoutingTag),
      score,
      definition: ROUTING_TAG_DEFINITIONS[tag as CanonicalRoutingTag] ?? "",
    };
  });

  tagScores.sort((a, b) => b.score - a.score);

  return {
    modelId: DEBERTA_MODEL_ID,
    modelName: "DeBERTa-v3-large (NLI zero-shot)",
    tagScores,
    primaryTags: tagScores.slice(0, 3),
    rawOutput: rawLabels.map((label, i) => ({ label, score: rawScores[i] ?? 0 })),
    isTrueZeroShot: true,
  };
}

async function modernBertTc(text: string): Promise<ClassifierResult> {
  const labels = [...CANONICAL_ROUTING_TAGS];

  const classifier = await getModernBertPipeline();

  let raw;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    raw = await (classifier as any)(text, labels, {
      multi_label: true,
    });
  } catch (err) {
    console.error("[classifier-engine] ModernBERT classification failed:", err);
    throw err;
  }

  const rawLabels: string[] = (raw as { labels?: string[] }).labels ?? [];
  const rawScores: number[] = (raw as { scores?: number[] }).scores ?? [];

  const tagScores: ClassifierTagScore[] = rawLabels.map((label, i) => {
    const score = rawScores[i] ?? 0;
    const tag = label as CanonicalRoutingTag;
    return {
      tag: CANONICAL_ROUTING_TAGS.includes(tag) ? tag : (tag as CanonicalRoutingTag),
      score,
      definition: ROUTING_TAG_DEFINITIONS[tag as CanonicalRoutingTag] ?? "",
    };
  });

  tagScores.sort((a, b) => b.score - a.score);

  return {
    modelId: MODERNBERT_MODEL_ID,
    modelName: "ModernBERT-large (zero-shot)",
    tagScores,
    primaryTags: tagScores.slice(0, 3),
    rawOutput: rawLabels.map((label, i) => ({ label, score: rawScores[i] ?? 0 })),
    isTrueZeroShot: true,
  };
}

export interface RoutingClassificationInput {
  agentRole: string;
  agentSeniority: string;
  agentSpecializations: string[];
  taskType: string;
  taskDescription: string;
}

export interface RoutingClassificationResult {
  inputText: string;
  deberta: ClassifierResult;
  modernBert: ClassifierResult;
  agreementTags: Array<{
    tag: CanonicalRoutingTag;
    debertaScore: number;
    modernBertScore: number;
    agreed: boolean;
  }>;
  disagreementTags: Array<{
    tag: CanonicalRoutingTag;
    debertaScore: number;
    modernBertScore: number;
  }>;
}

export async function classifyRoutingTags(
  input: RoutingClassificationInput,
): Promise<RoutingClassificationResult> {
  const inputText = [
    `role: ${input.agentRole}`,
    `seniority: ${input.agentSeniority}`,
    `specializations: ${input.agentSpecializations.join(", ") || "(none)"}`,
    `task_type: ${input.taskType}`,
    `description: ${input.taskDescription}`,
  ].join("\n");

  const [debertaResult, modernBertResult] = await Promise.all([
    debeNli(inputText).catch((err) => {
      console.error("[classifier-engine] DeBERTa failed:", err);
      return null;
    }),
    modernBertTc(inputText).catch((err) => {
      console.error("[classifier-engine] ModernBERT failed:", err);
      return null;
    }),
  ]);

  const deberta = debertaResult ?? {
    modelId: DEBERTA_MODEL_ID,
    modelName: "DeBERTa-v3-large (NLI zero-shot)",
    tagScores: [],
    primaryTags: [],
    isTrueZeroShot: true,
  };

  const modernBert = modernBertResult ?? {
    modelId: MODERNBERT_MODEL_ID,
    modelName: "ModernBERT-large (zero-shot)",
    tagScores: [],
    primaryTags: [],
    isTrueZeroShot: true,
  };

  const agreementTags: RoutingClassificationResult["agreementTags"] = [];
  const disagreementTags: RoutingClassificationResult["disagreementTags"] = [];

  if (debertaResult && modernBertResult) {
    const debeMap = new Map(debertaResult.tagScores.map((t) => [t.tag, t.score]));
    const mbertMap = new Map(modernBertResult.tagScores.map((t) => [t.tag, t.score]));

    for (const tag of CANONICAL_ROUTING_TAGS) {
      const dScore = debeMap.get(tag) ?? 0;
      const mScore = mbertMap.get(tag) ?? 0;
      const diff = Math.abs(dScore - mScore);

      if (diff < 0.1) {
        agreementTags.push({ tag, debertaScore: dScore, modernBertScore: mScore, agreed: true });
      } else if (diff > 0.2) {
        disagreementTags.push({ tag, debertaScore: dScore, modernBertScore: mScore });
      }
    }
  }

  return { inputText, deberta, modernBert, agreementTags, disagreementTags };
}

export async function getDebertaTagScores(text: string): Promise<Map<CanonicalRoutingTag, number>> {
  const result = await debeNli(text);
  return new Map(result.tagScores.map((t) => [t.tag, t.score]));
}
