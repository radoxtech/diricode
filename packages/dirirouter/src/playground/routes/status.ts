import type { Context } from "hono";
import type { BootstrapResult } from "../bootstrap.js";

const BootstrapKey = "bootstrap";

export function setBootstrap(c: Context, bootstrap: BootstrapResult): void {
  c.set(BootstrapKey, bootstrap as unknown as BootstrapResult);
}

export function getBootstrap(c: Context): BootstrapResult {
  return c.get(BootstrapKey) as BootstrapResult;
}

export function getStatus(c: Context): Response {
  const bootstrap = getBootstrap(c);
  const uptimeSeconds = Math.floor((Date.now() - bootstrap.startTime) / 1000);

  return c.json({
    providers: bootstrap.providerStatuses,
    serverUptime: uptimeSeconds,
  });
}
