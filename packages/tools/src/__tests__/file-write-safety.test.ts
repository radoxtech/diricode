import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ToolError } from "@diricode/core";
import {
  type FileWriteSafetyConfig,
  runFileWriteSafetyCheck,
  checkSymlinkSafety,
} from "../file-safety.js";

const off: FileWriteSafetyConfig = { level: "off" };
const basic: FileWriteSafetyConfig = { level: "basic" };
const standard: FileWriteSafetyConfig = { level: "standard" };
const strict: FileWriteSafetyConfig = { level: "strict" };

describe("runFileWriteSafetyCheck", () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "diricode-safety-test-"));
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  describe("level: off", () => {
    it("allows writing to .git/", () => {
      expect(() => {
        runFileWriteSafetyCheck(join(workspace, ".git", "config"), workspace, off);
      }).not.toThrow();
    });

    it("allows writing outside workspace", () => {
      expect(() => {
        runFileWriteSafetyCheck("/etc/passwd", workspace, off);
      }).not.toThrow();
    });

    it("allows writing to node_modules/", () => {
      expect(() => {
        runFileWriteSafetyCheck(join(workspace, "node_modules", "pkg", "index.js"), workspace, off);
      }).not.toThrow();
    });
  });

  describe("hard-protected paths (.git)", () => {
    it("blocks .git/config in basic mode", () => {
      expect(() => {
        runFileWriteSafetyCheck(join(workspace, ".git", "config"), workspace, basic);
      }).toThrow(expect.objectContaining({ code: "PROTECTED_PATH" }) as ToolError);
    });

    it("blocks .git/config in standard mode", () => {
      expect(() => {
        runFileWriteSafetyCheck(join(workspace, ".git", "config"), workspace, standard);
      }).toThrow(expect.objectContaining({ code: "PROTECTED_PATH" }) as ToolError);
    });

    it("blocks .git/config in strict mode", () => {
      expect(() => {
        runFileWriteSafetyCheck(join(workspace, ".git", "config"), workspace, strict);
      }).toThrow(expect.objectContaining({ code: "PROTECTED_PATH" }) as ToolError);
    });

    it("blocks .git itself", () => {
      expect(() => {
        runFileWriteSafetyCheck(join(workspace, ".git"), workspace, basic);
      }).toThrow(expect.objectContaining({ code: "PROTECTED_PATH" }) as ToolError);
    });

    it("blocks nested .git/objects/pack/file", () => {
      expect(() => {
        runFileWriteSafetyCheck(
          join(workspace, ".git", "objects", "pack", "file"),
          workspace,
          standard,
        );
      }).toThrow(expect.objectContaining({ code: "PROTECTED_PATH" }) as ToolError);
    });

    it("cannot be overridden by allowlist", () => {
      const config: FileWriteSafetyConfig = {
        level: "standard",
        allowlist: [".git/", ".git"],
      };
      expect(() => {
        runFileWriteSafetyCheck(join(workspace, ".git", "config"), workspace, config);
      }).toThrow(expect.objectContaining({ code: "PROTECTED_PATH" }) as ToolError);
    });
  });

  describe("default-protected paths (node_modules)", () => {
    it("blocks node_modules/ in basic mode", () => {
      expect(() => {
        runFileWriteSafetyCheck(
          join(workspace, "node_modules", "pkg", "index.js"),
          workspace,
          basic,
        );
      }).toThrow(expect.objectContaining({ code: "PROTECTED_PATH" }) as ToolError);
    });

    it("blocks node_modules/ in standard mode", () => {
      expect(() => {
        runFileWriteSafetyCheck(
          join(workspace, "node_modules", "pkg", "index.js"),
          workspace,
          standard,
        );
      }).toThrow(expect.objectContaining({ code: "PROTECTED_PATH" }) as ToolError);
    });

    it("can be overridden by allowlist", () => {
      const config: FileWriteSafetyConfig = {
        level: "standard",
        allowlist: ["node_modules/"],
      };
      expect(() => {
        runFileWriteSafetyCheck(
          join(workspace, "node_modules", "pkg", "index.js"),
          workspace,
          config,
        );
      }).not.toThrow();
    });

    it("blocks node_modules itself", () => {
      expect(() => {
        runFileWriteSafetyCheck(join(workspace, "node_modules"), workspace, standard);
      }).toThrow(expect.objectContaining({ code: "PROTECTED_PATH" }) as ToolError);
    });
  });

  describe("workspace boundary", () => {
    it("allows path inside workspace at standard level", () => {
      expect(() => {
        runFileWriteSafetyCheck(join(workspace, "src", "index.ts"), workspace, standard);
      }).not.toThrow();
    });

    it("blocks path outside workspace at standard level", () => {
      expect(() => {
        runFileWriteSafetyCheck("/etc/passwd", workspace, standard);
      }).toThrow(expect.objectContaining({ code: "PATH_OUTSIDE_WORKSPACE" }) as ToolError);
    });

    it("blocks path traversal at standard level", () => {
      expect(() => {
        runFileWriteSafetyCheck(resolve(workspace, "../../../etc/passwd"), workspace, standard);
      }).toThrow(expect.objectContaining({ code: "PATH_OUTSIDE_WORKSPACE" }) as ToolError);
    });

    it("blocks path outside workspace at strict level", () => {
      expect(() => {
        runFileWriteSafetyCheck("/tmp/outside-file", workspace, strict);
      }).toThrow(expect.objectContaining({ code: "PATH_OUTSIDE_WORKSPACE" }) as ToolError);
    });

    it("does NOT enforce workspace boundary at basic level", () => {
      expect(() => {
        runFileWriteSafetyCheck("/etc/some-config", workspace, basic);
      }).not.toThrow();
    });
  });

  describe("blocklist", () => {
    it("blocks path matching blocklist pattern", () => {
      const config: FileWriteSafetyConfig = {
        level: "standard",
        blocklist: ["secrets/"],
      };
      expect(() => {
        runFileWriteSafetyCheck(join(workspace, "secrets", "api-key.txt"), workspace, config);
      }).toThrow(expect.objectContaining({ code: "BLOCKED_PATH" }) as ToolError);
    });

    it("blocks exact filename match in blocklist", () => {
      const config: FileWriteSafetyConfig = {
        level: "standard",
        blocklist: [".env"],
      };
      expect(() => {
        runFileWriteSafetyCheck(join(workspace, ".env"), workspace, config);
      }).toThrow(expect.objectContaining({ code: "BLOCKED_PATH" }) as ToolError);
    });

    it("allows paths not matching blocklist", () => {
      const config: FileWriteSafetyConfig = {
        level: "standard",
        blocklist: ["secrets/"],
      };
      expect(() => {
        runFileWriteSafetyCheck(join(workspace, "src", "index.ts"), workspace, config);
      }).not.toThrow();
    });

    it("blocklist is overridden by allowlist", () => {
      const config: FileWriteSafetyConfig = {
        level: "standard",
        blocklist: ["config/"],
        allowlist: ["config/"],
      };
      expect(() => {
        runFileWriteSafetyCheck(join(workspace, "config", "app.json"), workspace, config);
      }).not.toThrow();
    });

    it("blocklist is not checked at basic level", () => {
      const config: FileWriteSafetyConfig = {
        level: "basic",
        blocklist: ["secrets/"],
      };
      expect(() => {
        runFileWriteSafetyCheck(join(workspace, "secrets", "key.txt"), workspace, config);
      }).not.toThrow();
    });
  });

  describe("allowlist", () => {
    it("does not override hard-protected .git paths", () => {
      const config: FileWriteSafetyConfig = {
        level: "standard",
        allowlist: [".git/"],
      };
      expect(() => {
        runFileWriteSafetyCheck(join(workspace, ".git", "config"), workspace, config);
      }).toThrow(expect.objectContaining({ code: "PROTECTED_PATH" }) as ToolError);
    });

    it("overrides default-protected node_modules", () => {
      const config: FileWriteSafetyConfig = {
        level: "standard",
        allowlist: ["node_modules/"],
      };
      expect(() => {
        runFileWriteSafetyCheck(
          join(workspace, "node_modules", "pkg", "index.js"),
          workspace,
          config,
        );
      }).not.toThrow();
    });

    it("overrides blocklist for matching paths", () => {
      const config: FileWriteSafetyConfig = {
        level: "standard",
        blocklist: [".env"],
        allowlist: [".env"],
      };
      expect(() => {
        runFileWriteSafetyCheck(join(workspace, ".env"), workspace, config);
      }).not.toThrow();
    });
  });

  describe("ToolError structure", () => {
    it("thrown ToolError has correct code and is instanceof ToolError", () => {
      let caught: unknown;
      try {
        runFileWriteSafetyCheck(join(workspace, ".git", "config"), workspace, standard);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(ToolError);
      expect((caught as ToolError).code).toBe("PROTECTED_PATH");
      expect((caught as ToolError).message).toBeTruthy();
    });

    it("PATH_OUTSIDE_WORKSPACE error contains meaningful message", () => {
      let caught: unknown;
      try {
        runFileWriteSafetyCheck("/etc/passwd", workspace, standard);
      } catch (e) {
        caught = e;
      }
      expect((caught as ToolError).code).toBe("PATH_OUTSIDE_WORKSPACE");
      expect((caught as ToolError).message).toContain("outside workspace");
    });

    it("BLOCKED_PATH error contains the relative path", () => {
      const config: FileWriteSafetyConfig = {
        level: "standard",
        blocklist: ["secrets/"],
      };
      let caught: unknown;
      try {
        runFileWriteSafetyCheck(join(workspace, "secrets", "key.txt"), workspace, config);
      } catch (e) {
        caught = e;
      }
      expect((caught as ToolError).code).toBe("BLOCKED_PATH");
      expect((caught as ToolError).message).toContain("blocklist");
    });
  });
});

describe("checkSymlinkSafety", () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "diricode-symlink-test-"));
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it("does nothing at off level", async () => {
    await expect(checkSymlinkSafety("/etc/passwd", workspace, off)).resolves.toBeUndefined();
  });

  it("does nothing at basic level", async () => {
    await expect(checkSymlinkSafety("/etc/passwd", workspace, basic)).resolves.toBeUndefined();
  });

  it("does nothing at standard level", async () => {
    await expect(
      checkSymlinkSafety(join(workspace, "file.txt"), workspace, standard),
    ).resolves.toBeUndefined();
  });

  it("allows regular files at strict level", async () => {
    const filePath = join(workspace, "regular.txt");
    await writeFile(filePath, "content");
    await expect(checkSymlinkSafety(filePath, workspace, strict)).resolves.toBeUndefined();
  });

  it("allows symlinks pointing inside workspace at strict level", async () => {
    const target = join(workspace, "real.txt");
    await writeFile(target, "content");
    const link = join(workspace, "link.txt");
    await symlink(target, link);

    await expect(checkSymlinkSafety(link, workspace, strict)).resolves.toBeUndefined();
  });

  it("blocks symlinks pointing outside workspace at strict level", async () => {
    const outsideDir = await mkdtemp(join(tmpdir(), "diricode-outside-"));
    const outsideFile = join(outsideDir, "secret.txt");
    await writeFile(outsideFile, "secret");

    const link = join(workspace, "escape.txt");
    await symlink(outsideFile, link);

    await expect(checkSymlinkSafety(link, workspace, strict)).rejects.toMatchObject({
      code: "SYMLINK_TRAVERSAL",
    });

    await rm(outsideDir, { recursive: true, force: true });
  });

  it("blocks directory symlinks pointing outside workspace at strict level", async () => {
    const outsideDir = await mkdtemp(join(tmpdir(), "diricode-outside-"));

    const linkDir = join(workspace, "linked-dir");
    await symlink(outsideDir, linkDir);

    const filePath = join(linkDir, "file.txt");

    await expect(checkSymlinkSafety(filePath, workspace, strict)).rejects.toMatchObject({
      code: "SYMLINK_TRAVERSAL",
    });

    await rm(outsideDir, { recursive: true, force: true });
  });

  it("allows non-existent paths at strict level (no symlink to check)", async () => {
    const filePath = join(workspace, "nonexistent.txt");
    await expect(checkSymlinkSafety(filePath, workspace, strict)).resolves.toBeUndefined();
  });

  it("SYMLINK_TRAVERSAL error has meaningful message", async () => {
    const outsideDir = await mkdtemp(join(tmpdir(), "diricode-outside-"));
    const outsideFile = join(outsideDir, "secret.txt");
    await writeFile(outsideFile, "secret");

    const link = join(workspace, "evil-link.txt");
    await symlink(outsideFile, link);

    let caught: unknown;
    try {
      await checkSymlinkSafety(link, workspace, strict);
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(ToolError);
    expect((caught as ToolError).code).toBe("SYMLINK_TRAVERSAL");
    expect((caught as ToolError).message).toContain("outside workspace");

    await rm(outsideDir, { recursive: true, force: true });
  });
});
