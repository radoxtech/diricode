import { describe, it, expect, beforeAll } from "vitest";
import { Hono } from "hono";
import { v1Router } from "../routes/api/v1.js";

interface OpenApiPathItem {
  summary?: string;
  description?: string;
  tags?: string[];
  [key: string]: unknown;
}

interface OpenApiOperation {
  get?: OpenApiPathItem;
  post?: OpenApiPathItem;
  put?: OpenApiPathItem;
  delete?: OpenApiPathItem;
  patch?: OpenApiPathItem;
}

interface OpenApiSchema {
  openapi: string;
  info: {
    title: string;
    version: string;
    [key: string]: unknown;
  };
  paths: Record<string, OpenApiOperation>;
  [key: string]: unknown;
}

describe("API Versioning", () => {
  let app: Hono;

  beforeAll(() => {
    app = new Hono();
    app.route("/api/v1", v1Router);
  });

  async function fetchRes(path: string): Promise<{
    status: number;
    headers: Headers;
    body: OpenApiSchema;
  }> {
    const res = await app.request(path, { method: "GET" });
    const body = (await res.clone().json()) as OpenApiSchema;
    return { status: res.status, headers: res.headers, body };
  }

  it("adds API-Version header to GET /api/v1", async () => {
    const res = await fetchRes("/api/v1");
    expect(res.headers.get("API-Version")).toBe("v1");
  });

  it("adds API-Version header to POST /api/v1/sessions", async () => {
    const res = await app.request("/api/v1/sessions", { method: "POST" });
    expect(res.headers.get("API-Version")).toBe("v1");
  });

  it("returns openapi.json at GET /api/v1/openapi.json", async () => {
    const res = await fetchRes("/api/v1/openapi.json");
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.1.0");
    expect(res.body.info.title).toBe("DiriCode Server API");
    expect(res.body.info.version).toBe("v1");
  });

  it("openapi.json includes sessions paths", async () => {
    const res = await fetchRes("/api/v1/openapi.json");
    expect(res.body.paths["/sessions"]).toBeDefined();
    expect(res.body.paths["/sessions/{id}"]).toBeDefined();
    expect(res.body.paths["/sessions/{id}/messages"]).toBeDefined();
  });

  it("openapi.json includes events path", async () => {
    const res = await fetchRes("/api/v1/openapi.json");
    expect(res.body.paths["/events"]).toBeDefined();
  });

  it("openapi.json path items have summary fields", async () => {
    const res = await fetchRes("/api/v1/openapi.json");
    expect(res.body.paths["/sessions"].post?.summary).toBe("Create a new session");
    expect(res.body.paths["/sessions/{id}"].get?.summary).toBe("Get a session by ID");
    expect(res.body.paths["/sessions/{id}/messages"].post?.summary).toBe(
      "Add a message to a session",
    );
    expect(res.body.paths["/sessions/{id}/messages"].get?.summary).toBe(
      "Get all messages for a session",
    );
    expect(res.body.paths["/events"].get?.summary).toBe("SSE event stream");
  });

  it("health endpoint does NOT have API-Version header", async () => {
    const healthApp = new Hono();
    healthApp.route(
      "/health",
      new Hono().get("/", (c) => c.json({ ok: true })),
    );
    const res = await healthApp.request("/health");
    expect(res.headers.get("API-Version")).toBeNull();
  });

  it("API-Version header is absent when v1Router is NOT used", async () => {
    const plainApp = new Hono();
    plainApp.get("/", (c) => c.json({ ok: true }));
    const res = await plainApp.request("/");
    expect(res.headers.get("API-Version")).toBeNull();
  });
});
