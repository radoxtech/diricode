#!/usr/bin/env bun
import cac from "cac";
import pkg from "../package.json";
import { validateFlags } from "./flags.js";
import { resolveConfig } from "./config.js";
import { startRepl } from "./commands/repl.js";
import { runOnce } from "./commands/run.js";

const cli = cac("diricode");

cli
  .option("-s, --session <id>", "Session ID to resume")
  .option("-c, --config <path>", "Path to config file")
  .option("-p, --provider <name>", "LLM provider override")
  .option("-m, --mode <mode>", "Work mode preset (safe | yolo | auto)")
  .option("--model <name>", "Model name override")
  .option("--json", "JSON output mode")
  .option("--verbose", "Verbose output");

cli
  .command("[...args]", "Start interactive REPL (default)")
  .action(async (_args: string[], options: Record<string, unknown>) => {
    try {
      const flags = validateFlags(options);
      if (flags.json !== true) {
        // eslint-disable-next-line no-console
        console.log(`diricode v${pkg.version}`);
      }
      const config = await resolveConfig(flags);
      startRepl(config, { session: flags.session });
    } catch (err) {
      if (err instanceof Error) {
        // eslint-disable-next-line no-console
        console.error(`Error: ${err.message}`);
      }
      process.exit(1);
    }
  });

cli
  .command("run <prompt>", "Run a one-shot prompt and exit")
  .action(async (prompt: string, options: Record<string, unknown>) => {
    try {
      const flags = validateFlags(options);
      if (flags.json !== true) {
        // eslint-disable-next-line no-console
        console.log(`diricode v${pkg.version}`);
      }
      const config = await resolveConfig(flags);
      runOnce(config, prompt, { json: flags.json, session: flags.session });
    } catch (err) {
      if (err instanceof Error) {
        // eslint-disable-next-line no-console
        console.error(`Error: ${err.message}`);
      }
      process.exit(1);
    }
  });

cli.help();
cli.version(pkg.version);

try {
  cli.parse();
} catch (err) {
  if (err instanceof Error) {
    // eslint-disable-next-line no-console
    console.error(`Usage error: ${err.message}`);
  }
  process.exit(2);
}
