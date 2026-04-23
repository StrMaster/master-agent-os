export type GoalStatus = "draft" | "active" | "paused" | "completed" | "archived";
export type AgentStatus = "idle" | "active" | "working" | "waiting" | "blocked" | "archived";
export type TaskStatus = "backlog" | "doing" | "waiting" | "done" | "cancelled";
export type RunStatus = "draft" | "ready" | "sent" | "completed" | "failed";

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
  type: "master" | "sales" | "builder" | "analyst" | "tool" | "custom";
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