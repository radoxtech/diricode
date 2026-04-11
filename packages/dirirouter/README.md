# DiriRouter

**Cost-optimized model routing** with multi-provider support, subscription rotation, and intelligent tier-based selection. DiriRouter helps you maximize your existing API subscriptions while minimizing per-token costs.

## Why DiriRouter?

- 💰 **Save money**: Automatically route to the cheapest capable model
- 🔄 **Subscription rotation**: Use GitHub Copilot quota before paying per-token
- ⏰ **Never hit limits**: Auto-switch when a subscription's quota runs out
- 📊 **Learn what works**: Track which models perform best for your tasks (v2+)

## Key Features

### Multi-Subscription Management

Configure multiple subscriptions with different priorities:

```typescript
// Subscriptions are tried in priority order (1 = highest)
const subscriptions = [
  { id: "copilot-pro", provider: "copilot", priority: 1 }, // Use first
  { id: "gemini-free", provider: "gemini", priority: 2 }, // Fallback
  { id: "anthropic-paygo", provider: "anthropic", priority: 3 }, // Last resort
];
```

### Context-Aware Tiers

Models are classified by capability tier, not just name:

| Tier   | Context Window | Best For                        | Cost Level |
| ------ | -------------- | ------------------------------- | ---------- |
| LOW    | 200k+ tokens   | Simple tasks, utilities         | $          |
| MEDIUM | 200k–800k      | Standard coding, review         | $$         |
| HEAVY  | 800k+          | Complex architecture, reasoning | $$$        |

### "Try Cheap First" Strategy

For tasks with ambiguous complexity, DiriRouter tries a LOW-tier model first. If successful → saved money. If not → escalates to the appropriate tier.

## Playground

The playground lets you explore model availability, toggle models on/off, and test the picker without running the full agentic loop.

### Quick Start

Create a `.env` file in `packages/dirirouter/` with your API keys:

```bash
# packages/dirirouter/.env
GEMINI_API_KEY=your_key
DC_ZAI_API_KEY=your_key
```

Then boot:

```bash
pnpm --filter @diricode/dirirouter playground
```

Server starts at **http://localhost:3333**

> No `export` needed — keys are loaded automatically from `.env` at startup.

### CLI Output

On startup, you'll see a table showing your configured subscriptions and available models:

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                        DiriRouter Playground                                       │
│                        http://localhost:3333                                       │
│                                                                                    │
├────────────┬────────────┬────────┬─────────────┬──────────────────────────────────┤
│ Provider   │ Status     │ Models │ Quota Used  │ Example Models                   │
├────────────┼────────────┼────────┼─────────────┼──────────────────────────────────┤
│ gemini     │ ✓ Ready    │ 4      │ Free tier   │ gemini-2.5-pro, gemini-2.5-flash │
│ kimi       │ ✗ No key   │ 0      │ —           │ —                                │
│ zai        │ ✓ Ready    │ 4      │ 45%         │ glm-5, glm-5-plus, +2 more       │
│ minimax    │ ✗ No key   │ 0      │ —           │ —                                │
│ copilot    │ ✓ Ready    │ 2      │ 30% (auto)  │ claude-opus, gpt-4o              │
└────────────┴────────────┴────────┴─────────────┴──────────────────────────────────┘
Available models: 6 of 10 total (4 disabled due to missing keys)
Active subscriptions: 3 of 5 configured
```

When a subscription hits its limit, DiriRouter automatically rotates to the next available provider based on your priority configuration.

### Web UI

Open **http://localhost:3333** to see the model toggle panel. Models are grouped by provider with Alpine.js switches. Toggling a model updates `playground-state.json` immediately.

### API Endpoints

| Method  | Path                 | Description                           |
| ------- | -------------------- | ------------------------------------- |
| `GET`   | `/api/models`        | List all models with `enabled` status |
| `PATCH` | `/api/models/toggle` | Toggle model on/off                   |
| `POST`  | `/api/pick`          | Dry-run model picker                  |
| `POST`  | `/api/chat`          | Chat with a specific model            |
| `GET`   | `/api/status`        | Server health + provider status       |

#### Toggle a model

```bash
# Disable gpt-4o
curl -X PATCH http://localhost:3333/api/models/toggle \
  -H "Content-Type: application/json" \
  -d '{"modelId": "gpt-4o", "enabled": false}'

# Re-enable it
curl -X PATCH http://localhost:3333/api/models/toggle \
  -H "Content-Type: application/json" \
  -d '{"modelId": "gpt-4o", "enabled": true}'
```

#### Test the picker

```bash
curl -X POST http://localhost:3333/api/pick \
  -H "Content-Type: application/json" \
  -d '{
    "agent": {"id": "1", "role": "architect", "name": "bob"},
    "task": {"type": "coding", "complexity": "complex"},
    "modelDimensions": {"tier": "heavy", "modelAttributes": ["reasoning"], "fallbackType": "strong"}
  }'
```

Disabled models appear in the response with `"status": "excluded"` and `"rejectionReason": "excluded by constraints: model X is excluded"`.

### State Persistence

State is stored in `playground-state.json` in the cwd where you run the command:

```json
{
  "disabledModels": ["gpt-4o"],
  "subscriptionHealth": {
    "copilot-pro": {
      "status": "healthy",
      "quotaUsed": 0.3,
      "quotaResetAt": "2026-05-01T00:00:00Z"
    },
    "gemini-free": {
      "status": "healthy",
      "quotaUsed": 0.85
    }
  },
  "sessionCosts": {
    "totalUsd": 0.0042,
    "byProvider": {
      "copilot": 0.001,
      "gemini": 0.0032
    }
  },
  "lastUpdated": "2026-04-04T12:00:00.000Z"
}
```

Delete this file to reset all models to enabled and clear cost tracking.

### Provider API Keys

| Provider        | Env Var                                         |
| --------------- | ----------------------------------------------- |
| Google Gemini   | `GEMINI_API_KEY`                                |
| Zhipu AI (GLM)  | `DC_ZAI_API_KEY`                                |
| Moonshot (Kimi) | `DC_KIMI_API_KEY`                               |
| MiniMax         | `DC_MINIMAX_API_KEY`                            |
| GitHub Copilot  | `GITHUB_TOKEN` / `GH_TOKEN` / `DC_GITHUB_TOKEN` |

## Cost Optimization Features

### Subscription Rotation

When you have multiple subscriptions configured, DiriRouter automatically rotates between them based on:

1. **Priority** (lower number = higher priority)
2. **Health status** (healthy > degraded > exhausted)
3. **Quota remaining** (prefers subscriptions with more quota left)
4. **Cost** (prefers cheaper options when quality is equivalent)

### Rate Limit Handling

When a subscription hits rate limits:

- Automatic cooldown with exponential backoff (7s → 14s → 28s → ... max 300s)
- Immediate failover to next eligible subscription
- Auto-recovery when limits reset

### Cost Tracking (MVP-2)

Track spend across providers in real-time:

```typescript
// Get session cost summary
const costs = await diriRouter.getSessionCosts(sessionId);
console.log(costs);
// { totalUsd: 0.45, byProvider: { copilot: 0.12, gemini: 0.33 } }
```

## Build & Test

```bash
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```
