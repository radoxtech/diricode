import { describe, expect, it, beforeEach } from "vitest";
import { Hono } from "hono";
import { createHonoTestClient, createTestServer } from "../hono.js";
import type { TestClient } from "../hono.js";

describe("createHonoTestClient", () => {
  let client: TestClient;
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.get("/health", (c) => c.json({ status: "ok" }));
    app.get("/users/:id", (c) => c.json({ id: c.req.param("id") }));
    app.post("/users", async (c) => {
      const body = await c.req.json();
      return c.json({ created: body }, 201);
    });
    app.put("/users/:id", async (c) => {
      const body = await c.req.json();
      return c.json({ updated: body });
    });
    app.patch("/users/:id", async (c) => {
      const body = await c.req.json();
      return c.json({ patched: body });
    });
    app.delete("/users/:id", (c) => c.json({ deleted: c.req.param("id") }));

    client = createHonoTestClient(app);
  });

  it("should handle GET requests", async () => {
    const response = await client.get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("should handle POST requests", async () => {
    const response = await client.post("/users", {
      body: JSON.stringify({ name: "John" }),
      headers: { "Content-Type": "application/json" },
    });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ created: { name: "John" } });
  });

  it("should handle PUT requests", async () => {
    const response = await client.put("/users/1", {
      body: JSON.stringify({ name: "Jane" }),
      headers: { "Content-Type": "application/json" },
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ updated: { name: "Jane" } });
  });

  it("should handle PATCH requests", async () => {
    const response = await client.patch("/users/1", {
      body: JSON.stringify({ name: "Jim" }),
      headers: { "Content-Type": "application/json" },
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ patched: { name: "Jim" } });
  });

  it("should handle DELETE requests", async () => {
    const response = await client.delete("/users/1");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ deleted: "1" });
  });

  it("should handle route parameters", async () => {
    const response = await client.get("/users/123");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: "123" });
  });

  it("should return response headers", async () => {
    app.get("/headers", (c) => {
      c.header("X-Custom-Header", "test-value");
      return c.json({});
    });

    const response = await client.get("/headers");
    expect(response.headers.get("X-Custom-Header")).toBe("test-value");
  });

  it("should return text for non-JSON responses", async () => {
    app.get("/text", (c) => c.text("Hello, World!"));

    const response = await client.get("/text");
    expect(response.status).toBe(200);
    expect(response.text).toBe("Hello, World!");
    expect(response.body).toBe("Hello, World!");
  });

  it("should handle custom request method", async () => {
    const response = await client.request("GET", "/health");
    expect(response.status).toBe(200);
  });
});

describe("createTestServer", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.get("/api/protected", (c) => {
      const auth = c.req.header("Authorization");
      return c.json({ auth });
    });
  });

  it("should apply default headers to all requests", async () => {
    const server = createTestServer(app, {
      defaultHeaders: { Authorization: "Bearer test-token" },
    });

    const response = await server.get("/api/protected");
    expect(response.body).toEqual({ auth: "Bearer test-token" });
  });

  it("should allow overriding default headers", async () => {
    const server = createTestServer(app, {
      defaultHeaders: { Authorization: "Bearer default" },
    });

    const response = await server.get("/api/protected", {
      headers: { Authorization: "Bearer override" },
    });
    expect(response.body).toEqual({ auth: "Bearer override" });
  });

  it("should merge default headers with request headers", async () => {
    app.get("/api/merged", (c) => {
      return c.json({
        auth: c.req.header("Authorization"),
        custom: c.req.header("X-Custom"),
      });
    });

    const server = createTestServer(app, {
      defaultHeaders: { Authorization: "Bearer token" },
    });

    const response = await server.get("/api/merged", {
      headers: { "X-Custom": "value" },
    });
    expect(response.body).toEqual({
      auth: "Bearer token",
      custom: "value",
    });
  });
});
