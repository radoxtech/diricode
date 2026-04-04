import { bootstrapPlayground } from "./bootstrap.js";
import { createApp } from "./server.js";

async function main() {
  // 1. Parse CLI args
  const port = parseInt(process.argv.find((a) => a.startsWith("--port="))?.split("=")[1] ?? "3333");
  const host = process.argv.find((a) => a.startsWith("--host="))?.split("=")[1] ?? "localhost";

  // 2. Bootstrap (providers, registries, resolver, diriRouter)
  const result = await bootstrapPlayground();

  // 3. Create Hono app with all routes
  const app = createApp(result);

  // 4. Start Bun server
  const server = Bun.serve({ port, hostname: host, fetch: app.fetch });

  // 5. Print startup banner
  const modelCount = result.modelCardRegistry.list().length;
  const candidateCount = result.subscriptionRegistry.list().length;

  const providerLines = result.providerStatuses
    .map((p) => `│    ${p.available ? "✓" : "✗"} ${p.name} (${p.envVar})`)
    .join("\n");

  console.log(`
┌─────────────────────────────────────────┐
│  DiriRouter Playground                  │
│  http://${host}:${port}                 │
│                                         │
│  Providers:                             │
${providerLines}
│                                         │
│  Models: ${String(modelCount).padEnd(22)} │
│  Candidates: ${String(candidateCount).padEnd(19)} │
└─────────────────────────────────────────┘
`);

  // 6. Handle SIGINT/SIGTERM for clean shutdown
  const shutdown = () => {
    console.log("\nShutting down...");
    server.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Failed to start playground:", err);
  process.exit(1);
});
