import { Hono } from "hono";
import type { ApiEnvelope } from "../../middleware/error.js";

export interface Session {
  id: string;
  status: "created" | "active" | "completed" | "error";
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const sessions = new Map<string, Session>();
const sessionMessages = new Map<string, SessionMessage[]>();

function generateId(): string {
  return crypto.randomUUID();
}

export const sessionsRouter = new Hono();

sessionsRouter.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const id = generateId();
  const now = new Date();

  const session: Session = {
    id,
    status: "created",
    metadata: body.metadata ?? {},
    createdAt: now,
    updatedAt: now,
  };

  sessions.set(id, session);
  sessionMessages.set(id, []);

  const envelope: ApiEnvelope<Session> = {
    success: true,
    data: session,
  };

  return c.json(envelope, 201);
});

sessionsRouter.get("/:id", (c) => {
  const id = c.req.param("id");
  const session = sessions.get(id);

  if (!session) {
    const envelope: ApiEnvelope<never> = {
      success: false,
      error: { code: "SESSION_NOT_FOUND", message: `Session ${id} not found` },
    };
    return c.json(envelope, 404);
  }

  const envelope: ApiEnvelope<Session> = {
    success: true,
    data: session,
  };

  return c.json(envelope);
});

sessionsRouter.post("/:id/messages", async (c) => {
  const id = c.req.param("id");
  const session = sessions.get(id);

  if (!session) {
    const envelope: ApiEnvelope<never> = {
      success: false,
      error: { code: "SESSION_NOT_FOUND", message: `Session ${id} not found` },
    };
    return c.json(envelope, 404);
  }

  const body = await c.req.json().catch(() => null);

  if (!body || typeof body.content !== "string" || !body.role) {
    const envelope: ApiEnvelope<never> = {
      success: false,
      error: {
        code: "INVALID_REQUEST",
        message:
          "Request body must include 'content' (string) and 'role' ('user' | 'assistant' | 'system')",
      },
    };
    return c.json(envelope, 400);
  }

  const validRoles = ["user", "assistant", "system"];
  if (!validRoles.includes(body.role)) {
    const envelope: ApiEnvelope<never> = {
      success: false,
      error: {
        code: "INVALID_ROLE",
        message: `Role must be one of: ${validRoles.join(", ")}`,
      },
    };
    return c.json(envelope, 400);
  }

  const message: SessionMessage = {
    id: generateId(),
    sessionId: id,
    role: body.role,
    content: body.content,
    metadata: body.metadata ?? {},
    createdAt: new Date(),
  };

  const messages = sessionMessages.get(id) ?? [];
  messages.push(message);
  sessionMessages.set(id, messages);

  if (session.status === "created") {
    session.status = "active";
    session.updatedAt = new Date();
    sessions.set(id, session);
  }

  const envelope: ApiEnvelope<SessionMessage> = {
    success: true,
    data: message,
  };

  return c.json(envelope, 201);
});

sessionsRouter.get("/:id/messages", (c) => {
  const id = c.req.param("id");
  const session = sessions.get(id);

  if (!session) {
    const envelope: ApiEnvelope<never> = {
      success: false,
      error: { code: "SESSION_NOT_FOUND", message: `Session ${id} not found` },
    };
    return c.json(envelope, 404);
  }

  const messages = sessionMessages.get(id) ?? [];

  const envelope: ApiEnvelope<SessionMessage[]> = {
    success: true,
    data: messages,
  };

  return c.json(envelope);
});
