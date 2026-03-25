import type { Hono } from "hono";
import type { StatusCode } from "hono/utils/http-status";

export interface TestResponse<T = unknown> {
  status: StatusCode;
  headers: Headers;
  body: T;
  text: string;
}

export interface TestClient {
  get(path: string, options?: RequestInit): Promise<TestResponse>;
  post(path: string, options?: RequestInit): Promise<TestResponse>;
  put(path: string, options?: RequestInit): Promise<TestResponse>;
  patch(path: string, options?: RequestInit): Promise<TestResponse>;
  delete(path: string, options?: RequestInit): Promise<TestResponse>;
  request(method: string, path: string, options?: RequestInit): Promise<TestResponse>;
}

/**
 * Creates a test client for a Hono application.
 * Provides a simple interface for making HTTP requests against the app.
 *
 * @example
 * ```ts
 * import { createApp } from "@diricode/server";
 * import { createHonoTestClient } from "@diricode/test-harness";
 *
 * describe("API tests", () => {
 *   let client: TestClient;
 *
 *   beforeEach(() => {
 *     const app = createApp();
 *     client = createHonoTestClient(app);
 *   });
 *
 *   it("GET /health returns 200", async () => {
 *     const response = await client.get("/health");
 *     expect(response.status).toBe(200);
 *     expect(response.body).toEqual({ status: "ok" });
 *   });
 * });
 * ```
 */
export function createHonoTestClient(app: Hono): TestClient {
  const baseUrl = "http://localhost";

  async function request(
    method: string,
    path: string,
    options: RequestInit = {},
  ): Promise<TestResponse> {
    const url = new URL(path, baseUrl);

    const requestInit: RequestInit = {
      method,
      headers: options.headers,
      body: options.body,
    };

    const request = new Request(url, requestInit);
    const response = await app.fetch(request);

    const text = await response.text();
    let body: unknown;

    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    return {
      status: response.status as StatusCode,
      headers: response.headers,
      body,
      text,
    };
  }

  return {
    get: (path, options) => request("GET", path, options),
    post: (path, options) => request("POST", path, options),
    put: (path, options) => request("PUT", path, options),
    patch: (path, options) => request("PATCH", path, options),
    delete: (path, options) => request("DELETE", path, options),
    request,
  };
}

/**
 * Options for creating a test Hono server.
 */
export interface TestServerOptions {
  /**
   * Headers to include in every request.
   */
  defaultHeaders?: Record<string, string>;
}

/**
 * Creates a test server wrapper with additional utilities.
 *
 * @example
 * ```ts
 * import { createApp } from "@diricode/server";
 * import { createTestServer } from "@diricode/test-harness";
 *
 * describe("API tests", () => {
 *   let server: ReturnType<typeof createTestServer>;
 *
 *   beforeEach(() => {
 *     const app = createApp();
 *     server = createTestServer(app, {
 *       defaultHeaders: { "Authorization": "Bearer test-token" }
 *     });
 *   });
 *
 *   it("GET /api/user returns user data", async () => {
 *     const response = await server.get("/api/user");
 *     expect(response.status).toBe(200);
 *   });
 * });
 * ```
 */
export function createTestServer(app: Hono, options: TestServerOptions = {}): TestClient {
  const baseClient = createHonoTestClient(app);
  const defaultHeaders = options.defaultHeaders ?? {};

  async function requestWithDefaults(
    method: string,
    path: string,
    options: RequestInit = {},
  ): Promise<TestResponse> {
    const mergedHeaders: Record<string, string> = {
      ...defaultHeaders,
      ...(options.headers as Record<string, string> | undefined),
    };

    return baseClient.request(method, path, {
      ...options,
      headers: mergedHeaders,
    });
  }

  return {
    get: (path, options) => requestWithDefaults("GET", path, options),
    post: (path, options) => requestWithDefaults("POST", path, options),
    put: (path, options) => requestWithDefaults("PUT", path, options),
    patch: (path, options) => requestWithDefaults("PATCH", path, options),
    delete: (path, options) => requestWithDefaults("DELETE", path, options),
    request: requestWithDefaults,
  };
}
