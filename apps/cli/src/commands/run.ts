import type { DiriCodeConfig } from "@diricode/core";

export async function runOnce(
  _config: DiriCodeConfig,
  _prompt: string,
  _options: { json?: boolean; session?: string },
): Promise<void> {
  console.log("🚧 One-shot mode not yet implemented (see DC-CLI-003)");
  process.exit(0);
}
