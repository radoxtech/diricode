import { readFile } from "node:fs/promises";
import { normalize, resolve } from "node:path";
import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "@diricode/core";
import { ToolError } from "@diricode/core";
import { getParserFactory, TREE_SITTER_LANGUAGES, type TSNode } from "./tree-sitter-parser.js";

export const TREE_SITTER_PARSE_LANGUAGES = [
  "bash",
  "typescript",
  "javascript",
  "tsx",
  "jsx",
  "python",
  "rust",
  "go",
  "java",
  "html",
  "css",
  "json",
  "yaml",
  "markdown",
] as const;

const parametersSchema = z.object({
  code: z.string().optional(),
  file: z.string().optional(),
  language: z
    .enum(TREE_SITTER_PARSE_LANGUAGES as unknown as [string, ...string[]])
    .default("typescript"),
  includeSymbols: z.boolean().default(true),
  maxTreeDepth: z.number().int().min(1).max(50).default(20),
});

type TreeSitterParseParams = z.infer<typeof parametersSchema>;

export interface TreeSitterSymbolInfo {
  name: string;
  kind: string;
  nodeType: string;
  location: { startLine: number; startColumn: number; endLine: number; endColumn: number };
  children: TreeSitterSymbolInfo[];
}

export interface TreeSitterParseResult {
  symbols: TreeSitterSymbolInfo[];
  tree: string | null;
  language: string;
  parserAvailable: boolean;
}

function flattenNode(node: TSNode): TSNode {
  return {
    type: node.type,
    text: node.text,
    children: node.children.map(flattenNode),
    childCount: node.childCount,
    startIndex: node.startIndex,
    endIndex: node.endIndex,
    startPosition: node.startPosition,
    endPosition: node.endPosition,
  };
}

function symbolToKind(type: string): string {
  switch (type) {
    case "function_declaration":
    case "function_definition":
    case "method_definition":
    case "arrow_function":
    case "lambda":
      return "function";
    case "class_declaration":
    case "class_definition":
    case "interface":
      return "class";
    case "variable_declaration":
    case "variable_declarator":
    case "const_declaration":
      return "variable";
    case "identifier":
      return "identifier";
    case "string":
    case "number":
    case "boolean":
      return "literal";
    default:
      return type;
  }
}

const DECLARATION_TYPES = new Set([
  "function_declaration",
  "function_definition",
  "method_definition",
  "arrow_function",
  "lambda",
  "class_declaration",
  "class_definition",
  "interface_declaration",
  "variable_declaration",
  "variable_declarator",
  "const_declaration",
  "let_declaration",
  "type_alias",
  "type_declaration",
  "enum_declaration",
  "import_declaration",
  "export_declaration",
]);

function extractSymbols(node: TSNode, depth = 0, maxDepth = 20): TreeSitterSymbolInfo[] {
  if (depth > maxDepth) return [];

  const symbols: TreeSitterSymbolInfo[] = [];

  if (DECLARATION_TYPES.has(node.type)) {
    const nameNode = findNameNode(node);
    const name = nameNode?.text ?? `<${node.type}>`;

    symbols.push({
      name,
      kind: symbolToKind(node.type),
      nodeType: node.type,
      location: {
        startLine: node.startPosition.row + 1,
        startColumn: node.startPosition.column,
        endLine: node.endPosition.row + 1,
        endColumn: node.endPosition.column,
      },
      children: [],
    });
  }

  for (const child of node.children) {
    symbols.push(...extractSymbols(child, depth + 1, maxDepth));
  }

  return symbols;
}

function findNameNode(node: TSNode): TSNode | null {
  const nameFields = ["declarator", "name", "identifier", "function"];
  for (const field of nameFields) {
    if ("children" in node) {
      const found = node.children.find((c) => c.type === field || c.type === "identifier");
      if (found) return found;
    }
  }
  if (node.type === "identifier") return node;
  return null;
}

export const treeSitterParseTool: Tool<TreeSitterParseParams, TreeSitterParseResult> = {
  name: "tree-sitter-parse",
  description:
    "Parse source code into an AST using tree-sitter and extract symbol information. " +
    "Supports multiple languages with WASM-based parsers. Falls back gracefully if parser unavailable.",
  parameters: parametersSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  async execute(
    params: TreeSitterParseParams,
    context: ToolContext,
  ): Promise<ToolResult<TreeSitterParseResult>> {
    context.emit("tool.start", { tool: "tree-sitter-parse", params });

    if (!params.code && !params.file) {
      throw new ToolError("MISSING_INPUT", "Either 'code' or 'file' must be provided");
    }

    let sourceCode: string;

    if (params.code) {
      sourceCode = params.code;
    } else if (params.file) {
      const normalizedRoot = resolve(context.workspaceRoot);
      const resolvedPath = resolve(normalizedRoot, normalize(params.file));

      if (!resolvedPath.startsWith(normalizedRoot + "/") && resolvedPath !== normalizedRoot) {
        throw new ToolError(
          "PATH_OUTSIDE_WORKSPACE",
          `Path "${params.file}" resolves outside workspace root`,
        );
      }

      try {
        sourceCode = await readFile(resolvedPath, "utf-8");
      } catch {
        throw new ToolError("FILE_READ_ERROR", `Could not read file "${params.file}"`);
      }
    } else {
      throw new ToolError("MISSING_INPUT", "Either 'code' or 'file' must be provided");
    }

    const langConfig = TREE_SITTER_LANGUAGES[params.language as keyof typeof TREE_SITTER_LANGUAGES];
    const { grammarPackage, wasmFile } = langConfig;
    const parsed = await getParserFactory(params.language, grammarPackage, wasmFile);

    if (!parsed) {
      const result: TreeSitterParseResult = {
        symbols: [],
        tree: null,
        language: params.language,
        parserAvailable: false,
      };
      context.emit("tool.end", { tool: "tree-sitter-parse", ...result });
      return { success: true, data: result };
    }

    const tree = parsed.parse(sourceCode);
    const flatTree = flattenNode(tree.rootNode);

    const symbols = params.includeSymbols ? extractSymbols(flatTree, 0, params.maxTreeDepth) : [];

    const result: TreeSitterParseResult = {
      symbols,
      tree: flatTree.type,
      language: params.language,
      parserAvailable: true,
    };

    context.emit("tool.end", { tool: "tree-sitter-parse", ...result });
    return { success: true, data: result };
  },
};
