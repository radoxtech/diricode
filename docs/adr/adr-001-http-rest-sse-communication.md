# ADR-001 — HTTP REST + SSE Communication

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP                                           |
| References  | —                                             |

### Context

DiriCode separates frontend and backend to allow independent development of the Web UI (MVP) and future TUI (v2). A communication protocol is needed that supports real-time streaming of agent events while remaining simple to implement.

### Decision

Client-server architecture based on **HTTP REST + Server-Sent Events (SSE)**.

- **Server:** Bun runtime + Hono framework.
- **REST:** Standard request-response for commands, config, and state queries.
- **SSE:** One-way server-to-client streaming for agent events, tool outputs, and progress updates.
- **Platforms:** Linux and macOS only (Windows not supported — DECYZJA-8).

### Consequences

- **Positive:** Any client (Web UI, TUI, CLI) connects to the same local server. Simple, well-understood protocol. No WebSocket complexity.
- **Negative:** SSE is server→client only; client→server requires separate REST calls. Acceptable for our use case.
