import { updateRuntimeQueueTask } from "@/app/lib/runtime-queue";

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

export function addRuntimeTask(task: RuntimeTask) {
  // Redis enqueue handled by enqueueRuntimeTask in runtime-queue.ts
}

export function getRuntimeTasks(): RuntimeTask[] {
  return [];
}

export async function updateTaskStatus(id: string, status: RuntimeTaskStatus) {
  const updatedAt = new Date().toISOString();
  const update: Partial<RuntimeTask> = { status, updatedAt };

  if (status === "running") update.startedAt = updatedAt;
  if (status === "pending-pr") update.pendingPrAt = Date.now();
  if (status === "completed" || status === "done") update.completedAt = updatedAt;
  if (status === "failed") update.failedAt = Date.now();

  try {
    await updateRuntimeQueueTask(id, update);
  } catch (e) {
    console.warn("[task-runtime] failed to update task status in Redis", e);
  }
}
