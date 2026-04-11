import { bootstrapPlayground, type BootstrapResult } from "./bootstrap.js";
import { createApp } from "./server.js";
import { readPlaygroundState } from "./model-state.js";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { readFileSync, existsSync } from "fs";

// Load .env from package directory (so users can just place keys there)
const moduleDir = fileURLToPath(new URL(".", import.meta.url));
const envPath = resolve(moduleDir, ".env");
if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex < 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed
      .slice(eqIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g;

function visibleLen(s: string): number {
  return s.replace(ANSI_RE, "").length;
}

function padAnsi(s: string, width: number): string {
  const vl = visibleLen(s);
  return vl >= width ? s : s + " ".repeat(width - vl);
}

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  white: "\x1b[37m",
  bgDark: "\x1b[48;5;234m",
};

type Row = readonly [string, string, string, string];

function renderStartupTable(params: {
  host: string;
  port: string;
  providerStatuses: BootstrapResult["providerStatuses"];
  modelCardRegistry: BootstrapResult["modelCardRegistry"];
}): string {
  const { host, port, providerStatuses, modelCardRegistry } = params;

  const allModels = modelCardRegistry.list();
  const totalModels = allModels.length;
  const { disabledModels } = readPlaygroundState();
  const enabledCount = totalModels - disabledModels.length;

  const rows: Row[] = providerStatuses.map((p) => {
    const count = p.modelCount;
    const examples = p.modelNames.slice(0, 2).join(", ");
    const exampleStr = count > 2 ? examples + `, +${String(count - 2)} more` : examples || "—";
    const statusStr = p.available ? `${C.green}✓ Ready${C.reset}` : `${C.red}✗ No key${C.reset}`;
    return [p.name, statusStr, String(count), exampleStr] as const;
  });

  const HEADERS: Row = ["Provider", "Status", "Models", "Example Models"];
  const colWidths = HEADERS.map((h, i) =>
    Math.max(
      h.length,
      i === 0 ? 10 : 0,
      i === 1 ? 10 : 0,
      i === 2 ? 6 : 0,
      i === 3 ? 20 : 0,
      ...rows.map((r) => visibleLen(r[i as 0 | 1 | 2 | 3])),
    ),
  ) as [number, number, number, number];

  const borderLine = (left: string, mid: string, right: string, fill: string): string =>
    left + colWidths.map((w) => fill.repeat(w + 2)).join(mid) + right;

  const row = (cells: Row, bold = false): string => {
    const parts = cells.map((cell, i) => {
      const padded = padAnsi(cell, colWidths[i as 0 | 1 | 2 | 3]);
      return bold ? `${C.bold}${padded}${C.reset}` : padded;
    });
    return "│ " + parts.join(" │ ") + " │";
  };

  const top = borderLine("┌", "┬", "┐", "─");
  const headerSep = borderLine("├", "┼", "┤", "─");
  const bottom = borderLine("└", "┴", "┘", "─");

  const tableWidth = top.length;
  const innerWidth = tableWidth - 2;

  const centreBox = (text: string): string => {
    const vl = visibleLen(text);
    const total = innerWidth - vl;
    const left = Math.floor(total / 2);
    const right = total - left;
    return "│" + " ".repeat(left) + text + " ".repeat(right) + "│";
  };

  const blankRow = "│" + " ".repeat(innerWidth) + "│";

  const url = `${C.cyan}http://${host}:${port}${C.reset}`;
  const title = `${C.bold}${C.white}DiriRouter Playground${C.reset}`;
  const stats = `${C.dim}Available models: ${String(enabledCount)} of ${String(totalModels)} total${C.reset}`;

  const lines: string[] = [
    "",
    top,
    centreBox(title),
    centreBox(url),
    blankRow,
    headerSep,
    row(HEADERS, true),
    headerSep,
    ...rows.map((r) => row(r)),
    bottom,
    stats,
    "",
  ];

  return lines.join("\n");
}

async function main(): Promise<void> {
  const portStr = process.argv.find((a) => a.startsWith("--port="))?.split("=")[1] ?? "3333";
  const port = parseInt(portStr);
  const host = process.argv.find((a) => a.startsWith("--host="))?.split("=")[1] ?? "localhost";

  const result = await bootstrapPlayground();
  const app = createApp(result);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
  const server = (globalThis as any).Bun.serve({ port, hostname: host, fetch: app.fetch });

  // eslint-disable-next-line no-console
  console.log(
    renderStartupTable({
      host,
      port: portStr,
      providerStatuses: result.providerStatuses,
      modelCardRegistry: result.modelCardRegistry,
    }),
  );

  const shutdown = (): void => {
    // eslint-disable-next-line no-console
    console.log("\nShutting down...");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
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
