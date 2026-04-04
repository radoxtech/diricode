# DiriRouter

Local-first model routing playground with provider registry, LLM-based model picker, and interactive CLI + Web UI.

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

On startup, you'll see a table:

```
┌──────────────────────────────────────────────────────────────────────┐
│                        DiriRouter Playground                        │
│                        http://localhost:3333                         │
│                                                                      │
├────────────┬────────────┬────────┬──────────────────────────────────┤
│ Provider   │ Status     │ Models │ Example Models                   │
├────────────┼────────────┼────────┼──────────────────────────────────┤
│ gemini     │ ✓ Ready    │ 4      │ gemini-3.1-pro, gemini-3-pro     │
│ kimi       │ ✗ No key   │ 0      │ —                                │
│ zai        │ ✓ Ready    │ 4      │ glm-5, glm-5-plus, +2 more        │
│ minimax    │ ✗ No key   │ 0      │ —                                │
│ copilot    │ ✗ No key   │ 0      │ —                                │
└────────────┴────────────┴────────┴──────────────────────────────────┘
Available models: 4 of 4 total
```

### Web UI

Open **http://localhost:3333** to see the model toggle panel. Models are grouped by provider with Alpine.js switches. Toggling a model updates `playground-state.json` immediately.

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/models` | List all models with `enabled` status |
| `PATCH` | `/api/models/toggle` | Toggle model on/off |
| `POST` | `/api/pick` | Dry-run model picker |
| `POST` | `/api/chat` | Chat with a specific model |
| `GET` | `/api/status` | Server health + provider status |

#### Toggle a model

```bash
# Disable gpt-5.4
curl -X PATCH http://localhost:3333/api/models/toggle \
  -H "Content-Type: application/json" \
  -d '{"modelId": "gpt-5.4", "enabled": false}'

# Re-enable it
curl -X PATCH http://localhost:3333/api/models/toggle \
  -H "Content-Type: application/json" \
  -d '{"modelId": "gpt-5.4", "enabled": true}'
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
  "disabledModels": ["gpt-5.4"],
  "lastUpdated": "2026-04-04T12:00:00.000Z"
}
```

Delete this file to reset all models to enabled.

### Provider API Keys

| Provider | Env Var |
|----------|---------|
| Google Gemini | `GEMINI_API_KEY` |
| Zhipu AI (GLM) | `DC_ZAI_API_KEY` |
| Moonshot (Kimi) | `DC_KIMI_API_KEY` |
| MiniMax | `DC_MINIMAX_API_KEY` |
| GitHub Copilot | `GITHUB_TOKEN` / `GH_TOKEN` / `DC_GITHUB_TOKEN` |

## Build & Test

```bash
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```
