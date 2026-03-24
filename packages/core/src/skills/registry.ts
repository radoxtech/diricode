import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import yaml from "js-yaml";
import { SkillDefinitionSchema } from "./types.js";
import type { SkillLoadResult, SkillManifest } from "./types.js";

export class SkillRegistry {
  private readonly manifests = new Map<string, SkillManifest>();

  loadAll(roots: string[]): Promise<SkillLoadResult[]> {
    this.manifests.clear();
    const results: SkillLoadResult[] = [];

    for (const root of roots) {
      const paths = collectSkillPaths(root);
      for (const skillMdPath of paths) {
        const result = loadSkillFromPath(skillMdPath);
        results.push(result);
        if (result.success) {
          this.manifests.set(result.manifest.id, result.manifest);
        }
      }
    }

    return Promise.resolve(results);
  }

  getAll(): SkillManifest[] {
    return Array.from(this.manifests.values());
  }

  getById(id: string): SkillManifest | undefined {
    return this.manifests.get(id);
  }

  findByTags(tags: string[]): SkillManifest[] {
    if (tags.length === 0) return [];
    const tagSet = new Set(tags);
    return this.getAll().filter((m) => m.tags.some((t) => tagSet.has(t)));
  }

  findByFamily(family: SkillManifest["family"]): SkillManifest[] {
    return this.getAll().filter((m) => m.family === family);
  }
}

function collectSkillPaths(dir: string): string[] {
  const paths: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const full = join(dir, entry);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        paths.push(...collectSkillPaths(full));
      } else if (entry === "SKILL.md") {
        paths.push(resolve(full));
      }
    }
  } catch {
    // root directory does not exist or is unreadable
  }
  return paths;
}

function loadSkillFromPath(skillMdPath: string): SkillLoadResult {
  let raw: string;
  try {
    raw = readFileSync(skillMdPath, "utf-8");
  } catch (err) {
    return {
      success: false,
      error: `Cannot read ${skillMdPath}: ${String(err)}`,
    };
  }

  const frontmatter = extractFrontmatter(raw);
  if (frontmatter === null) {
    return {
      success: false,
      error: `${skillMdPath}: no YAML frontmatter found (expected ---...--- block)`,
    };
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(frontmatter);
  } catch (err) {
    return {
      success: false,
      error: `${skillMdPath}: YAML parse error – ${String(err)}`,
    };
  }

  const result = SkillDefinitionSchema.safeParse(parsed);
  if (!result.success) {
    return {
      success: false,
      error: `${skillMdPath}: schema validation failed – ${result.error.message}`,
    };
  }

  const diskPath = resolve(skillMdPath, "..");
  const manifest: SkillManifest = {
    ...result.data,
    diskPath,
    skillMdPath,
  };

  return { success: true, manifest };
}

// State-machine: extracts YAML between the first pair of '---' delimiters.
// Returns null when no valid frontmatter block is found.
function extractFrontmatter(content: string): string | null {
  const lines = content.split("\n");
  let start = -1;
  let end = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trimEnd();
    if (line === "---") {
      if (start === -1) {
        start = i;
      } else {
        end = i;
        break;
      }
    }
  }

  if (start === -1 || end === -1) return null;

  return lines.slice(start + 1, end).join("\n");
}
