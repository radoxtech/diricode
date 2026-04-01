export interface DispatcherCapabilities {
  readonly classify_intent: true;
  readonly discover_agents: true;
  readonly delegate: true;
  readonly monitor_progress: true;
  readonly emit_event: true;
  readonly read_context: true;
}

export interface DispatcherProhibitions {
  readonly mutate_files: true;
  readonly execute_commands: true;
  readonly call_external_apis: true;
  readonly execute_domain_logic: true;
  readonly make_domain_decisions: true;
}

export interface DispatcherRuntimeContract {
  readonly capabilities: DispatcherCapabilities;
  readonly prohibitions: DispatcherProhibitions;
  readonly allowedTools: readonly string[];
}

export const DISPATCHER_CONTRACT: DispatcherRuntimeContract = {
  capabilities: {
    classify_intent: true,
    discover_agents: true,
    delegate: true,
    monitor_progress: true,
    emit_event: true,
    read_context: true,
  },
  prohibitions: {
    mutate_files: true,
    execute_commands: true,
    call_external_apis: true,
    execute_domain_logic: true,
    make_domain_decisions: true,
  },
  allowedTools: [
    "list_agents",
    "search_agents",
    "classify_intent",
    "emit_event",
    "read_file",
    "list_files",
    "search_files",
    "search_web",
  ],
};
