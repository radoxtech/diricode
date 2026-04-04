import { createInterface, type Interface } from "node:readline/promises";
import type { DiriCodeConfig } from "@diricode/core";
import { hasGithubAuth } from "@diricode/providers";
import { runLogin } from "./login.js";
import { runLogout } from "./logout.js";
import { runWhoami } from "./whoami.js";

const SERVER_PORT = Number(process.env.PORT ?? 3001);
const EXECUTE_URL = `http://localhost:${String(SERVER_PORT)}/api/v1/execute`;

interface ExecuteResponseData {
  sessionId: string;
  result: unknown;
}

interface ExecuteEnvelope {
  success: boolean;
  data?: ExecuteResponseData;
  error?: { code: string; message: string };
}

export interface ReplOptions {
  session?: string;
}

export interface ReplStatus {
  session: string | null;
  mode: "idle" | "streaming";
  historySize: number;
}

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`
Commands:
  /help     Show this help message
  /login    Authenticate with GitHub or Google
  /logout   Remove stored GitHub token from OS Keychain
  /whoami   Show current authentication status
  /status   Show current REPL status
  /exit     Exit the REPL
  /clear    Clear the screen

Multiline input: end a line with \\ to continue.
Double-enter:    submits the current input.
Ctrl+C:          cancels the current input line.
Ctrl+D:          exits the REPL.
`);
}

function printStatus(status: ReplStatus): void {
  // eslint-disable-next-line no-console
  console.log(`
Session: ${status.session ?? "(new)"}
Mode:    ${status.mode}
History: ${String(status.historySize)} entries
`);
}

async function readMultilineInput(
  rl: Interface,
  prompt: string,
  continuationPrompt: string,
): Promise<string | null> {
  const lines: string[] = [];

  for (;;) {
    const line = await rl.question(lines.length === 0 ? prompt : continuationPrompt);
    const trimmed = line.trimEnd();

    if (trimmed.endsWith("\\")) {
      lines.push(trimmed.slice(0, -1));
    } else if (trimmed === "" && lines.length > 0) {
      break;
    } else if (trimmed === "" && lines.length === 0) {
      continue;
    } else {
      lines.push(trimmed);
      break;
    }
  }

  return lines.length > 0 ? lines.join("\n") : null;
}

async function* dispatchToAgent(
  input: string,
  _config: DiriCodeConfig,
  session: string | null,
): AsyncIterable<string> {
  const response = await fetch(EXECUTE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: input,
      sessionId: session ?? undefined,
      workspaceRoot: process.cwd(),
    }),
  });

  const envelope = (await response.json()) as ExecuteEnvelope;

  if (!response.ok || !envelope.success) {
    const message = envelope.error?.message ?? `HTTP ${String(response.status)}`;
    yield `Error: ${message}\n`;
    return;
  }

  const output = envelope.data?.result;
  yield typeof output === "string" ? output : JSON.stringify(output, null, 2);
  yield "\n";
}

export async function startRepl(config: DiriCodeConfig, options: ReplOptions): Promise<void> {
  let status: ReplStatus = { session: options.session ?? null, mode: "idle", historySize: 0 };

  const configRecord = config as unknown as { auth?: { promptOnMissing?: boolean } };
  const promptOnMissing = configRecord.auth?.promptOnMissing !== false;

  if (promptOnMissing && !hasGithubAuth()) {
    // eslint-disable-next-line no-console
    console.log(
      "No GitHub token found. Run '/login' to authenticate or set DC_GITHUB_TOKEN / GITHUB_TOKEN env var.\n",
    );
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    historySize: 100,
    completer: (line: string): [string[], string] => {
      const commands = [
        "/help",
        "/login",
        "/logout",
        "/whoami",
        "/status",
        "/exit",
        "/quit",
        "/clear",
      ];
      const hits = commands.filter((c) => c.startsWith(line));
      return [hits, line];
    },
  });

  // eslint-disable-next-line no-console
  console.log("diricode REPL — type /help for commands\n");

  const prompt = "diricode> ";
  const continuationPrompt = "......> ";

  let running = true;

  while (running) {
    try {
      const input = await readMultilineInput(rl, prompt, continuationPrompt);
      if (!input) continue;

      const trimmed = input.trim();

      if (trimmed === "/help") {
        printHelp();
        continue;
      }

      if (trimmed === "/status") {
        printStatus(status);
        continue;
      }

      if (trimmed === "/exit" || trimmed === "/quit") {
        // eslint-disable-next-line no-console
        console.log("Goodbye!");
        running = false;
        continue;
      }

      if (trimmed === "/clear") {
        // eslint-disable-next-line no-console
        console.clear();
        continue;
      }

      if (trimmed === "/login") {
        await runLogin();
        continue;
      }

      if (trimmed === "/logout") {
        await runLogout();
        continue;
      }

      if (trimmed === "/whoami") {
        await runWhoami();
        continue;
      }

      if (!trimmed) continue;

      status = { ...status, mode: "streaming" };
      // eslint-disable-next-line no-console
      console.log();

      let firstChunk = true;
      for await (const chunk of dispatchToAgent(input, config, status.session)) {
        if (firstChunk) {
          process.stdout.write("  ");
          firstChunk = false;
        }
        process.stdout.write(chunk);
      }

      status = { ...status, mode: "idle" };
      // eslint-disable-next-line no-console
      console.log();
    } catch (err) {
      if (err instanceof Error) {
        // eslint-disable-next-line no-console
        console.error(`\nError: ${err.message}`);
      }
    }
  }

  rl.close();
}
