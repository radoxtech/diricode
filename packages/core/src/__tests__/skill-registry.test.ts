import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SkillRegistry } from "../skills/registry.js";

function makeTempDir(): string {
  const dir = join(
    tmpdir(),
    `dc-skill-reg-${String(Date.now())}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

const VALID_SKILL_MD = `---
id: code-review
name: Code Review
description: Reviews code for quality and correctness
version: 1.0.0
family: reasoning
tags:
  - review
  - quality
---

# Code Review Skill

This skill helps review code.
`;

const MINIMAL_SKILL_MD = `---
id: web-research
name: Web Research
description: Searches the web for information
version: 2.0.0
family: web-research
---

Minimal skill without optional fields.
`;

describe("SkillRegistry", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("loadAll", () => {
    it("returns empty array when root directory does not exist", async () => {
      const registry = new SkillRegistry();
      const results = await registry.loadAll([join(tempDir, "nonexistent")]);
      expect(results).toEqual([]);
    });

    it("returns empty array when root directory is empty", async () => {
      const registry = new SkillRegistry();
      const results = await registry.loadAll([tempDir]);
      expect(results).toEqual([]);
    });

    it("loads a valid SKILL.md file", async () => {
      writeFileSync(join(tempDir, "SKILL.md"), VALID_SKILL_MD);

      const registry = new SkillRegistry();
      const results = await registry.loadAll([tempDir]);

      expect(results).toHaveLength(1);
      expect(results[0]!.success).toBe(true);
      if (results[0]!.success) {
        expect(results[0]!.manifest.id).toBe("code-review");
        expect(results[0]!.manifest.name).toBe("Code Review");
        expect(results[0]!.manifest.family).toBe("reasoning");
        expect(results[0]!.manifest.tags).toEqual(["review", "quality"]);
        expect(results[0]!.manifest.skillMdPath).toContain("SKILL.md");
      }
    });

    it("recursively discovers SKILL.md files in subdirectories", async () => {
      const subA = join(tempDir, "skills", "code-review");
      const subB = join(tempDir, "skills", "web-research");
      mkdirSync(subA, { recursive: true });
      mkdirSync(subB, { recursive: true });

      writeFileSync(join(subA, "SKILL.md"), VALID_SKILL_MD);
      writeFileSync(join(subB, "SKILL.md"), MINIMAL_SKILL_MD);

      const registry = new SkillRegistry();
      const results = await registry.loadAll([tempDir]);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);

      const ids = results
        .filter((r) => r.success)
        .map((r) => (r.success ? r.manifest.id : ""))
        .sort();
      expect(ids).toEqual(["code-review", "web-research"]);
    });

    it("returns a failure result for SKILL.md with no frontmatter", async () => {
      writeFileSync(join(tempDir, "SKILL.md"), "# No frontmatter here\n\nJust plain markdown.");

      const registry = new SkillRegistry();
      const results = await registry.loadAll([tempDir]);

      expect(results).toHaveLength(1);
      expect(results[0]!.success).toBe(false);
      if (!results[0]!.success) {
        expect(results[0]!.error).toContain("no YAML frontmatter found");
      }
    });

    it("returns a failure result for SKILL.md with invalid YAML", async () => {
      writeFileSync(join(tempDir, "SKILL.md"), "---\nid: [invalid: yaml: {\n---\n");

      const registry = new SkillRegistry();
      const results = await registry.loadAll([tempDir]);

      expect(results).toHaveLength(1);
      expect(results[0]!.success).toBe(false);
      if (!results[0]!.success) {
        expect(results[0]!.error).toContain("YAML parse error");
      }
    });

    it("returns a failure result for SKILL.md with schema violations", async () => {
      writeFileSync(
        join(tempDir, "SKILL.md"),
        `---
id: bad-skill
name: Bad Skill
description: Missing required fields
version: not-semver
family: unknown-family
---
`,
      );

      const registry = new SkillRegistry();
      const results = await registry.loadAll([tempDir]);

      expect(results).toHaveLength(1);
      expect(results[0]!.success).toBe(false);
      if (!results[0]!.success) {
        expect(results[0]!.error).toContain("schema validation failed");
      }
    });

    it("collects mixed success/failure results", async () => {
      const subA = join(tempDir, "good");
      const subB = join(tempDir, "bad");
      mkdirSync(subA, { recursive: true });
      mkdirSync(subB, { recursive: true });

      writeFileSync(join(subA, "SKILL.md"), VALID_SKILL_MD);
      writeFileSync(join(subB, "SKILL.md"), "no frontmatter");

      const registry = new SkillRegistry();
      const results = await registry.loadAll([tempDir]);

      expect(results).toHaveLength(2);
      const successes = results.filter((r) => r.success);
      const failures = results.filter((r) => !r.success);
      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
    });

    it("clears previous manifests on second loadAll call", async () => {
      writeFileSync(join(tempDir, "SKILL.md"), VALID_SKILL_MD);

      const registry = new SkillRegistry();
      await registry.loadAll([tempDir]);
      expect(registry.getAll()).toHaveLength(1);

      await registry.loadAll([]);
      expect(registry.getAll()).toHaveLength(0);
    });

    it("loads skills from multiple root directories", async () => {
      const rootA = join(tempDir, "dirA");
      const rootB = join(tempDir, "dirB");
      mkdirSync(rootA, { recursive: true });
      mkdirSync(rootB, { recursive: true });

      writeFileSync(join(rootA, "SKILL.md"), VALID_SKILL_MD);
      writeFileSync(join(rootB, "SKILL.md"), MINIMAL_SKILL_MD);

      const registry = new SkillRegistry();
      const results = await registry.loadAll([rootA, rootB]);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);
    });

    it("sets diskPath to the skill directory (parent of SKILL.md)", async () => {
      writeFileSync(join(tempDir, "SKILL.md"), VALID_SKILL_MD);

      const registry = new SkillRegistry();
      await registry.loadAll([tempDir]);

      const manifest = registry.getById("code-review");
      expect(manifest).toBeDefined();
      expect(manifest!.diskPath).toBe(tempDir);
    });
  });

  describe("getAll", () => {
    it("returns empty array before loadAll is called", () => {
      const registry = new SkillRegistry();
      expect(registry.getAll()).toEqual([]);
    });

    it("returns all successfully loaded manifests", async () => {
      const subA = join(tempDir, "a");
      const subB = join(tempDir, "b");
      mkdirSync(subA, { recursive: true });
      mkdirSync(subB, { recursive: true });
      writeFileSync(join(subA, "SKILL.md"), VALID_SKILL_MD);
      writeFileSync(join(subB, "SKILL.md"), MINIMAL_SKILL_MD);

      const registry = new SkillRegistry();
      await registry.loadAll([tempDir]);

      expect(registry.getAll()).toHaveLength(2);
    });
  });

  describe("getById", () => {
    it("returns undefined for unknown id", async () => {
      const registry = new SkillRegistry();
      await registry.loadAll([tempDir]);
      expect(registry.getById("nonexistent")).toBeUndefined();
    });

    it("returns the correct manifest by id", async () => {
      writeFileSync(join(tempDir, "SKILL.md"), VALID_SKILL_MD);
      const registry = new SkillRegistry();
      await registry.loadAll([tempDir]);

      const manifest = registry.getById("code-review");
      expect(manifest).toBeDefined();
      expect(manifest!.id).toBe("code-review");
    });
  });

  describe("findByTags", () => {
    it("returns empty array for empty tags input", async () => {
      writeFileSync(join(tempDir, "SKILL.md"), VALID_SKILL_MD);
      const registry = new SkillRegistry();
      await registry.loadAll([tempDir]);
      expect(registry.findByTags([])).toEqual([]);
    });

    it("finds skills that have at least one matching tag", async () => {
      const subA = join(tempDir, "a");
      const subB = join(tempDir, "b");
      mkdirSync(subA, { recursive: true });
      mkdirSync(subB, { recursive: true });
      writeFileSync(join(subA, "SKILL.md"), VALID_SKILL_MD);
      writeFileSync(join(subB, "SKILL.md"), MINIMAL_SKILL_MD);

      const registry = new SkillRegistry();
      await registry.loadAll([tempDir]);

      const results = registry.findByTags(["review"]);
      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe("code-review");
    });
  });

  describe("findByFamily", () => {
    it("returns only skills of the specified family", async () => {
      const subA = join(tempDir, "a");
      const subB = join(tempDir, "b");
      mkdirSync(subA, { recursive: true });
      mkdirSync(subB, { recursive: true });
      writeFileSync(join(subA, "SKILL.md"), VALID_SKILL_MD);
      writeFileSync(join(subB, "SKILL.md"), MINIMAL_SKILL_MD);

      const registry = new SkillRegistry();
      await registry.loadAll([tempDir]);

      const reasoning = registry.findByFamily("reasoning");
      expect(reasoning).toHaveLength(1);
      expect(reasoning[0]!.id).toBe("code-review");

      const webResearch = registry.findByFamily("web-research");
      expect(webResearch).toHaveLength(1);
      expect(webResearch[0]!.id).toBe("web-research");
    });
  });
});
