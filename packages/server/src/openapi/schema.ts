const API_VERSION = "v1";

export const createSessionSchema = {
  summary: "Create a new session",
  description: "Creates a new session and returns it with a generated ID.",
  tags: ["sessions"],
  requestBody: {
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            metadata: {
              type: "object",
              description: "Optional metadata to attach to the session",
              additionalProperties: true,
            },
          },
        },
      },
    },
  },
  responses: {
    "201": {
      description: "Session created successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              success: { type: "boolean", const: true },
              data: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  status: { type: "string", enum: ["created", "active", "completed", "error"] },
                  metadata: { type: "object", additionalProperties: true },
                  createdAt: { type: "string", format: "date-time" },
                  updatedAt: { type: "string", format: "date-time" },
                },
                required: ["id", "status", "metadata", "createdAt", "updatedAt"],
              },
            },
            required: ["success", "data"],
          },
        },
      },
    },
  },
} as const;

export const getSessionSchema = {
  summary: "Get a session by ID",
  description: "Returns a single session by its UUID.",
  tags: ["sessions"],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "The session UUID",
    },
  ],
  responses: {
    "200": {
      description: "Session found",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              success: { type: "boolean", const: true },
              data: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  status: { type: "string", enum: ["created", "active", "completed", "error"] },
                  metadata: { type: "object", additionalProperties: true },
                  createdAt: { type: "string", format: "date-time" },
                  updatedAt: { type: "string", format: "date-time" },
                },
                required: ["id", "status", "metadata", "createdAt", "updatedAt"],
              },
            },
            required: ["success", "data"],
          },
        },
      },
    },
    "404": {
      description: "Session not found",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              success: { type: "boolean", const: false },
              error: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  message: { type: "string" },
                },
                required: ["code", "message"],
              },
            },
            required: ["success", "error"],
          },
        },
      },
    },
  },
} as const;

export const createMessageSchema = {
  summary: "Add a message to a session",
  description: "Appends a user, assistant, or system message to the session's message history.",
  tags: ["sessions"],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "The session UUID",
    },
  ],
  requestBody: {
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            role: { type: "string", enum: ["user", "assistant", "system"] },
            content: { type: "string" },
            metadata: { type: "object", additionalProperties: true },
          },
          required: ["role", "content"],
        },
      },
    },
  },
  responses: {
    "201": {
      description: "Message added successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              success: { type: "boolean", const: true },
              data: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  sessionId: { type: "string", format: "uuid" },
                  role: { type: "string", enum: ["user", "assistant", "system"] },
                  content: { type: "string" },
                  metadata: { type: "object", additionalProperties: true },
                  createdAt: { type: "string", format: "date-time" },
                },
                required: ["id", "sessionId", "role", "content", "metadata", "createdAt"],
              },
            },
            required: ["success", "data"],
          },
        },
      },
    },
    "400": {
      description: "Invalid request body",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              success: { type: "boolean", const: false },
              error: {
                type: "object",
                properties: { code: { type: "string" }, message: { type: "string" } },
                required: ["code", "message"],
              },
            },
            required: ["success", "error"],
          },
        },
      },
    },
    "404": {
      description: "Session not found",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              success: { type: "boolean", const: false },
              error: {
                type: "object",
                properties: { code: { type: "string" }, message: { type: "string" } },
                required: ["code", "message"],
              },
            },
            required: ["success", "error"],
          },
        },
      },
    },
  },
} as const;

export const getMessagesSchema = {
  summary: "Get all messages for a session",
  description: "Returns the full message history for the specified session.",
  tags: ["sessions"],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "The session UUID",
    },
  ],
  responses: {
    "200": {
      description: "Messages retrieved successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              success: { type: "boolean", const: true },
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    sessionId: { type: "string", format: "uuid" },
                    role: { type: "string", enum: ["user", "assistant", "system"] },
                    content: { type: "string" },
                    metadata: { type: "object", additionalProperties: true },
                    createdAt: { type: "string", format: "date-time" },
                  },
                  required: ["id", "sessionId", "role", "content", "metadata", "createdAt"],
                },
              },
            },
            required: ["success", "data"],
          },
        },
      },
    },
    "404": {
      description: "Session not found",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              success: { type: "boolean", const: false },
              error: {
                type: "object",
                properties: { code: { type: "string" }, message: { type: "string" } },
                required: ["code", "message"],
              },
            },
            required: ["success", "error"],
          },
        },
      },
    },
  },
} as const;

export const eventsSseSchema = {
  summary: "SSE event stream",
  description:
    "Establishes a Server-Sent Events stream. The connection remains open, sending periodic heartbeat events. Clients should send `Last-Event-ID` header for reconnection resume.",
  tags: ["events"],
  parameters: [
    {
      name: "Last-Event-ID",
      in: "header",
      required: false,
      schema: { type: "string" },
      description: "The ID of the last event received, for reconnection resume",
    },
  ],
  responses: {
    "200": {
      description: "SSE stream established",
      content: {
        "text/event-stream": {
          schema: { type: "string", format: "binary" },
        },
      },
    },
  },
} as const;

export const openapiSchema = {
  openapi: "3.1.0",
  info: {
    title: "DiriCode Server API",
    description: "REST API and SSE endpoints for the DiriCode autonomous coding framework.",
    version: API_VERSION,
    contact: { url: "https://github.com/radoxtech/diricode" },
  },
  servers: [{ url: "/api/v1", description: "Current API version" }],
  paths: {
    "/sessions": {
      post: createSessionSchema,
    },
    "/sessions/{id}": {
      get: getSessionSchema,
    },
    "/sessions/{id}/messages": {
      post: createMessageSchema,
      get: getMessagesSchema,
    },
    "/events": {
      get: eventsSseSchema,
    },
  },
  components: {},
} as const;
