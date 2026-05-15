# diricontext

Graph-based project knowledge for DiriCode. Diricontext stores documentation, planning, and reference-project context in a local SQLite graph so agents and tools can reason over project structure without depending on a remote service.

## Installation

```bash
npm install diricontext
```

## Quick Start

```ts
import { DiriContext } from "diricontext";

const context = new DiriContext({ dbPath: ".diricontext/db.sqlite" });
const status = context.getStatus();
context.close();
```

## CLI

```bash
diricontext
diricontext --db-path .diricontext/db.sqlite
```

The CLI initializes the SQLite database and runs migrations. Use `DIRICONTEXT_DB` or `--db-path` to choose a database path.

## MCP Server

The package exposes the server entry point as `diricontext/server`. Current server support is limited to database initialization helpers; the full MCP tool surface is tracked in the Diricontext MVP task series.

Example client configuration:

```json
{
  "mcpServers": {
    "diricontext": {
      "command": "node",
      "args": ["./node_modules/diricontext/dist/server.js"],
      "env": {
        "DIRICONTEXT_DB": ".diricontext/db.sqlite"
      }
    }
  }
}
```

## Exports

| Export | Description |
| --- | --- |
| `diricontext` | Public API: `DiriContext`, graph storage helpers, schemas, and types. |
| `diricontext/server` | Server-side database initialization helper. |
| `diricontext/cli` | CLI entry point used by the `diricontext` binary. |

## Available APIs

| API | Description |
| --- | --- |
| `DiriContext` | Main facade for project status, sprint/blocker inspection, summaries, and graph access. |
| `NodeStorage` | Create, update, delete, and list graph nodes. |
| `EdgeStorage` | Create and query directed relationships between nodes. |
| `NamespaceStorage` | Manage the built-in `docs`, `plan`, and reference namespaces. |
| `SearchEngine` | Full-text search over node title, description, and labels. |
| `createDiricontextServerDatabase` | Initialize and migrate a Diricontext SQLite database for server use. |

## Planned MCP Surface

The issue backlog describes a larger MCP surface. The implementation currently exposes the package entry points above; these planned capabilities should be documented in detail as the server handlers land.

| Category | Planned capability area |
| --- | --- |
| Tools | Node CRUD, edge CRUD, search, status, sprint, blocker, next-work, execution-plan, and summary operations. |
| Resources | Graph snapshots, namespace views, sprint views, blockers, feature maps, and search result resources. |
| Prompts | Project status, next work, blocker analysis, execution planning, and namespace summaries. |

## License

MIT
