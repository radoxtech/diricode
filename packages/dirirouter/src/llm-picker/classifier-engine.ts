import { env, pipeline } from "@huggingface/transformers";
import {
  CANONICAL_ROUTING_TAGS,
  ROUTING_TAG_DEFINITIONS,
  type CanonicalRoutingTag,
} from "../llm-picker/routing-taxonomy.js";

env.allowLocalModels = true;

const DEBERTA_MODEL_ID = "Xenova/deberta-large-mnli-zero-cls";
const MODERNBERT_MODEL_ID = "onnx-community/ModernBERT-large-zeroshot-v2.0-ONNX";

type ZeroShotClassifier = (text: string, labels: string[], options: { multi_label: boolean }) => Promise<{
  labels: string[];
  scores: number[];
}>;

let debertaPipelineCache: ZeroShotClassifier | null = null;
let modernBertPipelineCache: ZeroShotClassifier | null = null;
let debertaLoading = false;
let modernBertLoading = false;

async function getDebertaPipeline(): Promise<ZeroShotClassifier> {
  if (debertaPipelineCache) return debertaPipelineCache;
  
  if (!debertaLoading) {
    debertaLoading = true;
    try {
      debertaPipelineCache = (await pipeline("zero-shot-classification", DEBERTA_MODEL_ID, {
        device: "cpu",
      })) as ZeroShotClassifier;
    } finally {
      debertaLoading = false;
    }
  } else {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (debertaLoading) await new Promise((r) => setTimeout(r, 100));
  }
  
  const cache = debertaPipelineCache;
  if (!cache) throw new Error("Failed to load DeBERTa pipeline");
  return cache;
}

async function getModernBertPipeline(): Promise<ZeroShotClassifier> {
  if (modernBertPipelineCache) return modernBertPipelineCache;
  
  if (!modernBertLoading) {
    modernBertLoading = true;
    try {
      modernBertPipelineCache = (await pipeline("zero-shot-classification", MODERNBERT_MODEL_ID, {
        device: "cpu",
      })) as ZeroShotClassifier;
    } finally {
      modernBertLoading = false;
    }
  } else {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (modernBertLoading) await new Promise((r) => setTimeout(r, 100));
  }
  
  const cache = modernBertPipelineCache;
  if (!cache) throw new Error("Failed to load ModernBERT pipeline");
  return cache;
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
  rawOutput?: { label: string; score: number }[];
  isTrueZeroShot: boolean;
}

async function debeNli(text: string): Promise<ClassifierResult> {
  const labels = [...CANONICAL_ROUTING_TAGS];

  const classifier = await getDebertaPipeline();

  const raw = await classifier(text, labels, { multi_label: true });

  const rawLabels = raw.labels;
  const rawScores = raw.scores;

  const tagScores: ClassifierTagScore[] = rawLabels.map((label, i) => {
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const score = rawScores[i] || 0;
    const tag = label as CanonicalRoutingTag;
    return {
      tag: CANONICAL_ROUTING_TAGS.includes(tag) ? tag : (label as CanonicalRoutingTag),
      score,
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      definition: ROUTING_TAG_DEFINITIONS[tag] ?? "",
    };
  });

  tagScores.sort((a, b) => b.score - a.score);

  return {
    modelId: DEBERTA_MODEL_ID,
    modelName: "DeBERTa-v3-large (NLI zero-shot)",
    tagScores,
    primaryTags: tagScores.slice(0, 3),
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    rawOutput: rawLabels.map((label, i) => ({ label, score: rawScores[i] || 0 })),
    isTrueZeroShot: true,
  };
}

async function modernBertTc(text: string): Promise<ClassifierResult> {
  const labels = [...CANONICAL_ROUTING_TAGS];

  const classifier = await getModernBertPipeline();

  const raw = await classifier(text, labels, {
    multi_label: true,
  });

  const rawLabels = raw.labels;
  const rawScores = raw.scores;

  const tagScores: ClassifierTagScore[] = rawLabels.map((label, i) => {
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const score = rawScores[i] || 0;
    const tag = label as CanonicalRoutingTag;
    return {
      tag: CANONICAL_ROUTING_TAGS.includes(tag) ? tag : (label as CanonicalRoutingTag),
      score,
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      definition: ROUTING_TAG_DEFINITIONS[tag] ?? "",
    };
  });

  tagScores.sort((a, b) => b.score - a.score);

  return {
    modelId: MODERNBERT_MODEL_ID,
    modelName: "ModernBERT-large (zero-shot)",
    tagScores,
    primaryTags: tagScores.slice(0, 3),
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    rawOutput: rawLabels.map((label, i) => ({ label, score: rawScores[i] || 0 })),
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
  agreementTags: {
    tag: CanonicalRoutingTag;
    debertaScore: number;
    modernBertScore: number;
    agreed: boolean;
  }[];
  disagreementTags: {
    tag: CanonicalRoutingTag;
    debertaScore: number;
    modernBertScore: number;
  }[];
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
    debeNli(inputText).catch(() => null),
    modernBertTc(inputText).catch(() => null),
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
