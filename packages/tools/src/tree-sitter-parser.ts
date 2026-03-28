/**
 * Shared tree-sitter parser factory with lazy WASM loading.
 *
 * Supports multiple languages via a per-language singleton cache.
 * Gracefully degrades to null if WASM is unavailable (e.g. in some bundlers
 * or when language grammar is missing).
 *
 * Bun compatibility: uses import.meta.url for ESM-compatible WASM path resolution.
 */

import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { dirname } from "node:path";

export interface TreeSitterLike {
  parse(source: string): { rootNode: TSNode };
}

export interface TSNode {
  type: string;
  text: string;
  children: TSNode[];
  childCount: number;
  startIndex: number;
  endIndex: number;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
}

interface ParserFactory {
  parser: TreeSitterLike;
  language: string;
}

// Per-language singleton cache
const parserFactoryCache = new Map<string, Promise<ParserFactory | null>>();

/**
 * Resolve the WASM file path for a tree-sitter language grammar.
 * Uses import.meta.url for ESM compatibility; falls back to createRequire for CJS.
 */
function resolveWasmPath(grammarPackage: string, wasmFile: string): string {
  // Bun-compatible: use import.meta.url + fileURLToPath
  try {
    const importMetaUrl = import.meta.url;
    if (importMetaUrl) {
      const currentFilePath = fileURLToPath(importMetaUrl);
      const currentDir = dirname(currentFilePath);
      const require = createRequire(currentDir);
      return require.resolve(`${grammarPackage}/${wasmFile}`);
    }
  } catch {
    // Fall through to createRequire
  }

  const importMetaUrl = import.meta.url;
  const require = createRequire(importMetaUrl);
  return require.resolve(`${grammarPackage}/${wasmFile}`);
}

/**
 * Get a lazy-singleton tree-sitter parser for the given language.
 *
 * @param language  - tree-sitter language name (e.g. "typescript", "bash")
 * @param grammarPackage  - npm package that ships the WASM grammar
 * @param wasmFile  - path to the .wasm file inside the grammar package
 *
 * Returns null if WASM loading fails (graceful degradation).
 */
export async function getParserFactory(
  language: string,
  grammarPackage: string,
  wasmFile: string,
): Promise<TreeSitterLike | null> {
  const cacheKey = `${language}:${grammarPackage}`;

  if (!parserFactoryCache.has(cacheKey)) {
    const promise = (async (): Promise<ParserFactory | null> => {
      try {
        const TreeSitter = await import("web-tree-sitter");
        const wasmPath = resolveWasmPath(grammarPackage, wasmFile);

        await TreeSitter.Parser.init();
        const Language = await TreeSitter.Language.load(wasmPath);

        const parser = new TreeSitter.Parser();
        parser.setLanguage(Language);

        return {
          parser: parser as unknown as TreeSitterLike,
          language,
        };
      } catch {
        return null;
      }
    })();

    parserFactoryCache.set(cacheKey, promise);
  }

  const factory = await parserFactoryCache.get(cacheKey);
  return factory?.parser ?? null;
}

/**
 * Parse source code using a tree-sitter parser.
 */
export async function parseWithTreeSitter(
  source: string,
  language: string,
  grammarPackage: string,
  wasmFile: string,
): Promise<{ rootNode: TSNode } | null> {
  const parser = await getParserFactory(language, grammarPackage, wasmFile);
  if (!parser) return null;
  return parser.parse(source);
}

// Pre-configured language mappings
export const TREE_SITTER_LANGUAGES = {
  bash: {
    grammarPackage: "tree-sitter-bash",
    wasmFile: "tree-sitter-bash.wasm",
  },
} as const;

export type SupportedTreeSitterLanguage = keyof typeof TREE_SITTER_LANGUAGES;
