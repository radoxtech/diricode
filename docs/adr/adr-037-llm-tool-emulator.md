# ADR-037 — LLM Tool Emulator

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Draft                                         |
| Date        | 2026-03-18                                    |
| Scope       | v2                                            |
| References  | ADR-033, ADR-012, ADR-015                     |

### Context

Running tools during development and testing often triggers side effects. File writes, git operations, and API calls pollute environments and create cleanup work. We need a way to test orchestration logic without executing real tools.

### Decision

Implement `LLMToolEmulator` as a wrapper that intercepts tool calls and returns LLM-generated plausible outputs instead of executing the actual tool.

#### Architecture

The emulator works through a tool-wrapping factory. Note: this is a *factory function* that creates a wrapped tool — distinct from the `WrapToolCall` middleware hook interface defined in ADR-033 (which wraps execution at the pipeline level). Here the wrapping is per-tool at construction time:

```typescript
function createEmulatingToolWrapper<TArgs, TResult>(
  toolName: string,
  execute: (args: TArgs) => Promise<TResult>,
  config: ToolConfig
): (args: TArgs) => Promise<TResult> {
  return async (args: TArgs) => {
    if (shouldEmulate(toolName, config)) {
      return await llm.generateToolOutput(toolName, args);
    }
    return execute(args);
  };
}
```

#### Configuration

Emulation is controlled at two levels:

| Level | Setting | Description |
|-------|---------|-------------|
| Tool | `emulatable: boolean` | Per-tool annotation (from ADR-015) |
| Environment | `EMULATION_MODE` | Global switch: `off`, `dev`, `test`, `all` |

Tools declare themselves emulatable via annotation:

```typescript
@tool({
  name: "file_read",
  emulatable: true,  // LLM can simulate this
  annotations: {
    readOnlyHint: true,
    destructiveHint: false
  }
})
```

#### Work Mode Integration (ADR-012)

The 4-dimension work mode system integrates with emulation:

| Work Mode | Emulation Behavior |
|-----------|-------------------|
| Safe Mode (Autonomy Level 1) | Emulate ALL tools, even non-emulatable ones |
| Dev Environment | Emulate emulatable tools, execute others |
| Test Environment | Emulate by default, execute on explicit request |
| Production | Never emulate |

Safe Mode uses the LLM emulator as a sandbox. Users can test workflows without any side effects. This complements the "Ask Everything" autonomy level from ADR-012.

### Consequences

- **Positive:**
  - Safe testing of orchestration logic without environment pollution
  - Fast CI pipelines without setup/teardown overhead
  - Demos and tutorials run without real credentials or API keys
  - Reduced risk when testing destructive operations

- **Negative / Trade-offs:**
  - LLM-generated outputs may differ from real tool behavior
  - Cannot catch tool-specific bugs or edge cases
  - Additional latency when emulating (LLM call required)
  - Does NOT replace real integration testing

- **Migration notes:**
  - Add `emulatable` annotation to existing tools incrementally
  - Default is `emulatable: false` for backward compatibility

### Details

#### Example Tool Definition

```typescript
interface FileReadArgs {
  path: string;
}

interface FileReadResult {
  content: string;
  size: number;
}

const fileReadTool = defineTool<FileReadArgs, FileReadResult>({
  name: "file_read",
  description: "Read contents of a file",
  emulatable: true,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true
  },
  execute: async (args) => {
    // Real implementation
    const content = await fs.readFile(args.path, "utf-8");
    return {
      content,
      size: content.length
    };
  }
});

// Wrap with emulator
export const wrappedFileRead = createEmulatingToolWrapper(
  fileReadTool.name,
  fileReadTool.execute,
  { emulatable: fileReadTool.emulatable }
);
```

#### Non-Emulatable Tools

Some tools should never be emulated:

```typescript
@tool({
  name: "git_push",
  emulatable: false,  // Real remote operation required
  annotations: {
    readOnlyHint: false,
    destructiveHint: true
  }
})
```

In Safe Mode, even non-emulatable tools return simulated responses. The LLM generates output describing what would happen without performing the action.

#### Environment Configuration

```yaml
# config/emulation.yaml
development:
  mode: dev
  emulate:
    - file_read
    - file_write
    - bash_exec

testing:
  mode: test
  emulate: "*"  // All emulatable tools
  except:
    - database_write

production:
  mode: off
```

#### When to Use Emulation

| Scenario | Emulation | Real Execution |
|----------|-----------|----------------|
| Unit testing orchestration | ✓ | |
| CI/CD smoke tests | ✓ | |
| Demo scripts | ✓ | |
| Integration testing | | ✓ |
| Production workflows | | ✓ |
| Debugging tool failures | | ✓ |

Emulation validates flow logic. It does not validate tool correctness. Always run real integration tests before deploying.
