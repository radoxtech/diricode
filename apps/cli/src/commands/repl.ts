import type { DiriCodeConfig } from "@diricode/core";

export async function startRepl(
  _config: DiriCodeConfig,
  _options: { session?: string },
): Promise<void> {
  console.log("🚧 REPL mode not yet implemented (see DC-CLI-002)");
  process.exit(0);
}
