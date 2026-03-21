export enum AgentLifecycleState {
  idle = "idle",
  initializing = "initializing",
  executing = "executing",
  completing = "completing",
  error = "error",
  completed = "completed",
}

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
}

export interface AgentExecutionContext {
  agentId: string;
  runId: string;
}

export type AgentResult = {
  success: boolean;
  output: unknown;
  tokensUsed: number;
  cost: number;
  errors: string[];
};

export class AgentStateMachine {
  private currentState: AgentLifecycleState;

  constructor() {
    this.currentState = AgentLifecycleState.idle;
  }

  public getState(): AgentLifecycleState {
    return this.currentState;
  }

  public transitionTo(newState: AgentLifecycleState): void {
    const validTransitions: Record<AgentLifecycleState, AgentLifecycleState[]> = {
      [AgentLifecycleState.idle]: [AgentLifecycleState.initializing],
      [AgentLifecycleState.initializing]: [AgentLifecycleState.executing],
      [AgentLifecycleState.executing]: [AgentLifecycleState.completing, AgentLifecycleState.error],
      [AgentLifecycleState.completing]: [AgentLifecycleState.completed],
      [AgentLifecycleState.error]: [AgentLifecycleState.completed],
      [AgentLifecycleState.completed]: [],
    };

    if (validTransitions[this.currentState].includes(newState)) {
      this.currentState = newState;
    } else {
      throw new Error(`Invalid state transition from ${this.currentState} to ${newState}`);
    }
  }
}
