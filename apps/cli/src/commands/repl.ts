import { createInterface, type Interface } from "node:readline/promises";
import type { DiriCodeConfig } from "@diricode/core";

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

function* dispatchToAgent(
  _input: string,
  _config: DiriCodeConfig,
  _session: string | null,
): Iterable<string> {
  // TODO(rado): wire to @diricode/agents dispatcher once pipeline is ready
  yield `[POC] Received: "${_input.slice(0, 50)}${_input.length > 50 ? "..." : ""}"\n`;
  yield `  (Agent dispatch not yet wired)\n`;
}

export async function startRepl(config: DiriCodeConfig, options: ReplOptions): Promise<void> {
  let status: ReplStatus = { session: options.session ?? null, mode: "idle", historySize: 0 };

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    historySize: 100,
    completer: (line: string): [string[], string] => {
      const commands = ["/help", "/status", "/exit", "/quit", "/clear"];
      const hits = commands.filter((c) => c.startsWith(line));
      return [hits, line];
    },
  });

  // eslint-disable-next-line no-console
  console.log("diricode REPL (POC) — type /help for commands\n");

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

      if (!trimmed) continue;

      status = { ...status, mode: "streaming" };
      // eslint-disable-next-line no-console
      console.log();

      let firstChunk = true;
      for (const chunk of dispatchToAgent(input, config, status.session)) {
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
