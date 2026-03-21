import { describe, expect, it, beforeAll } from "vitest";
import { runSafetyCheck, runSafetyCheckAsync } from "../bash.js";
import type { BashSafetyConfig } from "../bash.js";
import { ToolError } from "@diricode/core";

const WORKSPACE = "/home/user/project";

const off: BashSafetyConfig = { level: "off" };
const basic: BashSafetyConfig = { level: "basic" };
const standard: BashSafetyConfig = { level: "standard" };
const strict: BashSafetyConfig = { level: "strict" };

describe("runSafetyCheck — level: off", () => {
  it("allows any command including sudo", () => {
    expect(() => {
      runSafetyCheck("sudo rm -rf /", off);
    }).not.toThrow();
  });

  it("allows fork bomb pattern", () => {
    expect(() => {
      runSafetyCheck(":(){:|:&};:", off);
    }).not.toThrow();
  });

  it("allows dd writing to device", () => {
    expect(() => {
      runSafetyCheck("dd if=/dev/zero of=/dev/sda", off);
    }).not.toThrow();
  });
});

describe("runSafetyCheck — sudo block (basic/standard/strict)", () => {
  it("blocks sudo in basic mode", () => {
    expect(() => {
      runSafetyCheck("sudo apt-get install vim", basic);
    }).toThrow(expect.objectContaining({ code: "SUDO_NOT_ALLOWED" }) as ToolError);
  });

  it("blocks sudo in standard mode", () => {
    expect(() => {
      runSafetyCheck("sudo ls /", standard);
    }).toThrow(expect.objectContaining({ code: "SUDO_NOT_ALLOWED" }) as ToolError);
  });

  it("blocks sudo in strict mode", () => {
    expect(() => {
      runSafetyCheck("sudo cat /etc/passwd", strict);
    }).toThrow(expect.objectContaining({ code: "SUDO_NOT_ALLOWED" }) as ToolError);
  });

  it("blocks pseudosudo-like commands containing the word sudo", () => {
    expect(() => {
      runSafetyCheck("echo sudo", basic);
    }).toThrow(expect.objectContaining({ code: "SUDO_NOT_ALLOWED" }) as ToolError);
  });
});

describe("runSafetyCheck — dangerous command blocklist", () => {
  it("blocks rm -rf /", () => {
    expect(() => {
      runSafetyCheck("rm -rf /", basic);
    }).toThrow(expect.objectContaining({ code: "DANGEROUS_COMMAND" }) as ToolError);
  });

  it("blocks rm -fr /", () => {
    expect(() => {
      runSafetyCheck("rm -fr /", basic);
    }).toThrow(expect.objectContaining({ code: "DANGEROUS_COMMAND" }) as ToolError);
  });

  it("blocks rm -rf ~", () => {
    expect(() => {
      runSafetyCheck("rm -rf ~", basic);
    }).toThrow(expect.objectContaining({ code: "DANGEROUS_COMMAND" }) as ToolError);
  });

  it("blocks rm --no-preserve-root", () => {
    expect(() => {
      runSafetyCheck("rm --no-preserve-root -rf /", basic);
    }).toThrow(expect.objectContaining({ code: "DANGEROUS_COMMAND" }) as ToolError);
  });

  it("blocks dd writing to a block device", () => {
    expect(() => {
      runSafetyCheck("dd if=/dev/zero of=/dev/sda bs=512", basic);
    }).toThrow(expect.objectContaining({ code: "DANGEROUS_COMMAND" }) as ToolError);
  });

  it("blocks mkfs", () => {
    expect(() => {
      runSafetyCheck("mkfs.ext4 /dev/sdb1", basic);
    }).toThrow(expect.objectContaining({ code: "DANGEROUS_COMMAND" }) as ToolError);
  });

  it("blocks wipefs", () => {
    expect(() => {
      runSafetyCheck("wipefs -a /dev/sdb", basic);
    }).toThrow(expect.objectContaining({ code: "DANGEROUS_COMMAND" }) as ToolError);
  });

  it("blocks sgdisk -Z partition wipe", () => {
    expect(() => {
      runSafetyCheck("sgdisk -Z /dev/sda", basic);
    }).toThrow(expect.objectContaining({ code: "DANGEROUS_COMMAND" }) as ToolError);
  });

  it("blocks shred on a device", () => {
    expect(() => {
      runSafetyCheck("shred -v /dev/sda", basic);
    }).toThrow(expect.objectContaining({ code: "DANGEROUS_COMMAND" }) as ToolError);
  });

  it("blocks insmod", () => {
    expect(() => {
      runSafetyCheck("insmod evil.ko", basic);
    }).toThrow(expect.objectContaining({ code: "DANGEROUS_COMMAND" }) as ToolError);
  });

  it("blocks rmmod", () => {
    expect(() => {
      runSafetyCheck("rmmod ext4", basic);
    }).toThrow(expect.objectContaining({ code: "DANGEROUS_COMMAND" }) as ToolError);
  });

  it("blocks overwriting /etc/passwd", () => {
    expect(() => {
      runSafetyCheck("echo root:x:0:0 > /etc/passwd", basic);
    }).toThrow(expect.objectContaining({ code: "DANGEROUS_COMMAND" }) as ToolError);
  });

  it("blocks overwriting /etc/shadow", () => {
    expect(() => {
      runSafetyCheck("echo '' > /etc/shadow", basic);
    }).toThrow(expect.objectContaining({ code: "DANGEROUS_COMMAND" }) as ToolError);
  });

  it("allows safe rm commands", () => {
    expect(() => {
      runSafetyCheck("rm -rf /home/user/project/dist", basic);
    }).not.toThrow();
  });

  it("allows dd reading from a device (no of=/dev/)", () => {
    expect(() => {
      runSafetyCheck("dd if=/dev/urandom of=/tmp/random bs=1k count=10", basic);
    }).not.toThrow();
  });

  it("allows ls /", () => {
    expect(() => {
      runSafetyCheck("ls /", basic);
    }).not.toThrow();
  });

  it("allows cat /etc/hostname", () => {
    expect(() => {
      runSafetyCheck("cat /etc/hostname", basic);
    }).not.toThrow();
  });
});

describe("runSafetyCheck — path restriction (standard)", () => {
  it("blocks path outside workspace root", () => {
    expect(() => {
      runSafetyCheck("cat /etc/secret.conf", standard, WORKSPACE);
    }).toThrow(expect.objectContaining({ code: "PATH_OUTSIDE_WORKSPACE" }) as ToolError);
  });

  it("blocks path traversal to root", () => {
    expect(() => {
      runSafetyCheck("ls /root", standard, WORKSPACE);
    }).toThrow(expect.objectContaining({ code: "PATH_OUTSIDE_WORKSPACE" }) as ToolError);
  });

  it("allows path inside workspace root", () => {
    expect(() => {
      runSafetyCheck(`cat ${WORKSPACE}/src/index.ts`, standard, WORKSPACE);
    }).not.toThrow();
  });

  it("allows /tmp paths", () => {
    expect(() => {
      runSafetyCheck("ls /tmp/somefile", standard, WORKSPACE);
    }).not.toThrow();
  });

  it("allows /var/tmp paths", () => {
    expect(() => {
      runSafetyCheck("cat /var/tmp/build.log", standard, WORKSPACE);
    }).not.toThrow();
  });

  it("allows /dev/null", () => {
    expect(() => {
      runSafetyCheck("ls > /dev/null", standard, WORKSPACE);
    }).not.toThrow();
  });

  it("allows /usr/bin/env paths", () => {
    expect(() => {
      runSafetyCheck("/usr/bin/env node --version", standard, WORKSPACE);
    }).not.toThrow();
  });

  it("allows commands without paths when no workspaceRoot provided", () => {
    expect(() => {
      runSafetyCheck("cat /etc/secret.conf", standard);
    }).not.toThrow();
  });

  it("does not fire path check in basic mode", () => {
    expect(() => {
      runSafetyCheck("cat /etc/secret.conf", basic, WORKSPACE);
    }).not.toThrow();
  });
});

describe("runSafetyCheckAsync — strict mode with tree-sitter AST", () => {
  beforeAll(async () => {
    await runSafetyCheckAsync("echo warmup", strict, WORKSPACE).catch(() => {
      /* warmup */
    });
  }, 30_000);

  it("allows a safe echo command", async () => {
    await expect(
      runSafetyCheckAsync("echo hello world", strict, WORKSPACE),
    ).resolves.toBeUndefined();
  });

  it("blocks sudo via sync check before AST", async () => {
    await expect(runSafetyCheckAsync("sudo ls", strict, WORKSPACE)).rejects.toMatchObject({
      code: "SUDO_NOT_ALLOWED",
    });
  });

  it("blocks mkfs via AST node type check", async () => {
    await expect(
      runSafetyCheckAsync("mkfs.ext4 /dev/sdb1", strict, WORKSPACE),
    ).rejects.toMatchObject({
      code: "DANGEROUS_COMMAND",
    });
  });

  it("blocks rm --no-preserve-root via AST", async () => {
    await expect(
      runSafetyCheckAsync("rm --no-preserve-root -rf /", strict, WORKSPACE),
    ).rejects.toMatchObject({ code: "DANGEROUS_COMMAND" });
  });

  it("blocks path outside workspace in strict mode", async () => {
    await expect(runSafetyCheckAsync("cat /etc/passwd", strict, WORKSPACE)).rejects.toMatchObject({
      code: "PATH_OUTSIDE_WORKSPACE",
    });
  });

  it("allows multi-command pipeline", async () => {
    await expect(
      runSafetyCheckAsync(`ls ${WORKSPACE}/src | grep '.ts'`, strict, WORKSPACE),
    ).resolves.toBeUndefined();
  });

  it("level off bypasses everything asynchronously", async () => {
    await expect(runSafetyCheckAsync("sudo rm -rf /", off)).resolves.toBeUndefined();
  });
});

describe("ToolError structure", () => {
  it("thrown ToolError has correct code and is instanceof ToolError", () => {
    let caught: unknown;
    try {
      runSafetyCheck("sudo ls", basic);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ToolError);
    expect((caught as ToolError).code).toBe("SUDO_NOT_ALLOWED");
    expect((caught as ToolError).message).toBeTruthy();
  });

  it("DANGEROUS_COMMAND error contains meaningful message", () => {
    let caught: unknown;
    try {
      runSafetyCheck("mkfs.ext4 /dev/sdb", basic);
    } catch (e) {
      caught = e;
    }
    expect((caught as ToolError).code).toBe("DANGEROUS_COMMAND");
    expect((caught as ToolError).message).toContain("mkfs");
  });

  it("PATH_OUTSIDE_WORKSPACE error contains the offending path", () => {
    let caught: unknown;
    try {
      runSafetyCheck("cat /etc/secret.conf", standard, WORKSPACE);
    } catch (e) {
      caught = e;
    }
    expect((caught as ToolError).code).toBe("PATH_OUTSIDE_WORKSPACE");
    expect((caught as ToolError).message).toContain("/etc/secret.conf");
  });
});
