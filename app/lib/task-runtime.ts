export type RuntimeTaskStatus =
  | "queued"
  | "running"
  | "pending-pr"
  | "completed"
  | "failed";

type RuntimeTask = {
  id: string;

  title: string;

  status: RuntimeTaskStatus;

  startedAt?: number;

  pendingPrAt?: number;

  completedAt?: number;

  failedAt?: number;
};

const runtimeTasks:
  RuntimeTask[] = [];

export function addRuntimeTask(
  task: RuntimeTask
) {
  runtimeTasks.unshift(task);
}

export function getRuntimeTasks() {
  return runtimeTasks;
}

export function updateTaskStatus(
  id: string,

  status: RuntimeTaskStatus
) {
  const task =
    runtimeTasks.find(
      (task) => task.id === id
    );

  if (!task) {
    return;
  }

  task.status = status;

  if (status === "running") {
    task.startedAt = Date.now();
  }

    if (status === "pending-pr") {
    task.pendingPrAt =
      Date.now();
  }

  if (status === "completed") {
    task.completedAt =
      Date.now();
  }

  if (status === "failed") {
    task.failedAt =
      Date.now();
  }
}
