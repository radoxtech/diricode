import { describe, expect, it } from "vitest";
import { ToolError } from "@diricode/core";
import {
  type GitSafetyConfig,
  runGitSafetyCheck,
  validateGitCommand,
  getProtectedBranches,
  addProtectedBranch,
  removeProtectedBranch,
  DEFAULT_GIT_SAFETY_CONFIG,
} from "../git-safety.js";

const off: GitSafetyConfig = { level: "off" };
const basic: GitSafetyConfig = { level: "basic" };
const standard: GitSafetyConfig = { level: "standard" };
const strict: GitSafetyConfig = { level: "strict" };

describe("runGitSafetyCheck — level: off", () => {
  it("allows force push to main", () => {
    expect(() => {
      runGitSafetyCheck("git push origin main --force", off);
    }).not.toThrow();
  });

  it("allows git reset --hard", () => {
    expect(() => {
      runGitSafetyCheck("git reset --hard HEAD~1", off);
    }).not.toThrow();
  });
});

describe("runGitSafetyCheck — force push blocking", () => {
  it("blocks force push to main in basic mode", () => {
    expect(() => {
      runGitSafetyCheck("git push origin main --force", basic);
    }).toThrow(expect.objectContaining({ code: "FORCE_PUSH_BLOCKED" }) as ToolError);
  });

  it("blocks force push to main in standard mode", () => {
    expect(() => {
      runGitSafetyCheck("git push origin main --force", standard);
    }).toThrow(expect.objectContaining({ code: "FORCE_PUSH_BLOCKED" }) as ToolError);
  });

  it("blocks force push to main in strict mode", () => {
    expect(() => {
      runGitSafetyCheck("git push origin main --force", strict);
    }).toThrow(expect.objectContaining({ code: "FORCE_PUSH_BLOCKED" }) as ToolError);
  });

  it("blocks force push using -f shorthand", () => {
    expect(() => {
      runGitSafetyCheck("git push origin main -f", basic);
    }).toThrow(expect.objectContaining({ code: "FORCE_PUSH_BLOCKED" }) as ToolError);
  });

  it("blocks force push to master", () => {
    expect(() => {
      runGitSafetyCheck("git push origin master --force", basic);
    }).toThrow(expect.objectContaining({ code: "FORCE_PUSH_BLOCKED" }) as ToolError);
  });

  it("blocks force push to develop", () => {
    expect(() => {
      runGitSafetyCheck("git push origin develop --force", basic);
    }).toThrow(expect.objectContaining({ code: "FORCE_PUSH_BLOCKED" }) as ToolError);
  });

  it("blocks force push to production", () => {
    expect(() => {
      runGitSafetyCheck("git push origin production --force", basic);
    }).toThrow(expect.objectContaining({ code: "FORCE_PUSH_BLOCKED" }) as ToolError);
  });

  it("allows force push to feature branches", () => {
    expect(() => {
      runGitSafetyCheck("git push origin feature/my-branch --force", basic);
    }).not.toThrow();
  });

  it("allows force push to custom branches", () => {
    expect(() => {
      runGitSafetyCheck("git push origin my-branch --force", basic);
    }).not.toThrow();
  });

  it("allows regular push to protected branches", () => {
    expect(() => {
      runGitSafetyCheck("git push origin main", basic);
    }).not.toThrow();
  });

  it("blocks force push with force-with-lease to protected branches", () => {
    expect(() => {
      runGitSafetyCheck("git push origin main --force-with-lease", basic);
    }).toThrow(expect.objectContaining({ code: "FORCE_PUSH_BLOCKED" }) as ToolError);
  });
});

describe("runGitSafetyCheck — hard reset blocking", () => {
  it("blocks git reset --hard in basic mode", () => {
    expect(() => {
      runGitSafetyCheck("git reset --hard HEAD~1", basic);
    }).toThrow(expect.objectContaining({ code: "HARD_RESET_BLOCKED" }) as ToolError);
  });

  it("blocks git reset --hard in standard mode", () => {
    expect(() => {
      runGitSafetyCheck("git reset --hard HEAD~1", standard);
    }).toThrow(expect.objectContaining({ code: "HARD_RESET_BLOCKED" }) as ToolError);
  });

  it("blocks git reset --hard in strict mode", () => {
    expect(() => {
      runGitSafetyCheck("git reset --hard HEAD~1", strict);
    }).toThrow(expect.objectContaining({ code: "HARD_RESET_BLOCKED" }) as ToolError);
  });

  it("blocks git reset --hard to origin/main", () => {
    expect(() => {
      runGitSafetyCheck("git reset --hard origin/main", basic);
    }).toThrow(expect.objectContaining({ code: "HARD_RESET_BLOCKED" }) as ToolError);
  });

  it("allows git reset --soft", () => {
    expect(() => {
      runGitSafetyCheck("git reset --soft HEAD~1", basic);
    }).not.toThrow();
  });

  it("allows git reset --mixed", () => {
    expect(() => {
      runGitSafetyCheck("git reset --mixed HEAD~1", basic);
    }).not.toThrow();
  });

  it("allows git reset without --hard", () => {
    expect(() => {
      runGitSafetyCheck("git reset HEAD~1", basic);
    }).not.toThrow();
  });

  it("allows git reset when requireResetConfirmation is false", () => {
    const config: GitSafetyConfig = { level: "basic", requireResetConfirmation: false };
    expect(() => {
      runGitSafetyCheck("git reset --hard HEAD~1", config);
    }).not.toThrow();
  });
});

describe("runGitSafetyCheck — custom protected branches", () => {
  it("blocks force push to custom protected branch", () => {
    const config: GitSafetyConfig = {
      level: "basic",
      protectedBranches: ["main", "release/*"],
    };
    expect(() => {
      runGitSafetyCheck("git push origin release/v1.0.0 --force", config);
    }).toThrow(expect.objectContaining({ code: "FORCE_PUSH_BLOCKED" }) as ToolError);
  });

  it("allows force push to non-protected branch", () => {
    const config: GitSafetyConfig = {
      level: "basic",
      protectedBranches: ["main"],
    };
    expect(() => {
      runGitSafetyCheck("git push origin develop --force", config);
    }).not.toThrow();
  });

  it("supports multiple glob patterns", () => {
    const config: GitSafetyConfig = {
      level: "basic",
      protectedBranches: ["main", "release/*", "hotfix/*"],
    };
    expect(() => {
      runGitSafetyCheck("git push origin hotfix/urgent --force", config);
    }).toThrow(expect.objectContaining({ code: "FORCE_PUSH_BLOCKED" }) as ToolError);
  });
});

describe("validateGitCommand", () => {
  it("returns safe: true for safe commands", () => {
    const result = validateGitCommand("git status", basic);
    expect(result.safe).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("returns safe: false with reason for force push", () => {
    const result = validateGitCommand("git push origin main --force", basic);
    expect(result.safe).toBe(false);
    expect(result.code).toBe("FORCE_PUSH_BLOCKED");
    expect(result.reason).toContain("Force push");
  });

  it("returns safe: false with reason for hard reset", () => {
    const result = validateGitCommand("git reset --hard HEAD~1", basic);
    expect(result.safe).toBe(false);
    expect(result.code).toBe("HARD_RESET_BLOCKED");
    expect(result.reason).toContain("destructive");
  });
});

describe("getProtectedBranches", () => {
  it("returns default protected branches", () => {
    const branches = getProtectedBranches();
    expect(branches).toContain("main");
    expect(branches).toContain("master");
    expect(branches).toContain("develop");
    expect(branches).toContain("production");
  });

  it("returns custom protected branches from config", () => {
    const config: GitSafetyConfig = {
      level: "basic",
      protectedBranches: ["staging", "prod"],
    };
    const branches = getProtectedBranches(config);
    expect(branches).toContain("staging");
    expect(branches).toContain("prod");
    expect(branches).not.toContain("main");
  });
});

describe("addProtectedBranch", () => {
  it("adds a new protected branch", () => {
    const config = addProtectedBranch(DEFAULT_GIT_SAFETY_CONFIG, "staging");
    expect(config.protectedBranches).toContain("staging");
    expect(config.protectedBranches).toContain("main");
  });

  it("does not duplicate existing branches", () => {
    const config1 = addProtectedBranch(DEFAULT_GIT_SAFETY_CONFIG, "staging");
    const config2 = addProtectedBranch(config1, "staging");
    expect(config2.protectedBranches?.filter((b) => b === "staging").length).toBe(1);
  });
});

describe("removeProtectedBranch", () => {
  it("removes a protected branch", () => {
    const config = removeProtectedBranch(DEFAULT_GIT_SAFETY_CONFIG, "main");
    expect(config.protectedBranches).not.toContain("main");
    expect(config.protectedBranches).toContain("master");
  });

  it("handles removing non-existent branch gracefully", () => {
    const config = removeProtectedBranch(DEFAULT_GIT_SAFETY_CONFIG, "nonexistent");
    expect(config.protectedBranches).toContain("main");
  });
});

describe("ToolError structure", () => {
  it("thrown ToolError has correct code for force push", () => {
    let caught: unknown;
    try {
      runGitSafetyCheck("git push origin main --force", basic);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ToolError);
    expect((caught as ToolError).code).toBe("FORCE_PUSH_BLOCKED");
    expect((caught as ToolError).message).toContain("main");
  });

  it("thrown ToolError has correct code for hard reset", () => {
    let caught: unknown;
    try {
      runGitSafetyCheck("git reset --hard HEAD~1", basic);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ToolError);
    expect((caught as ToolError).code).toBe("HARD_RESET_BLOCKED");
    expect((caught as ToolError).message).toContain("destructive");
  });

  it("FORCE_PUSH_BLOCKED error contains branch name", () => {
    let caught: unknown;
    try {
      runGitSafetyCheck("git push origin production --force", basic);
    } catch (e) {
      caught = e;
    }
    expect((caught as ToolError).message).toContain("production");
    expect((caught as ToolError).message).toContain("protected");
  });
});
