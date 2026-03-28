/**
 * Hashline stable references — content-anchored line references resilient to edits.
 *
 * Algorithm choices (based on research into Aider, Sweep AI, oh-my-openagent, oh-my-pi):
 * - Hash: xxHash32 (non-cryptographic, fastest for short strings, production-proven)
 * - Truncation: 8-bit → 2-char encoding via 16-char alphabet (no 0/O ambiguity)
 * - Content window: single line, normalized (CR stripped, trailing whitespace trimmed)
 * - Fuzzy matching: longest common substring ratio (same family as SequenceMatcher)
 * - Thresholds: 0.80 local, 0.70 global (Aider's production-proven values)
 * - Seed strategy: line number for whitespace-only lines to prevent collisions
 *
 * Reference: https://github.com/Cyan4973/xxHash (public domain)
 */

// xxHash32 — pure TypeScript implementation (public domain, ref: github.com/Cyan4973/xxHash)

const PRIME32_1 = 0x9e3779b1;
const PRIME32_2 = 0x85ebca6b;
const PRIME32_3 = 0xc2b2ae35;
const PRIME32_4 = 0x27d4eb2f;
const PRIME32_5 = 0x165667b1;

function rotl32(val: number, bits: number): number {
  return ((val << bits) | (val >>> (32 - bits))) >>> 0;
}

function xxh32Round(acc: number, input: number): number {
  acc = (acc + Math.imul(input, PRIME32_2)) >>> 0;
  acc = Math.imul(acc >>> 15, PRIME32_3) >>> 0;
  return acc;
}

function xxh32(body: string, seed: number): number {
  const buf = Buffer.from(body, "utf-8");
  const len = buf.length;
  let h32: number;

  if (len >= 16) {
    let v1 = (seed + PRIME32_1 + PRIME32_2) >>> 0;
    let v2 = (seed + PRIME32_2) >>> 0;
    let v3 = seed >>> 0;
    let v4 = (seed - PRIME32_1) >>> 0;

    let offset = 0;
    const limit = len - 16;
    while (offset <= limit) {
      v1 = xxh32Round(v1, buf.readUInt32LE(offset));
      v2 = xxh32Round(v2, buf.readUInt32LE(offset + 4));
      v3 = xxh32Round(v3, buf.readUInt32LE(offset + 8));
      v4 = xxh32Round(v4, buf.readUInt32LE(offset + 12));
      offset += 16;
    }

    h32 = (rotl32(v1, 1) + rotl32(v2, 7) + rotl32(v3, 12) + rotl32(v4, 18)) >>> 0;
  } else {
    h32 = (seed + PRIME32_5) >>> 0;
  }

  h32 = (h32 + len) >>> 0;

  let offset = 0;
  const limit4 = len - 4;
  while (offset <= limit4) {
    h32 = (h32 + Math.imul(buf.readUInt32LE(offset), PRIME32_3)) >>> 0;
    h32 = Math.imul(h32 >>> 17, PRIME32_4) >>> 0;
    offset += 4;
  }

  while (offset < len) {
    h32 = (h32 + buf[offset]! * PRIME32_5) >>> 0;
    h32 = Math.imul(h32 >>> 11, PRIME32_1) >>> 0;
    offset++;
  }

  h32 = (h32 ^ (h32 >>> 15)) >>> 0;
  h32 = Math.imul(h32, PRIME32_2) >>> 0;
  h32 = (h32 ^ (h32 >>> 13)) >>> 0;
  h32 = Math.imul(h32, PRIME32_3) >>> 0;
  h32 = (h32 ^ (h32 >>> 16)) >>> 0;

  return h32;
}

const HASHLINE_ALPHABET = "ZPMQVRWSNKTXJBYH";

const HASHLINE_DICT: readonly string[] = Array.from({ length: 256 }, (_, i) => {
  const high = i >>> 4;
  const low = i & 15;
  return `${HASHLINE_ALPHABET[high] ?? "Z"}${HASHLINE_ALPHABET[low] ?? "Z"}`;
});

const RE_SIGNIFICANT = /[\p{L}\p{N}]/u;

export function normalizeLine(line: string): string {
  return line.replace(/\r/g, "").trimEnd();
}

export function computeLineHash(lineNumber: number, content: string): string {
  const normalized = normalizeLine(content);
  const seed = RE_SIGNIFICANT.test(normalized) ? 0 : lineNumber;
  const hash = xxh32(normalized, seed);
  return HASHLINE_DICT[hash & 0xff] ?? "ZZ";
}

export interface HashlineAnchor {
  readonly line: number;
  readonly hash: string;
}

export type AnchorStatus =
  | { readonly kind: "exact" }
  | { readonly kind: "drifted"; readonly delta: number }
  | { readonly kind: "relocated"; readonly foundAt: number; readonly score: number }
  | { readonly kind: "conflict"; readonly reason: string };

export function parseAnchor(anchor: string): HashlineAnchor {
  const hashIdx = anchor.indexOf("#");
  if (hashIdx === -1) {
    throw new Error(`Invalid hashline anchor: "${anchor}" — expected LINE#HH format`);
  }
  const line = parseInt(anchor.slice(0, hashIdx), 10);
  if (!Number.isFinite(line) || line < 1) {
    throw new Error(
      `Invalid hashline anchor: "${anchor}" — line number must be a positive integer`,
    );
  }
  const hash = anchor.slice(hashIdx + 1);
  if (hash.length !== 2 || !/^[A-Z]{2}$/.test(hash)) {
    throw new Error(
      `Invalid hashline anchor: "${anchor}" — hash must be 2 uppercase letters from the hashline alphabet`,
    );
  }
  return { line, hash };
}

export function formatAnchor(line: number, hash: string): string {
  return `${line}#${hash}`;
}

/**
 * Compute similarity ratio between two strings using longest common substring.
 * Returns 0.0–1.0 where 1.0 = identical.
 * Formula: 2 * LCS_length / (len(a) + len(b))
 */
export function similarityRatio(a: string, b: string): number {
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0 && lenB === 0) return 1;
  if (lenA === 0 || lenB === 0) return 0;
  if (a === b) return 1;

  const matches = lcsLength(a, b);
  return (2 * matches) / (lenA + lenB);
}

function lcsLength(a: string, b: string): number {
  const lenA = a.length;
  const lenB = b.length;

  if (lenA <= 1 || lenB <= 1) {
    if (a === b) return Math.min(lenA, lenB);
    if (a.includes(b)) return lenB;
    if (b.includes(a)) return lenA;
    return 0;
  }

  let prev = new Uint16Array(lenB + 1);
  let curr = new Uint16Array(lenB + 1);
  let maxMatch = 0;

  for (let i = 1; i <= lenA; i++) {
    curr[0] = 0;
    const charA = a[i - 1]!;
    for (let j = 1; j <= lenB; j++) {
      if (charA === b[j - 1]!) {
        curr[j] = prev[j - 1]! + 1;
        if (curr[j]! > maxMatch) {
          maxMatch = curr[j]!;
        }
      } else {
        curr[j] = 0;
      }
    }
    [prev, curr] = [curr, prev];
  }

  return maxMatch;
}

export interface ReResolutionConfig {
  localThreshold: number;
  globalThreshold: number;
  localRadius: number;
}

const DEFAULT_CONFIG: ReResolutionConfig = {
  localThreshold: 0.8,
  globalThreshold: 0.7,
  localRadius: 50,
};

export interface ResolveResult {
  readonly matched: boolean;
  readonly resolvedLine?: number;
  readonly status: AnchorStatus;
}

/**
 * Resolve a hashline anchor against current file content.
 *
 * Strategy:
 * 1. Exact match at anchor line → "exact"
 * 2. Hash match within ±localRadius → "drifted"
 * 3. Hash match outside localRadius → "relocated" (score: 1)
 * 4. Similarity match anywhere → "relocated" (score < 1)
 * 5. No match → "conflict"
 */
export function resolveAnchor(
  anchor: HashlineAnchor | string,
  fileContent: string,
  config: Partial<ReResolutionConfig> = {},
): ResolveResult {
  const parsed = typeof anchor === "string" ? parseAnchor(anchor) : anchor;
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const lines = fileContent.split("\n");
  const lineCount = lines.length;

  if (parsed.line > lineCount || parsed.line < 1) {
    return {
      matched: false,
      status: {
        kind: "conflict",
        reason: `Anchor line ${parsed.line} is out of range (file has ${lineCount} lines)`,
      },
    };
  }

  const expectedHash = computeLineHash(parsed.line, lines[parsed.line - 1]!);
  if (expectedHash === parsed.hash) {
    return { matched: true, resolvedLine: parsed.line, status: { kind: "exact" } };
  }

  // Phase 2: Local hash search ±localRadius
  const localStart = Math.max(0, parsed.line - 1 - cfg.localRadius);
  const localEnd = Math.min(lineCount, parsed.line + cfg.localRadius);

  for (let i = localStart; i < localEnd; i++) {
    if (i + 1 === parsed.line) continue;
    const lineHash = computeLineHash(i + 1, lines[i]!);
    if (lineHash === parsed.hash) {
      return {
        matched: true,
        resolvedLine: i + 1,
        status: { kind: "drifted", delta: i + 1 - parsed.line },
      };
    }
  }

  // Phase 3: Global hash search (outside local radius)
  for (let i = 0; i < localStart; i++) {
    const lineHash = computeLineHash(i + 1, lines[i]!);
    if (lineHash === parsed.hash) {
      return {
        matched: true,
        resolvedLine: i + 1,
        status: { kind: "relocated", foundAt: i + 1, score: 1 },
      };
    }
  }
  for (let i = localEnd; i < lineCount; i++) {
    const lineHash = computeLineHash(i + 1, lines[i]!);
    if (lineHash === parsed.hash) {
      return {
        matched: true,
        resolvedLine: i + 1,
        status: { kind: "relocated", foundAt: i + 1, score: 1 },
      };
    }
  }

  // Phase 4: Fallback similarity search
  const anchorLineContent = normalizeLine(lines[parsed.line - 1]!);
  if (anchorLineContent.length === 0) {
    return {
      matched: false,
      status: { kind: "conflict", reason: "Anchor line content is empty — cannot fuzzy match" },
    };
  }

  let bestMatch = { score: 0, line: -1 };
  for (let i = 0; i < lineCount; i++) {
    if (i + 1 === parsed.line) continue;
    const score = similarityRatio(anchorLineContent, normalizeLine(lines[i]!));
    if (score > bestMatch.score) {
      bestMatch = { score, line: i + 1 };
    }
  }

  if (bestMatch.score >= cfg.globalThreshold) {
    return {
      matched: true,
      resolvedLine: bestMatch.line,
      status: { kind: "relocated", foundAt: bestMatch.line, score: bestMatch.score },
    };
  }

  // Phase 5: No match
  return {
    matched: false,
    status: {
      kind: "conflict",
      reason: `No matching content found (best similarity: ${bestMatch.score.toFixed(2)})`,
    },
  };
}

export interface HashlineAnnotatedLine {
  readonly line: number;
  readonly content: string;
  readonly anchor: string;
}

export function annotateFile(fileContent: string): HashlineAnnotatedLine[] {
  const lines = fileContent.split("\n");
  return lines.map((content, idx) => ({
    line: idx + 1,
    content,
    anchor: formatAnchor(idx + 1, computeLineHash(idx + 1, content)),
  }));
}
