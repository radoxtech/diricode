import type { ModelFamily } from "./types.js";

export interface NormalizationResult {
  family: string;
  canonicalFamily?: ModelFamily;
  stability: "stable" | "preview";
}

const PREVIEW_PATTERNS = [/preview/i, /beta/i, /alpha/i, /experimental/i, /^o[1-9]-/i];

const FAMILY_RULES: { pattern: RegExp; family: ModelFamily }[] = [
  // Claude
  { pattern: /^claude-3-opus|^claude-4-opus|^claude-opus/i, family: "claude-opus" },
  { pattern: /^claude-3.5-sonnet|^claude-4-sonnet|^claude-sonnet/i, family: "claude-sonnet" },
  { pattern: /^claude-3-haiku|^claude-4-haiku|^claude-haiku/i, family: "claude-haiku" },

  // Gemini
  { pattern: /^gemini-2.5-pro|^gemini-pro/i, family: "gemini-pro" },
  { pattern: /^gemini-2.5-flash|^gemini-flash/i, family: "gemini-flash" },
  { pattern: /^gemini-1.5-flash-lite|^gemini-flash-lite/i, family: "gemini-flash-lite" },

  // GPT — reasoning line (o-series)
  { pattern: /^o1|^o2|^o3|^o4/i, family: "gpt-reasoning" },
  { pattern: /^gpt-o1/i, family: "gpt-reasoning" },

  // GPT — standard line
  { pattern: /^gpt-4o(?!-mini)|^gpt-4-turbo/i, family: "gpt-standard" },

  // GPT — mini line
  { pattern: /^gpt-4o-mini|^gpt-3.5-turbo/i, family: "gpt-mini" },

  // GPT — nano line
  { pattern: /^gpt-4o-nano|^gpt-4-nano/i, family: "gpt-nano" },
];

export function normalizeModelFamily(modelId: string): NormalizationResult {
  const lower = modelId.toLowerCase();

  const isPreview = PREVIEW_PATTERNS.some((pattern) => pattern.test(lower));

  for (const { pattern, family } of FAMILY_RULES) {
    if (pattern.test(lower)) {
      return { family, canonicalFamily: family, stability: isPreview ? "preview" : "stable" };
    }
  }

  return { family: lower, stability: isPreview ? "preview" : "stable" };
}
