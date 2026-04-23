export type GoalStatus = "draft" | "active";

export type AgentStatus = "idle" | "active" | "waiting";

export type TaskStatus = "backlog" | "doing" | "done" | "waiting";

export type RunStatus = "draft" | "ready";

export interface Goal {
  id: string;
  title: string;
  description: string;
  status: GoalStatus;
  priority: "low" | "medium" | "high";
  currentPhase: string;
  tags: string[];
  successCriteria: string[];
}

export interface Agent {
  id: string;
  name: string;
  type: "master" | "tool" | "builder" | "analyst";
  role: string;
  status: AgentStatus;
  currentTask: string;
  lastOutput: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: "low" | "medium" | "high";
  assignedAgent: string;
}

export interface ExecutionRun {
  id: string;
  source: string;
  status: RunStatus;
  prompt: string;
  response: string;
}