import { bootstrapPlayground } from "./bootstrap.js";
import { createApp } from "./server.js";

async function main(): Promise<void> {
  // 1. Parse CLI args
  const port = parseInt(process.argv.find((a) => a.startsWith("--port="))?.split("=")[1] ?? "3333");
  const host = process.argv.find((a) => a.startsWith("--host="))?.split("=")[1] ?? "localhost";

  // 2. Bootstrap (providers, registries, resolver, diriRouter)
  const result = await bootstrapPlayground();

  // 3. Create Hono app with all routes
  const app = createApp(result);

  // 4. Start Bun server
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
  const server = (globalThis as any).Bun.serve({ port, hostname: host, fetch: app.fetch });

  // 5. Print startup banner
  const modelCount = result.modelCardRegistry.list().length;
  const candidateCount = result.subscriptionRegistry.list().length;

  const providerLines = result.providerStatuses
    .map((p) => `│    ${p.available ? "✓" : "✗"} ${p.name} (${p.envVar})`)
    .join("\n");

  // eslint-disable-next-line no-console
  console.log(`
┌─────────────────────────────────────────┐
│  DiriRouter Playground                  │
│  http://${host}:${String(port)}         │
│                                         │
│  Providers:                             │
${providerLines}
│                                         │
│  Models: ${String(modelCount).padEnd(22)} │
│  Candidates: ${String(candidateCount).padEnd(19)} │
└─────────────────────────────────────────┘
`);

  // 6. Handle SIGINT/SIGTERM for clean shutdown
  const shutdown = (): void => {
    // eslint-disable-next-line no-console
    console.log("\nShutting down...");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    void server.stop();
    process.exit(0);
  };

  void process.on("SIGINT", shutdown);
  void process.on("SIGTERM", shutdown);
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start playground:", err);
  process.exit(1);
});
