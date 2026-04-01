import { z } from "zod";

export const SessionStatusSchema = z.enum(["created", "active", "completed", "archived"]);

export type SessionStatus = z.infer<typeof SessionStatusSchema>;

const VALID_TRANSITIONS: Record<SessionStatus, Set<SessionStatus>> = {
  created: new Set(["active"]),
  active: new Set(["completed"]),
  completed: new Set(["archived"]),
  archived: new Set(),
};

export function isValidTransition(from: SessionStatus, to: SessionStatus): boolean {
  return VALID_TRANSITIONS[from].has(to);
}

export class InvalidSessionTransition extends Error {
  constructor(
    public readonly from: SessionStatus,
    public readonly to: SessionStatus,
  ) {
    super(`Invalid session status transition: ${from} → ${to}`);
    this.name = "InvalidSessionTransition";
  }
}

export const SessionSchema = z.object({
  id: z.string().min(1),
  status: SessionStatusSchema,
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Session = z.infer<typeof SessionSchema>;

export const CreateSessionInputSchema = z.object({
  id: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateSessionInput = z.infer<typeof CreateSessionInputSchema>;

export const MessageRoleSchema = z.enum(["user", "assistant", "system", "tool"]);

export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const MessageSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  role: MessageRoleSchema,
  content: z.string(),
  tokens: z.number().int().nonnegative().default(0),
  cost: z.number().nonnegative().default(0),
  agentId: z.string().nullable().optional(),
  timestamp: z.string(),
});

export type Message = z.infer<typeof MessageSchema>;

export const AppendMessageInputSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  role: MessageRoleSchema,
  content: z.string(),
  tokens: z.number().int().nonnegative().optional(),
  cost: z.number().nonnegative().optional(),
  agentId: z.string().nullable().optional(),
});

export type AppendMessageInput = z.infer<typeof AppendMessageInputSchema>;
