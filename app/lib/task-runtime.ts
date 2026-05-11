export type RuntimeTaskStatus =
  | "todo"
  | "queued"
  | "running"
  | "pending-pr"
  | "completed"
  | "done"
  | "failed"
  | "planner-required";

export type RuntimeTask = {
  id: string;
  title: string;
  summary?: string;
  targetFile?: string;
  status: RuntimeTaskStatus;
  priority?: "low" | "medium" | "high";
  source?: string;
  intent?: string;
  riskLevel?: "low" | "medium" | "high";
  executionMode?: "single-file" | "multi-step";
  wave?: number;
  previewOnly?: boolean;
  requiresApproval?: boolean;
  plannerNotes?: string;
  agentRole?: string;
  agentName?: string;
  agentSystemPrompt?: string;
  routingReason?: string;
  createdAt?: string;
  queuedAt?: string;
  startedAt?: string | number;
  pendingPrAt?: number;
  completedAt?: string | number;
  failedAt?: number;
  updatedAt?: string;
  error?: string;
  runtimeOnly?: true;
};

const runtimeTasks: RuntimeTask[] = [];

export function addRuntimeTask(task: RuntimeTask) {
  const existingIndex = runtimeTasks.findIndex(
    (candidate) => candidate.id === task.id
  );

  const runtimeTask: RuntimeTask = {
    ...task,
    runtimeOnly: true,
    updatedAt: task.updatedAt ?? new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    runtimeTasks[existingIndex] = runtimeTask;
    return;
  }

  runtimeTasks.unshift(runtimeTask);
}

export function getRuntimeTasks() {
  return runtimeTasks;
}

export function updateTaskStatus(id: string, status: RuntimeTaskStatus) {
  const task = runtimeTasks.find((task) => task.id === id);

  if (!task) {
    return;
  }

  task.status = status;
  task.updatedAt = new Date().toISOString();

  if (status === "running") {
    task.startedAt = new Date().toISOString();
  }

  if (status === "pending-pr") {
    task.pendingPrAt = Date.now();
  }

  if (status === "completed" || status === "done") {
    task.completedAt = new Date().toISOString();
  }

  if (status === "failed") {
    task.failedAt = Date.now();
  }
}
