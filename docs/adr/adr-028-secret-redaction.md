# ADR-028 — Automatic Secret Redaction

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP                                           |
| References  | —                                             |

### Context

Agents read files that may contain secrets (API keys, tokens, passwords). These must never be sent to external model providers.

### Decision

**Built-in scanner** that masks secrets before sending to providers.

**Scope:** `.env` files, API keys, tokens, password patterns, connection strings, private keys.

**Mechanism:** Pattern matching + heuristics. Redacted content is replaced with `[REDACTED]` placeholder.

### Consequences

- **Positive:** Prevents accidental secret leakage to model providers. Works transparently without user action.
- **Negative:** False positives (non-secrets matching patterns) may reduce context quality. False negatives (novel secret formats) require pattern updates.
