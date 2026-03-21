import type { DiriCodeConfig } from "@diricode/core";

export function runOnce(
  _config: DiriCodeConfig,
  _prompt: string,
  _options: { json?: boolean; session?: string },
): void {
  // eslint-disable-next-line no-console
  console.log("🚧 One-shot mode not yet implemented (see DC-CLI-003)");
  process.exit(0);
}
