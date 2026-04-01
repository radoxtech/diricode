import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { ToolError } from "@diricode/core";
import { runGitSafetyCheckAsync, type GitSafetyConfig } from "../git-safety.js";
import { execSync } from "node:child_process";

const off: GitSafetyConfig = { level: "off", scanCommitsForSecrets: false };
const standard: GitSafetyConfig = { level: "standard", scanCommitsForSecrets: true };

describe("runGitSafetyCheckAsync — secret scanning", () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "diricode-secret-test-"));

    execSync("git init -b main", { cwd: workspace });
    execSync("git config user.email 'test@test.com'", { cwd: workspace });
    execSync("git config user.name 'Test User'", { cwd: workspace });

    await writeFile(join(workspace, "initial.txt"), "initial");
    execSync("git add initial.txt", { cwd: workspace });
    execSync("git commit -m 'initial'", { cwd: workspace });
  });

  afterEach(() => {
    execSync(`rm -rf "${workspace}"`);
  });

  describe("level: off", () => {
    it("allows committing files with secrets when scanning is disabled", async () => {
      await writeFile(join(workspace, "secrets.txt"), "API_KEY=sk_live_1234567890abcdef");
      execSync("git add secrets.txt", { cwd: workspace });

      await expect(
        runGitSafetyCheckAsync("git commit -m 'add secrets'", off, workspace),
      ).resolves.toBeUndefined();
    });
  });

  describe(".env file detection", () => {
    it("blocks committing .env file", async () => {
      await writeFile(join(workspace, ".env"), "SECRET_KEY=mysecret");
      execSync("git add .env", { cwd: workspace });

      await expect(
        runGitSafetyCheckAsync("git commit -m 'add env'", standard, workspace),
      ).rejects.toMatchObject({ code: "ENV_FILE_COMMIT_BLOCKED" });
    });

    it("blocks committing .env.local file", async () => {
      await writeFile(join(workspace, ".env.local"), "SECRET_KEY=mysecret");
      execSync("git add .env.local", { cwd: workspace });

      await expect(
        runGitSafetyCheckAsync("git commit -m 'add env'", standard, workspace),
      ).rejects.toMatchObject({ code: "ENV_FILE_COMMIT_BLOCKED" });
    });

    it("blocks committing .env.production file", async () => {
      await writeFile(join(workspace, ".env.production"), "DATABASE_URL=postgres://...");
      execSync("git add .env.production", { cwd: workspace });

      await expect(
        runGitSafetyCheckAsync("git commit -m 'add env'", standard, workspace),
      ).rejects.toMatchObject({ code: "ENV_FILE_COMMIT_BLOCKED" });
    });

    it("blocks committing config.env file", async () => {
      await writeFile(join(workspace, "config.env"), "API_KEY=test");
      execSync("git add config.env", { cwd: workspace });

      await expect(
        runGitSafetyCheckAsync("git commit -m 'add env'", standard, workspace),
      ).rejects.toMatchObject({ code: "ENV_FILE_COMMIT_BLOCKED" });
    });

    it("allows committing .env.example", async () => {
      await writeFile(join(workspace, ".env.example"), "SECRET_KEY=your_key_here");
      execSync("git add .env.example", { cwd: workspace });

      await expect(
        runGitSafetyCheckAsync("git commit -m 'add example'", standard, workspace),
      ).resolves.toBeUndefined();
    });
  });

  describe("private key detection", () => {
    it("blocks committing RSA private key", async () => {
      const key = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAxgNSPM+TDyx...
-----END RSA PRIVATE KEY-----`;
      await writeFile(join(workspace, "key.pem"), key);
      execSync("git add key.pem", { cwd: workspace });

      await expect(
        runGitSafetyCheckAsync("git commit -m 'add key'", standard, workspace),
      ).rejects.toMatchObject({ code: "SECRETS_DETECTED" });
    });

    it("blocks committing OpenSSH private key", async () => {
      const key = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
-----END OPENSSH PRIVATE KEY-----`;
      await writeFile(join(workspace, "id_rsa"), key);
      execSync("git add id_rsa", { cwd: workspace });

      await expect(
        runGitSafetyCheckAsync("git commit -m 'add key'", standard, workspace),
      ).rejects.toMatchObject({ code: "SECRETS_DETECTED" });
    });

    it("blocks committing EC private key", async () => {
      const key = `-----BEGIN EC PRIVATE KEY-----
MHQCAQEEIBiJ...
-----END EC PRIVATE KEY-----`;
      await writeFile(join(workspace, "ec.key"), key);
      execSync("git add ec.key", { cwd: workspace });

      await expect(
        runGitSafetyCheckAsync("git commit -m 'add key'", standard, workspace),
      ).rejects.toMatchObject({ code: "SECRETS_DETECTED" });
    });
  });

  describe("API key detection", () => {
    it("blocks committing API key", async () => {
      await writeFile(
        join(workspace, "config.js"),
        `const API_KEY = "test_api_key_1234567890abcdef";`,
      );
      execSync("git add config.js", { cwd: workspace });

      await expect(
        runGitSafetyCheckAsync("git commit -m 'add config'", standard, workspace),
      ).rejects.toMatchObject({ code: "SECRETS_DETECTED" });
    });

    it("blocks committing api_key in config", async () => {
      await writeFile(
        join(workspace, "settings.json"),
        `{"api_key": "abcdef1234567890abcdef1234567890abcdef12"}`,
      );
      execSync("git add settings.json", { cwd: workspace });

      await expect(
        runGitSafetyCheckAsync("git commit -m 'add settings'", standard, workspace),
      ).rejects.toMatchObject({ code: "SECRETS_DETECTED" });
    });
  });

  describe("AWS credential detection", () => {
    it("blocks committing AWS access key ID", async () => {
      await writeFile(join(workspace, "aws.config"), `AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE`);
      execSync("git add aws.config", { cwd: workspace });

      await expect(
        runGitSafetyCheckAsync("git commit -m 'add aws config'", standard, workspace),
      ).rejects.toMatchObject({ code: "SECRETS_DETECTED" });
    });
  });

  describe("GitHub token detection", () => {
    it("blocks committing GitHub personal access token", async () => {
      await writeFile(join(workspace, "token.txt"), `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx1234`);
      execSync("git add token.txt", { cwd: workspace });

      await expect(
        runGitSafetyCheckAsync("git commit -m 'add token'", standard, workspace),
      ).rejects.toMatchObject({ code: "SECRETS_DETECTED" });
    });
  });

  describe("password detection", () => {
    it("blocks committing password in config", async () => {
      await writeFile(join(workspace, "db.config"), `password = "supersecretpassword123"`);
      execSync("git add db.config", { cwd: workspace });

      await expect(
        runGitSafetyCheckAsync("git commit -m 'add db config'", standard, workspace),
      ).rejects.toMatchObject({ code: "SECRETS_DETECTED" });
    });

    it("blocks committing pwd in config", async () => {
      await writeFile(join(workspace, "credentials.ini"), `pwd=mypassword12345`);
      execSync("git add credentials.ini", { cwd: workspace });

      await expect(
        runGitSafetyCheckAsync("git commit -m 'add credentials'", standard, workspace),
      ).rejects.toMatchObject({ code: "SECRETS_DETECTED" });
    });
  });

  describe("database connection string detection", () => {
    it("blocks committing MongoDB connection string with password", async () => {
      await writeFile(
        join(workspace, "db.url"),
        `mongodb://admin:secret123@mongodb.example.com:27017/mydb`,
      );
      execSync("git add db.url", { cwd: workspace });

      await expect(
        runGitSafetyCheckAsync("git commit -m 'add db url'", standard, workspace),
      ).rejects.toMatchObject({ code: "SECRETS_DETECTED" });
    });

    it("blocks committing Postgres connection string with password", async () => {
      await writeFile(
        join(workspace, "database.yml"),
        `postgresql://user:password123@localhost:5432/myapp`,
      );
      execSync("git add database.yml", { cwd: workspace });

      await expect(
        runGitSafetyCheckAsync("git commit -m 'add database config'", standard, workspace),
      ).rejects.toMatchObject({ code: "SECRETS_DETECTED" });
    });
  });

  describe("URL with credentials detection", () => {
    it("blocks committing URL with embedded credentials", async () => {
      await writeFile(
        join(workspace, "webhook.txt"),
        `https://user:secretpass@api.example.com/webhook`,
      );
      execSync("git add webhook.txt", { cwd: workspace });

      await expect(
        runGitSafetyCheckAsync("git commit -m 'add webhook'", standard, workspace),
      ).rejects.toMatchObject({ code: "SECRETS_DETECTED" });
    });
  });

  describe("custom secret patterns", () => {
    it("blocks using custom secret patterns", async () => {
      const config: GitSafetyConfig = {
        level: "standard",
        scanCommitsForSecrets: true,
        secretPatterns: [{ pattern: /CUSTOM_SECRET_[A-Z0-9]{10,}/, name: "custom secret token" }],
      };

      await writeFile(join(workspace, "custom.txt"), `token=CUSTOM_SECRET_ABCDEF1234567890`);
      execSync("git add custom.txt", { cwd: workspace });

      await expect(
        runGitSafetyCheckAsync("git commit -m 'add custom'", config, workspace),
      ).rejects.toMatchObject({ code: "SECRETS_DETECTED" });
    });
  });

  describe("safe commits", () => {
    it("allows committing safe files", async () => {
      await writeFile(join(workspace, "readme.md"), "# Project\n\nThis is a readme.");
      execSync("git add readme.md", { cwd: workspace });

      await expect(
        runGitSafetyCheckAsync("git commit -m 'add readme'", standard, workspace),
      ).resolves.toBeUndefined();
    });

    it("allows committing source code", async () => {
      await writeFile(join(workspace, "index.ts"), `export function hello() { return "world"; }`);
      execSync("git add index.ts", { cwd: workspace });

      await expect(
        runGitSafetyCheckAsync("git commit -m 'add source'", standard, workspace),
      ).resolves.toBeUndefined();
    });

    it("allows committing config without secrets", async () => {
      await writeFile(join(workspace, "config.json"), `{"port": 3000, "host": "localhost"}`);
      execSync("git add config.json", { cwd: workspace });

      await expect(
        runGitSafetyCheckAsync("git commit -m 'add config'", standard, workspace),
      ).resolves.toBeUndefined();
    });
  });

  describe("multiple files", () => {
    it("blocks commit if any staged file contains secrets", async () => {
      await writeFile(join(workspace, "safe.txt"), "This is safe content");
      await writeFile(join(workspace, "unsafe.txt"), `API_KEY="sk_live_1234567890abcdef"`);
      execSync("git add safe.txt unsafe.txt", { cwd: workspace });

      await expect(
        runGitSafetyCheckAsync("git commit -m 'add files'", standard, workspace),
      ).rejects.toMatchObject({ code: "SECRETS_DETECTED" });
    });
  });

  describe("error messages", () => {
    it("ENV_FILE_COMMIT_BLOCKED includes filename", async () => {
      await writeFile(join(workspace, ".env"), "SECRET=test");
      execSync("git add .env", { cwd: workspace });

      let caught: unknown;
      try {
        await runGitSafetyCheckAsync("git commit -m 'add env'", standard, workspace);
      } catch (e) {
        caught = e;
      }

      expect(caught).toBeInstanceOf(ToolError);
      expect((caught as ToolError).message).toContain(".env");
      expect((caught as ToolError).message).toContain("gitignore");
    });

    it("SECRETS_DETECTED includes secret type and line number", async () => {
      await writeFile(
        join(workspace, "config.js"),
        `const x = 1;\nconst API_KEY = "secret1234567890123456789012345678";\nconst y = 2;`,
      );
      execSync("git add config.js", { cwd: workspace });

      let caught: unknown;
      try {
        await runGitSafetyCheckAsync("git commit -m 'add config'", standard, workspace);
      } catch (e) {
        caught = e;
      }

      expect(caught).toBeInstanceOf(ToolError);
      expect((caught as ToolError).message).toContain("config.js");
      expect((caught as ToolError).message).toContain("line 2");
    });
  });
});
